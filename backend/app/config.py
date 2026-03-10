from functools import lru_cache

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    anthropic_api_key: str = ""
    chroma_persist_dir: str = "./chroma_data"
    upload_dir: str = "./uploads"
    max_file_size_mb: int = 50
    chunk_size: int = 1500
    chunk_overlap: int = 300
    llm_model: str = "claude-sonnet-4-20250514"

    # Lambda / S3 — set S3_BUCKET to enable serverless mode
    s3_bucket: str = ""

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"


@lru_cache()
def get_settings() -> Settings:
    return Settings()
