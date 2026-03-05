# RAG Assistant

A full-stack **Retrieval-Augmented Generation** assistant for corporate documents. Upload PDF, Word, or TXT files (or paste raw text), then ask questions — the AI answers using **only** the content from your documents, with source citations and confidence scoring.

**Live:** [https://rag.alperyasemin.com](https://rag.alperyasemin.com)

![Python](https://img.shields.io/badge/Python-3.11-blue)
![FastAPI](https://img.shields.io/badge/FastAPI-0.115-green)
![React](https://img.shields.io/badge/React-18-blue)
![Claude](https://img.shields.io/badge/Anthropic-Claude-orange)

---

## How It Works

```
┌─────────────────────────────────────────────────────────┐
│                      User Interface                      │
│  ┌──────────────────┐  ┌──────────────────────────────┐ │
│  │  Document Panel   │  │        Chat Panel             │ │
│  │  - File upload    │  │  - Ask questions              │ │
│  │  - Text input     │  │  - Get answers with sources   │ │
│  │  - Chunk settings │  │  - Confidence badges          │ │
│  └──────────────────┘  └──────────────────────────────┘ │
└─────────────────────┬───────────────────────────────────┘
                      │ HTTP API
┌─────────────────────▼───────────────────────────────────┐
│                    FastAPI Backend                        │
│                                                          │
│  1. UPLOAD → Parse document (PDF/DOCX/TXT/text)         │
│  2. CHUNK  → Split into overlapping text chunks          │
│  3. EMBED  → Convert chunks to vectors (all-MiniLM-L6)  │
│  4. STORE  → Save vectors in ChromaDB                    │
│  5. QUERY  → Hybrid search (semantic + keyword)          │
│  6. ANSWER → Claude generates answer from context only   │
│  7. CHECK  → Hallucination guardrail validates answer    │
│  8. CITE   → Extract source references with page numbers │
└─────────────────────────────────────────────────────────┘
```

### RAG Pipeline in Detail

1. **Document Processing** — Files are parsed into page-level text blocks:
   - PDF: extracted page-by-page using `pypdf`
   - DOCX: paragraphs grouped into ~3000-char estimated pages
   - TXT/Text: split into ~3000-char blocks

2. **Chunking** — Each page block is split into smaller, overlapping chunks using `RecursiveCharacterTextSplitter`. Default: 1500 chars with 300-char overlap. Users can customize these values per upload.

3. **Embedding** — Chunks are converted to 384-dimensional vectors using ChromaDB's built-in `all-MiniLM-L6-v2` model (ONNX runtime, ~80MB — no PyTorch needed).

4. **Hybrid Search** — When a question is asked, two search strategies run in parallel:
   - **Semantic search**: cosine similarity between question embedding and stored vectors
   - **Keyword fallback**: exact keyword matching via ChromaDB's `$contains` filter
   - Results are merged and deduplicated

5. **Answer Generation** — Retrieved chunks are formatted as context and sent to Claude with a strict system prompt that forbids hallucination. The model can only use information present in the context.

6. **Confidence Evaluation** — A second Claude call rates confidence as high/medium/low based on how well the context supports the answer.

---

## Tech Stack

| Layer      | Technology                                          |
| ---------- | --------------------------------------------------- |
| LLM        | Anthropic Claude (claude-sonnet-4-20250514)                  |
| Embeddings | ChromaDB built-in all-MiniLM-L6-v2 (ONNX, ~80MB)  |
| Vector DB  | ChromaDB (persistent, local storage)                |
| Backend    | Python 3.11, FastAPI, LangChain                     |
| Frontend   | React 18, Vite, TailwindCSS                         |
| Deployment | Docker, AWS EC2 (Free Tier), Cloudflare Tunnel      |

---

## Project Structure

```
.
├── backend/
│   ├── app/
│   │   ├── config.py              # Settings (env vars, defaults)
│   │   ├── main.py                # FastAPI app & API routes
│   │   ├── models.py              # Pydantic request/response schemas
│   │   ├── document_processor.py  # PDF/DOCX/TXT parsing & chunking
│   │   ├── vector_store.py        # ChromaDB wrapper, hybrid search
│   │   └── rag_chain.py           # RAG pipeline, hallucination check
│   ├── requirements.txt
│   └── .env.example
├── frontend/
│   ├── src/
│   │   ├── App.jsx                # Main layout (sidebar + chat)
│   │   ├── api.js                 # API client (axios)
│   │   └── components/
│   │       ├── DocumentPanel.jsx  # Upload, text input, chunk settings
│   │       └── ChatPanel.jsx      # Chat UI, sources, confidence
│   ├── package.json
│   └── vite.config.js
├── infra/
│   ├── main.tf                    # Terraform: EC2 + security group
│   ├── user-data.sh               # EC2 cloud-init script
│   └── terraform.tfvars.example
├── Dockerfile                     # Multi-stage: build frontend + serve with backend
├── docker-compose.yml             # Single container deployment
└── .github/
    └── copilot-instructions.md
```

---

## API Endpoints

| Method   | Path                      | Description                         |
| -------- | ------------------------- | ----------------------------------- |
| `GET`    | `/api/health`             | Health check + document/chunk count |
| `GET`    | `/api/config`             | Default chunk size & overlap        |
| `GET`    | `/api/documents`          | List all uploaded documents         |
| `POST`   | `/api/documents/upload`   | Upload a file (PDF/DOCX/TXT)        |
| `POST`   | `/api/documents/text`     | Submit plain text as a document     |
| `DELETE` | `/api/documents/{doc_id}` | Delete a document and its chunks    |
| `POST`   | `/api/chat`               | Ask a question, get cited answer    |

### Example: Ask a Question

```bash
curl -X POST https://rag.alperyasemin.com/api/chat \
  -H "Content-Type: application/json" \
  -d '{"question": "What is the revenue for Q3?"}'
```

Response:
```json
{
  "answer": "According to the financial report, Q3 revenue was $4.2M...",
  "sources": [
    {
      "document_name": "financial-report-2025.pdf",
      "page_number": 12,
      "content_preview": "Third quarter revenue reached $4.2 million..."
    }
  ],
  "confidence": "high"
}
```

---

## Local Development

### Prerequisites
- Python 3.11+
- Node.js 18+
- [Anthropic API key](https://console.anthropic.com/)

### Backend

```bash
cd backend
cp .env.example .env
# Edit .env and add your ANTHROPIC_API_KEY

python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt

uvicorn app.main:app --reload --port 8000
```

### Frontend

```bash
cd frontend
npm install
npm run dev
# Opens at http://localhost:3000, proxies /api to :8000
```

---

## Docker Deployment

```bash
# Set your API key
echo "ANTHROPIC_API_KEY=sk-ant-..." > backend/.env

# Build and run
docker compose up -d --build

# App is available at http://localhost:8000
```

The Dockerfile uses a multi-stage build:
1. **Stage 1**: Builds the React frontend with `npm ci && npm run build`
2. **Stage 2**: Installs Python dependencies, copies the built frontend into `./static`, and runs FastAPI which serves both the API and the SPA

---

## Production Deployment (AWS + Cloudflare)

The project runs on AWS EC2 Free Tier with Cloudflare Tunnel for HTTPS.

### Infrastructure with Terraform

```bash
cd infra
cp terraform.tfvars.example terraform.tfvars
# Edit terraform.tfvars with your values

terraform init
terraform apply
```

This creates:
- EC2 t2.micro instance (Free Tier, 20GB gp3)
- Security group with SSH-only access (Cloudflare Tunnel handles HTTP)
- Cloud-init script that installs Docker, clones the repo, and starts the app

### Cloudflare Tunnel Setup

After EC2 is running:

```bash
# SSH into EC2
ssh -i your-key.pem ubuntu@<EC2_IP>

# Authenticate with Cloudflare
cloudflared tunnel login

# Create tunnel
cloudflared tunnel create rag-assistant

# Route DNS
cloudflared tunnel route dns rag-assistant rag.yourdomain.com

# Create config
cat > /etc/cloudflared/config.yml << EOF
tunnel: <TUNNEL_ID>
credentials-file: /home/ubuntu/.cloudflared/<TUNNEL_ID>.json
ingress:
  - hostname: rag.yourdomain.com
    service: http://localhost:8000
  - service: http_status:404
EOF

# Install as service
sudo cloudflared service install
sudo systemctl enable cloudflared
sudo systemctl start cloudflared
```

---

## Environment Variables

| Variable            | Default                | Description                    |
| ------------------- | ---------------------- | ------------------------------ |
| `ANTHROPIC_API_KEY` | *(required)*           | Anthropic API key              |
| `CHROMA_PERSIST_DIR`| `./chroma_data`        | ChromaDB storage directory     |
| `UPLOAD_DIR`        | `./uploads`            | Uploaded files directory       |
| `MAX_FILE_SIZE_MB`  | `50`                   | Maximum upload file size       |
| `CHUNK_SIZE`        | `1500`                 | Default text chunk size        |
| `CHUNK_OVERLAP`     | `300`                  | Default chunk overlap          |
| `LLM_MODEL`        | `claude-sonnet-4-20250514`    | Anthropic model to use         |

---

## License

MIT
