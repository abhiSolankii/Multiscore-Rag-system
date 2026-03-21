from pydantic import BaseModel, HttpUrl
from typing import Optional, Literal
from datetime import datetime


# ── Ingestion Request Models ─────────────────────────────────────────────────

class IngestURLRequest(BaseModel):
    url: str
    is_public: bool = False


class IngestGitHubRequest(BaseModel):
    repo_url: str
    is_public: bool = False


# ── Response Models ───────────────────────────────────────────────────────────

class IngestResponse(BaseModel):
    task_id: str
    document_id: str
    status: Literal["processing", "done", "failed"]
    message: str


class IngestionJobStatus(BaseModel):
    task_id: str
    document_id: str
    source: str
    type: Literal["pdf", "web", "github"]
    is_public: bool
    status: Literal["processing", "done", "failed"]
    chunks_ingested: int = 0
    error: Optional[str] = None
    created_at: datetime
    updated_at: datetime


class DocumentListItem(BaseModel):
    document_id: str
    source: str
    type: Literal["pdf", "web", "github"]
    is_public: bool
    status: Literal["processing", "done", "failed"]
    chunks_ingested: int = 0
    created_at: datetime
