# RAG Assistant - Copilot Instructions

## Project Overview
A full-stack RAG (Retrieval-Augmented Generation) assistant for corporate documents (PDF, Word, TXT). Features document upload, intelligent Q&A with source citations, and hallucination guardrails.

## Tech Stack
- **Backend**: Python 3.11+, FastAPI, LangChain, ChromaDB, Anthropic Claude API
- **Frontend**: React 18 + Vite, TailwindCSS
- **Infrastructure**: AWS Lambda (container image via ECR), API Gateway, S3, Cloudflare Pages
- **Domain**: rag.alperyasemin.com

## Architecture
- Left panel: Document upload and management
- Right panel: Chat interface with streaming responses
- Source citations with document name and page number
- Hallucination guardrail: answers only from uploaded documents
- ChromaDB data persisted to S3 for Lambda cold-start recovery

## Development Rules
- All code and UI in English
- Use environment variables for API keys
- Follow REST API conventions
- Keep components modular and testable
