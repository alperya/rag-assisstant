from pydantic import BaseModel
from typing import Optional
from datetime import datetime


class DocumentInfo(BaseModel):
    id: str
    filename: str
    file_type: str
    page_count: Optional[int] = None
    chunk_count: int = 0
    uploaded_at: str
    size_bytes: int


class TextInputRequest(BaseModel):
    title: str
    content: str
    chunk_size: Optional[int] = None
    chunk_overlap: Optional[int] = None


class ChatRequest(BaseModel):
    question: str
    document_ids: Optional[list[str]] = None


class SourceReference(BaseModel):
    document_name: str
    page_number: Optional[int] = None
    content_preview: str


class ChatResponse(BaseModel):
    answer: str
    sources: list[SourceReference]
    confidence: str  # "high", "medium", "low"


class DeleteResponse(BaseModel):
    success: bool
    message: str
