from pydantic_settings import BaseSettings
from functools import lru_cache
import os


class Settings(BaseSettings):
    anthropic_api_key: str = ""
    chroma_persist_dir: str = "./chroma_data"
    upload_dir: str = "./uploads"
    max_file_size_mb: int = 50
    chunk_size: int = 1500
    chunk_overlap: int = 300
    llm_model: str = "claude-sonnet-4-20250514"
    embedding_model: str = "all-MiniLM-L6-v2"

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"


@lru_cache()
def get_settings() -> Settings:
    return Settings()
