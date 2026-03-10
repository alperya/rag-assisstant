#!/usr/bin/env bash
# deploy-lambda.sh — Deploy RAG Assistant backend to AWS Lambda (container image)
# Prerequisites: aws-cli v2, docker
set -euo pipefail

# ─── Configuration ────────────────────────────────────────────────────────────
REGION="eu-central-1"
FUNCTION_NAME="rag-assistant"
ECR_REPO="rag-assistant"
ROLE_NAME="rag-assistant-lambda-role"
API_NAME="rag-assistant-api"
MEMORY_MB=1024
TIMEOUT_SEC=120
EPHEMERAL_MB=2048          # /tmp size for ChromaDB + ONNX model

ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
S3_BUCKET="rag-assistant-data-${ACCOUNT_ID}"
ECR_URI="${ACCOUNT_ID}.dkr.ecr.${REGION}.amazonaws.com/${ECR_REPO}"

echo "Account  : ${ACCOUNT_ID}"
echo "Region   : ${REGION}"
echo "S3 Bucket: ${S3_BUCKET}"
echo ""

# ─── 1. S3 Bucket ────────────────────────────────────────────────────────────
echo "▶ Creating S3 bucket (if not exists)..."
if aws s3api head-bucket --bucket "${S3_BUCKET}" 2>/dev/null; then
  echo "  Bucket already exists."
else
  aws s3api create-bucket \
    --bucket "${S3_BUCKET}" \
    --region "${REGION}" \
    --create-bucket-configuration LocationConstraint="${REGION}"
  echo "  Bucket created."
fi

# ─── 2. ECR Repository ───────────────────────────────────────────────────────
echo "▶ Creating ECR repository (if not exists)..."
aws ecr describe-repositories --repository-names "${ECR_REPO}" --region "${REGION}" 2>/dev/null \
  || aws ecr create-repository --repository-name "${ECR_REPO}" --region "${REGION}"

# ─── 3. Build & Push Docker Image ────────────────────────────────────────────
echo "▶ Building Lambda container image..."
docker build --platform linux/amd64 --provenance=false \
  -f Dockerfile.lambda -t "${ECR_REPO}:latest" .

echo "▶ Logging in to ECR..."
aws ecr get-login-password --region "${REGION}" \
  | docker login --username AWS --password-stdin "${ACCOUNT_ID}.dkr.ecr.${REGION}.amazonaws.com"

echo "▶ Pushing image to ECR..."
docker tag "${ECR_REPO}:latest" "${ECR_URI}:latest"
docker push "${ECR_URI}:latest"

# ─── 4. IAM Role ─────────────────────────────────────────────────────────────
echo "▶ Setting up IAM role..."
TRUST_POLICY='{
  "Version":"2012-10-17",
  "Statement":[{
    "Effect":"Allow",
    "Principal":{"Service":"lambda.amazonaws.com"},
    "Action":"sts:AssumeRole"
  }]
}'

aws iam create-role \
  --role-name "${ROLE_NAME}" \
  --assume-role-policy-document "${TRUST_POLICY}" 2>/dev/null || true

aws iam attach-role-policy \
  --role-name "${ROLE_NAME}" \
  --policy-arn arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole 2>/dev/null || true

S3_POLICY=$(cat <<EOF
{
  "Version":"2012-10-17",
  "Statement":[{
    "Effect":"Allow",
    "Action":["s3:GetObject","s3:PutObject","s3:DeleteObject","s3:HeadObject"],
    "Resource":"arn:aws:s3:::${S3_BUCKET}/*"
  }]
}
EOF
)

aws iam put-role-policy \
  --role-name "${ROLE_NAME}" \
  --policy-name s3-access \
  --policy-document "${S3_POLICY}"

ROLE_ARN=$(aws iam get-role --role-name "${ROLE_NAME}" --query Role.Arn --output text)
echo "  Role ARN: ${ROLE_ARN}"

# ─── 5. Lambda Function ──────────────────────────────────────────────────────
echo "▶ Deploying Lambda function..."

if [ -f backend/.env ]; then
  ANTHROPIC_API_KEY=$(grep -E '^ANTHROPIC_API_KEY=' backend/.env | cut -d'=' -f2- | tr -d '"' | tr -d "'")
fi
: "${ANTHROPIC_API_KEY:?Set ANTHROPIC_API_KEY in backend/.env or export it}"

