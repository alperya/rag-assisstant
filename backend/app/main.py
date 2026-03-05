import os
import uuid
from datetime import datetime, timezone
from pathlib import Path

from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse

from app.config import get_settings
from app.models import DocumentInfo, ChatRequest, ChatResponse, DeleteResponse, TextInputRequest
from app.document_processor import DocumentProcessor
from app.vector_store import VectorStoreManager
from app.rag_chain import RAGChain

app = FastAPI(
    title="RAG Assistant API",
    description="Corporate Document Q&A with RAG",
    version="1.0.0",
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Global state
document_registry: dict[str, DocumentInfo] = {}
processor = DocumentProcessor()
vector_store: VectorStoreManager | None = None
rag_chain: RAGChain | None = None


@app.on_event("startup")
async def startup():
    global vector_store, rag_chain
    settings = get_settings()
    os.makedirs(settings.upload_dir, exist_ok=True)
    vector_store = VectorStoreManager()
    rag_chain = RAGChain(vector_store)

    # Rebuild document registry from persisted ChromaDB data
    for doc_meta in vector_store.get_all_document_metadata():
        doc_info = DocumentInfo(
            id=doc_meta["id"],
            filename=doc_meta["filename"],
            file_type=doc_meta["file_type"],
            page_count=doc_meta["page_count"] or None,
            chunk_count=doc_meta["chunk_count"],
            uploaded_at=doc_meta["uploaded_at"] or "restored",
            size_bytes=doc_meta["size_bytes"],
        )
        document_registry[doc_info.id] = doc_info


ALLOWED_EXTENSIONS = {".pdf", ".docx", ".txt"}


@app.get("/api/health")
async def health_check():
    return {
        "status": "healthy",
        "documents_loaded": len(document_registry),
        "total_chunks": vector_store.get_collection_count() if vector_store else 0,
    }


@app.get("/api/config")
async def get_config():
    """Return default chunk configuration."""
    settings = get_settings()
    return {
        "chunk_size": settings.chunk_size,
        "chunk_overlap": settings.chunk_overlap,
    }


@app.post("/api/documents/upload", response_model=DocumentInfo)
async def upload_document(
    file: UploadFile = File(...),
    chunk_size: int | None = Form(None),
    chunk_overlap: int | None = Form(None),
):
    """Upload and process a document."""
    settings = get_settings()

    # Validate file extension
    ext = os.path.splitext(file.filename)[1].lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file type: {ext}. Allowed: {', '.join(ALLOWED_EXTENSIONS)}",
        )

    # Validate file size
    content = await file.read()
    size_bytes = len(content)
    max_size = settings.max_file_size_mb * 1024 * 1024

    if size_bytes > max_size:
        raise HTTPException(
            status_code=400,
            detail=f"File too large. Maximum size: {settings.max_file_size_mb}MB",
        )

    # Save file
    file_id = str(uuid.uuid4())
    file_path = os.path.join(settings.upload_dir, f"{file_id}{ext}")

    with open(file_path, "wb") as f:
        f.write(content)

    try:
        # Process document
        chunks, page_count, doc_id = processor.process_file(
            file_path, file.filename, chunk_size, chunk_overlap
        )

        # Enrich chunk metadata with upload info for persistence
        uploaded_at = datetime.now(timezone.utc).isoformat()
        for chunk in chunks:
            chunk.metadata["uploaded_at"] = uploaded_at
            chunk.metadata["size_bytes"] = size_bytes

        # Add to vector store
        vector_store.add_documents(chunks)

        # Register document
        doc_info = DocumentInfo(
            id=doc_id,
            filename=file.filename,
            file_type=ext.lstrip("."),
            page_count=page_count,
            chunk_count=len(chunks),
            uploaded_at=uploaded_at,
            size_bytes=size_bytes,
        )
        document_registry[doc_id] = doc_info

        return doc_info

    except Exception as e:
        # Clean up on failure
        if os.path.exists(file_path):
            os.remove(file_path)
        raise HTTPException(status_code=500, detail=f"Error processing document: {str(e)}")


@app.get("/api/documents", response_model=list[DocumentInfo])
async def list_documents():
    """List all uploaded documents."""
    return list(document_registry.values())


@app.post("/api/documents/text", response_model=DocumentInfo)
async def add_text_document(request: TextInputRequest):
    """Add a plain text document."""
    if not request.content.strip():
        raise HTTPException(status_code=400, detail="Text content cannot be empty.")
    if not request.title.strip():
        raise HTTPException(status_code=400, detail="Title cannot be empty.")

    try:
        chunks, page_count, doc_id = processor.process_raw_text(
            text=request.content,
            title=request.title,
            chunk_size=request.chunk_size,
            chunk_overlap=request.chunk_overlap,
        )

        # Enrich chunk metadata with upload info for persistence
        uploaded_at = datetime.now(timezone.utc).isoformat()
        size_bytes = len(request.content.encode("utf-8"))
        for chunk in chunks:
            chunk.metadata["uploaded_at"] = uploaded_at
            chunk.metadata["size_bytes"] = size_bytes

        vector_store.add_documents(chunks)

        doc_info = DocumentInfo(
            id=doc_id,
            filename=request.title,
            file_type="text",
            page_count=page_count,
            chunk_count=len(chunks),
            uploaded_at=uploaded_at,
            size_bytes=size_bytes,
        )
        document_registry[doc_id] = doc_info

        return doc_info

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error processing text: {str(e)}")


@app.delete("/api/documents/{doc_id}", response_model=DeleteResponse)
async def delete_document(doc_id: str):
    """Delete a document and its chunks."""
    if doc_id not in document_registry:
        raise HTTPException(status_code=404, detail="Document not found")

    # Remove from vector store
    success = vector_store.delete_document(doc_id)

    # Remove from registry
    del document_registry[doc_id]

    return DeleteResponse(
        success=success,
        message="Document deleted successfully" if success else "Partial deletion",
    )


@app.post("/api/chat", response_model=ChatResponse)
async def chat(request: ChatRequest):
    """Ask a question about uploaded documents."""
    if not document_registry and vector_store.get_collection_count() == 0:
        raise HTTPException(
            status_code=400,
            detail="No documents uploaded. Please upload at least one document first.",
        )

    if not request.question.strip():
        raise HTTPException(status_code=400, detail="Question cannot be empty.")

    try:
        response = await rag_chain.query(
            question=request.question,
            document_ids=request.document_ids,
        )
        return response
    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Error generating answer: {str(e)}"
        )


# --- Serve frontend static files in production ---
STATIC_DIR = Path(__file__).resolve().parent.parent / "static"

if STATIC_DIR.is_dir():
    app.mount("/assets", StaticFiles(directory=STATIC_DIR / "assets"), name="assets")

    @app.get("/{full_path:path}")
    async def serve_spa(full_path: str):
        """Serve React SPA — any non-API route returns index.html."""
        file_path = STATIC_DIR / full_path
        if file_path.is_file():
            return FileResponse(file_path)
        return FileResponse(STATIC_DIR / "index.html")
