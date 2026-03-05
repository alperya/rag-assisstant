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

Deployed on **AWS EC2 Free Tier** with **Cloudflare Tunnel** (no open ports needed, free SSL).

### Prerequisites

- AWS account (Free Tier eligible)
- Cloudflare account with `alperyasemin.com` domain

### Step 1: Launch EC2 Instance

1. Go to [AWS Console](https://console.aws.amazon.com/ec2) → **Launch Instance**
2. Settings:
   - **Name**: `rag-assistant`
   - **AMI**: Ubuntu 22.04 LTS (Free Tier eligible)
   - **Instance type**: `t2.micro` (Free Tier — 1 vCPU, 1GB RAM)
   - **Key pair**: Create or select an existing key pair
   - **Security Group**: Allow only **SSH (port 22)** — no other ports needed (Cloudflare Tunnel handles everything)
   - **Storage**: 20 GB gp3 (Free Tier allows up to 30GB)
3. Click **Launch Instance**

### Step 2: SSH & Run Setup Script

```bash
ssh -i your-key.pem ubuntu@<EC2_PUBLIC_IP>

# Download and run setup script
curl -fsSL https://raw.githubusercontent.com/alperya/rag-assisstant/main/deploy/setup-ec2.sh | bash

# Log out and back in for Docker group permissions
exit
ssh -i your-key.pem ubuntu@<EC2_PUBLIC_IP>
```

### Step 3: Configure & Build

```bash
cd /opt/rag-assistant

# Set your Anthropic API key
nano backend/.env

# Build and start (first build takes ~5 min)
docker compose -f docker-compose.prod.yml up -d --build

# Verify it's running
curl http://localhost:8000/api/health
```

### Step 4: Set Up Cloudflare Tunnel

```bash
# 1. Login to Cloudflare (opens browser link to authorize)
cloudflared tunnel login

# 2. Create tunnel
cloudflared tunnel create rag-assistant

# 3. Copy and edit config (replace <TUNNEL_ID> with actual ID from step 2)
mkdir -p ~/.cloudflared
cp /opt/rag-assistant/deploy/cloudflared-config.yml ~/.cloudflared/config.yml
nano ~/.cloudflared/config.yml

# 4. Create DNS route (auto-adds CNAME in Cloudflare)
cloudflared tunnel route dns rag-assistant rag.alperyasemin.com

# 5. Install as system service & start
sudo cloudflared service install
sudo systemctl start cloudflared
sudo systemctl enable cloudflared
```

### Step 5: Verify

Your app is now live at **https://rag.alperyasemin.com** 🎉

```bash
# Check tunnel status
sudo systemctl status cloudflared

# Check app status
docker compose -f docker-compose.prod.yml ps

# View logs
docker compose -f docker-compose.prod.yml logs -f
```

### Updating the App

```bash
cd /opt/rag-assistant
git pull
docker compose -f docker-compose.prod.yml up -d --build
```

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
