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
| Vector DB  | ChromaDB (persistent, S3-synced)                    |
| Backend    | Python 3.11, FastAPI, LangChain                     |
| Frontend   | React 18, Vite, TailwindCSS                         |
| Hosting    | AWS Lambda + API Gateway (backend), Cloudflare Pages (frontend) |
| Storage    | AWS S3 (ChromaDB persistence across Lambda cold starts) |

---

## Architecture

```
                    ┌──────────────────────┐
                    │   rag.alperyasemin.com│
                    │   (Cloudflare DNS)    │
                    └──────┬───────────────┘
                           │
              ┌────────────┴────────────┐
              │                         │
     ┌────────▼────────┐   ┌───────────▼───────────┐
     │ Cloudflare Pages │   │   API Gateway (HTTP)   │
     │   React SPA      │   │   CORS + $default route│
     │   (static)       │   └───────────┬───────────┘
     └──────────────────┘               │
                                ┌───────▼──────────┐
                                │   AWS Lambda      │
                                │   FastAPI + ONNX  │
                                │   (container img) │
                                └───────┬──────────┘
                                        │
                               ┌────────┴────────┐
                               │                  │
                        ┌──────▼──────┐  ┌───────▼──────┐
                        │ ChromaDB    │  │   AWS S3      │
                        │ /tmp/chroma │  │   Backup      │
                        └─────────────┘  └──────────────┘
```

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
│   │   ├── rag_chain.py           # RAG pipeline, hallucination check
│   │   └── s3_sync.py             # S3 ↔ ChromaDB data sync (Lambda)
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── App.jsx                # Main layout (sidebar + chat)
│   │   ├── api.js                 # API client (axios)
│   │   └── components/
│   │       ├── DocumentPanel.jsx  # Upload, text input, chunk settings
│   │       └── ChatPanel.jsx      # Chat UI, sources, confidence
│   ├── package.json
│   └── vite.config.js
├── Dockerfile.lambda              # Lambda container image
├── deploy-lambda.sh               # One-click Lambda deployment script
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

## Deployment

The app runs serverlessly on AWS (free tier eligible):

- **Backend**: AWS Lambda (container image via ECR) behind API Gateway HTTP API
- **Frontend**: Cloudflare Pages (static React build)
- **Persistence**: ChromaDB data compressed and synced to S3 on every write, restored on cold start

### Deploy Backend (Lambda)

```bash
# Requires: aws-cli v2, docker
# Set ANTHROPIC_API_KEY in backend/.env

./deploy-lambda.sh
```

The script automatically:
1. Creates an S3 bucket for ChromaDB persistence
2. Creates an ECR repository and pushes the container image
3. Sets up IAM role with Lambda + S3 permissions
4. Creates/updates the Lambda function (1024MB, 120s timeout, 2GB /tmp)
5. Creates an API Gateway HTTP API with CORS

### Deploy Frontend (Cloudflare Pages)

```bash
cd frontend
npm run build
npx wrangler pages deploy dist --project-name=rag-assistant
```

Set the environment variable in Cloudflare Pages dashboard:
- `VITE_API_URL` = your API Gateway endpoint (e.g. `https://xxxx.execute-api.eu-central-1.amazonaws.com`)

---

## Environment Variables

### Backend (Lambda)

| Variable            | Default                  | Description                         |
| ------------------- | ------------------------ | ----------------------------------- |
| `ANTHROPIC_API_KEY` | *(required)*             | Anthropic API key                   |
| `S3_BUCKET`         | `""`                     | S3 bucket for ChromaDB persistence  |
| `HOME`              | `/tmp`                   | Writable home dir (ONNX model cache)|
| `CHROMA_PERSIST_DIR`| `./chroma_data`          | ChromaDB storage directory          |
| `UPLOAD_DIR`        | `./uploads`              | Uploaded files directory            |
| `MAX_FILE_SIZE_MB`  | `50` (Lambda: `4`)       | Maximum upload file size            |
| `CHUNK_SIZE`        | `1500`                   | Default text chunk size             |
| `CHUNK_OVERLAP`     | `300`                    | Default chunk overlap               |
| `LLM_MODEL`        | `claude-sonnet-4-20250514`      | Anthropic model to use              |

### Frontend (Cloudflare Pages)

| Variable            | Description                               |
| ------------------- | ----------------------------------------- |
| `VITE_API_URL`      | API Gateway endpoint URL                  |

---

## License

MIT
