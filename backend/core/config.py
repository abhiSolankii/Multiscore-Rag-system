from pydantic_settings import BaseSettings, SettingsConfigDict
from typing import Optional

class Settings(BaseSettings):
    PROJECT_NAME: str = "Multiscore RAG"
    
    # MongoDB
    MONGODB_URL: str = "mongodb://localhost:27017"
    DATABASE_NAME: str = "multiscore_rag"
    
    # JWT
    SECRET_KEY: str = "your-super-secret-key-here"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 120
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7

    # Chat & LLM Settings (via OpenRouter)
    MAX_HISTORY_MESSAGES: int = 5
    OPENROUTER_API_KEY: Optional[str] = None
    LLM_MODEL: str = "deepseek/deepseek-chat"

    # ── RAG ──────────────────────────────────────────────────────────────────

    # Master switch
    RAG_ENABLED: bool = False

    # Vector DB
    VECTOR_DB_PROVIDER: str = "qdrant"          # qdrant | (weaviate later)
    QDRANT_URL: str = "http://localhost:6333"
    QDRANT_API_KEY: Optional[str] = None
    QDRANT_COLLECTION_NAME: str = "multiscore_docs"

    # Embedding — OpenAI-compatible API (NOT OpenRouter; see RAG_README)
    EMBEDDING_PROVIDER: str = "openai"           # openai | local
    EMBEDDING_MODEL: str = "text-embedding-3-large"
    EMBEDDING_API_BASE: str = "https://api.openai.com/v1"
    EMBEDDING_API_KEY: Optional[str] = None      # separate from OPENROUTER_API_KEY

    # Reranker — runs locally, no API key needed
    RERANKER_ENABLED: bool = False
    RERANKER_MODEL: str = "BAAI/bge-reranker-large"

    # Chunking
    CHUNK_SIZE: int = 512
    CHUNK_OVERLAP: int = 64

    # Retrieval
    RETRIEVAL_TOP_K: int = 5
    HYBRID_SEARCH_ENABLED: bool = True

    # File storage
    UPLOAD_DIR: str = "./uploads"

    # Logging
    DEBUG_LOGGING: bool = False  # set True to see DEBUG level output

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

settings = Settings()