ENV_VARS="Variables={HOME=/tmp,S3_BUCKET=${S3_BUCKET},CHROMA_PERSIST_DIR=/tmp/chroma_data,UPLOAD_DIR=/tmp/uploads,ANTHROPIC_API_KEY=${ANTHROPIC_API_KEY},MAX_FILE_SIZE_MB=4}"

if aws lambda get-function --function-name "${FUNCTION_NAME}" --region "${REGION}" 2>/dev/null; then
  echo "  Updating existing function..."
  aws lambda update-function-code \
    --function-name "${FUNCTION_NAME}" \
    --image-uri "${ECR_URI}:latest" \
    --region "${REGION}" > /dev/null

  aws lambda wait function-updated --function-name "${FUNCTION_NAME}" --region "${REGION}"

  aws lambda update-function-configuration \
    --function-name "${FUNCTION_NAME}" \
    --memory-size "${MEMORY_MB}" \
    --timeout "${TIMEOUT_SEC}" \
    --ephemeral-storage "Size=${EPHEMERAL_MB}" \
    --environment "${ENV_VARS}" \
    --region "${REGION}" > /dev/null
else
  echo "  Creating new function (waiting 10s for IAM role propagation)..."
  sleep 10

  aws lambda create-function \
    --function-name "${FUNCTION_NAME}" \
    --package-type Image \
    --code "ImageUri=${ECR_URI}:latest" \
    --role "${ROLE_ARN}" \
    --memory-size "${MEMORY_MB}" \
    --timeout "${TIMEOUT_SEC}" \
    --ephemeral-storage "Size=${EPHEMERAL_MB}" \
    --environment "${ENV_VARS}" \
    --region "${REGION}" > /dev/null

  aws lambda wait function-active --function-name "${FUNCTION_NAME}" --region "${REGION}"
fi

# ─── 6. API Gateway (HTTP API) ───────────────────────────────────────────────
echo "▶ Configuring API Gateway..."

LAMBDA_ARN=$(aws lambda get-function --function-name "${FUNCTION_NAME}" --region "${REGION}" \
  --query Configuration.FunctionArn --output text)

API_ID=$(aws apigatewayv2 get-apis --region "${REGION}" \
  --query "Items[?Name=='${API_NAME}'].ApiId | [0]" --output text 2>/dev/null)

if [ "${API_ID}" = "None" ] || [ -z "${API_ID}" ]; then
  API_ID=$(aws apigatewayv2 create-api \
    --name "${API_NAME}" \
    --protocol-type HTTP \
    --cors-configuration '{"AllowOrigins":["*"],"AllowMethods":["*"],"AllowHeaders":["*"],"MaxAge":86400}' \
    --region "${REGION}" \
    --query ApiId --output text)

  INTEGRATION_ID=$(aws apigatewayv2 create-integration \
    --api-id "${API_ID}" \
    --integration-type AWS_PROXY \
    --integration-uri "${LAMBDA_ARN}" \
    --payload-format-version "2.0" \
    --region "${REGION}" \
    --query IntegrationId --output text)

  aws apigatewayv2 create-route \
    --api-id "${API_ID}" \
    --route-key '$default' \
    --target "integrations/${INTEGRATION_ID}" \
    --region "${REGION}" > /dev/null

  aws apigatewayv2 create-stage \
    --api-id "${API_ID}" \
    --stage-name '$default' \
    --auto-deploy \
    --region "${REGION}" > /dev/null

  aws lambda add-permission \
    --function-name "${FUNCTION_NAME}" \
    --statement-id apigateway-invoke \
    --action lambda:InvokeFunction \
    --principal apigateway.amazonaws.com \
    --source-arn "arn:aws:execute-api:${REGION}:${ACCOUNT_ID}:${API_ID}/*" \
    --region "${REGION}" > /dev/null 2>&1
fi

API_ENDPOINT=$(aws apigatewayv2 get-api --api-id "${API_ID}" --region "${REGION}" \
  --query ApiEndpoint --output text)

# ─── Done ─────────────────────────────────────────────────────────────────────
echo ""
echo "==========================================="
echo "  ✅  Lambda deployed successfully!"
echo "==========================================="
echo ""
echo "  API Gateway  : ${API_ENDPOINT}"
echo "  S3 Bucket    : ${S3_BUCKET}"
echo "  Region       : ${REGION}"
echo ""
echo "  Next: Deploy frontend to Cloudflare Pages"
echo "  with VITE_API_URL=${API_ENDPOINT}"
echo "==========================================="
