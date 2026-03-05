# RAG Assistant

A full-stack Retrieval-Augmented Generation (RAG) assistant for corporate document analysis. Upload PDF, Word, or TXT documents and ask questions — the assistant answers with source citations and hallucination guardrails.

## Features

- **Document Upload** — PDF, DOCX, TXT support with drag & drop
- **Intelligent Q&A** — Ask questions about uploaded documents
- **Source Citations** — Every answer shows document name and page number
- **Hallucination Guardrail** — Answers are strictly grounded in uploaded documents
- **Confidence Scoring** — High / Medium / Low confidence indicators
- **Modern UI** — Split-panel layout with document manager and chat interface

## Tech Stack

| Layer          | Technology                                     |
| -------------- | ---------------------------------------------- |
| Backend        | Python 3.11+, FastAPI, LangChain               |
| Vector Store   | ChromaDB (persistent, local)                   |
| LLM            | Anthropic Claude (claude-sonnet-4-20250514)            |
| Embeddings     | HuggingFace all-MiniLM-L6-v2 (local, free)    |
| Frontend       | React 18, Vite, TailwindCSS                    |
| Infrastructure | Docker, Nginx, Cloudflare                      |

## Project Structure

```
.
├── backend/
│   ├── app/
│   │   ├── main.py              # FastAPI application & routes
│   │   ├── config.py            # Settings & environment variables
│   │   ├── models.py            # Pydantic models
│   │   ├── document_processor.py # PDF/DOCX/TXT parsing & chunking
│   │   ├── vector_store.py      # ChromaDB operations
│   │   └── rag_chain.py         # RAG pipeline & hallucination guard
│   ├── requirements.txt
│   ├── Dockerfile
│   └── .env.example
├── frontend/
│   ├── src/
│   │   ├── App.jsx              # Main layout
│   │   ├── api.js               # API client
│   │   └── components/
│   │       ├── DocumentPanel.jsx # Upload & document management
│   │       └── ChatPanel.jsx    # Chat interface with sources
│   ├── package.json
│   ├── vite.config.js
│   └── Dockerfile
├── nginx/
│   ├── nginx.conf               # Main Nginx config
│   └── conf.d/default.conf      # Reverse proxy for alperyasemin.com
├── docker-compose.yml
└── README.md
```

## Quick Start

### Prerequisites

- Python 3.11+
- Node.js 18+
- Anthropic API key

### 1. Backend Setup

```bash
cd backend
cp .env.example .env
# Edit .env and set your ANTHROPIC_API_KEY

python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt

uvicorn app.main:app --reload --port 8000
```

### 2. Frontend Setup

```bash
cd frontend
npm install
npm run dev
```

The app will be available at `http://localhost:3000` with API proxied to port 8000.

### 3. Docker Deployment (Production)

```bash
# Set your Anthropic API key in backend/.env
cp backend/.env.example backend/.env

# Build and start all services
docker compose up -d --build

# The app will be available on port 80
```

## Deployment on rag.alperyasemin.com

This project is deployed on **Render.com** with **Cloudflare DNS**.

### Step 1: Push to GitHub

```bash
git init
git add .
git commit -m "Initial commit"
gh repo create rag-assistant --private --push
```

### Step 2: Deploy on Render

1. Go to [render.com](https://render.com) → **New** → **Blueprint**
2. Connect your GitHub repository
3. Render will auto-detect `render.yaml` and configure the service
4. Set `ANTHROPIC_API_KEY` in the Render dashboard (Environment tab)
5. Click **Apply** — Render will build and deploy automatically
6. Note your Render service URL (e.g., `rag-assistant-xxxx.onrender.com`)

### Step 3: Cloudflare DNS

1. Go to [Cloudflare Dashboard](https://dash.cloudflare.com) → `alperyasemin.com` → **DNS**
2. Add a **CNAME** record:
   - **Name**: `rag`
   - **Target**: `rag-assistant-xxxx.onrender.com` (your Render URL)
   - **Proxy status**: DNS only (grey cloud) — Render handles SSL
3. In Render dashboard → **Settings** → **Custom Domains** → Add `rag.alperyasemin.com`
4. Render will auto-provision an SSL certificate

### Alternative: Docker on VPS

```bash
# On your server (DigitalOcean, AWS EC2, etc.)
git clone <your-repo> /opt/rag-assistant
cd /opt/rag-assistant
cp backend/.env.example backend/.env
nano backend/.env  # Set ANTHROPIC_API_KEY

# Single-container production build
docker build -t rag-assistant .
docker run -d -p 80:8000 --name rag \
  -v rag_data:/app/chroma_data \
  -v rag_uploads:/app/uploads \
  --env-file backend/.env \
  rag-assistant

# Or multi-container with nginx
docker compose up -d --build
```

Then in Cloudflare, add an **A record**: `rag` → your server IP.

## API Endpoints

| Method   | Endpoint                    | Description                  |
| -------- | --------------------------- | ---------------------------- |
| `GET`    | `/api/health`               | Health check                 |
| `POST`   | `/api/documents/upload`     | Upload a document            |
| `GET`    | `/api/documents`            | List uploaded documents      |
| `DELETE` | `/api/documents/{doc_id}`   | Delete a document            |
| `POST`   | `/api/chat`                 | Ask a question               |

## Environment Variables

| Variable             | Default                    | Description                       |
| -------------------- | -------------------------- | --------------------------------- |
| `ANTHROPIC_API_KEY`  | —                          | Your Anthropic API key (required) |
| `LLM_MODEL`          | `claude-sonnet-4-20250514`         | Claude model for answers          |
| `EMBEDDING_MODEL`    | `all-MiniLM-L6-v2`        | HuggingFace embedding model       |
| `CHUNK_SIZE`         | `1500`                     | Text chunk size (chars)           |
| `CHUNK_OVERLAP`      | `300`                      | Chunk overlap (chars)             |
| `MAX_FILE_SIZE_MB`   | `50`                       | Max upload file size              |

## License

Private project.
