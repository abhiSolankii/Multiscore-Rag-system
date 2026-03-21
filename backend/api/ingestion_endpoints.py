"""
Ingestion API endpoints.
All endpoints are protected — require authenticated user.

Routes:
  POST   /api/ingest/file              Upload a PDF
  POST   /api/ingest/url               Ingest a web URL
  POST   /api/ingest/github            Ingest a GitHub repo
  GET    /api/ingest/status/{task_id}  Poll job status
  GET    /api/ingest/documents         List user's documents
  DELETE /api/ingest/document/{doc_id} Delete a document + its vectors
"""
from __future__ import annotations

import uuid
import asyncio
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, status

from api.deps import get_current_user
from core.logging import get_logger
from schemas.ingestion import (
    IngestURLRequest,
    IngestGitHubRequest,
    IngestResponse,
    IngestionJobStatus,
    DocumentListItem,
)
from ingestion.job_tracker import (
    create_job,
    get_job,
    list_jobs,
    list_public_jobs,
    delete_job,
    get_job_by_document,
)
from ingestion.pipeline import run_ingestion, _delete_raw_files
from db.vector_db import get_collection_name, delete_by_document_id

router = APIRouter()
logger = get_logger(__name__)


# ── Helper ────────────────────────────────────────────────────────────────────

def _make_task_and_doc_ids():
    return str(uuid.uuid4()), str(uuid.uuid4())


def _format_job(job: dict) -> dict:
    """Rename MongoDB _id → task_id for response."""
    job["task_id"] = str(job.pop("_id"))
    return job


# ── Ingest: PDF file ──────────────────────────────────────────────────────────

@router.post("/file", response_model=IngestResponse, status_code=status.HTTP_202_ACCEPTED)
async def ingest_file(
    file: UploadFile = File(...),
    is_public: bool = Form(False),
    current_user: dict = Depends(get_current_user),
):
    """Upload a PDF and ingest it into the vector store."""
    if not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files are supported.")

    task_id, document_id = _make_task_and_doc_ids()
    user_id = current_user["_id"]
    file_bytes = await file.read()

    await create_job(
        task_id=task_id,
        document_id=document_id,
        user_id=user_id,
        source=file.filename,
        source_type="pdf",
        is_public=is_public,
    )
    logger.info("Ingest queued: task=%s doc=%s file=%s user=%s", task_id, document_id, file.filename, user_id)

    asyncio.create_task(
        run_ingestion(
            task_id=task_id,
            document_id=document_id,
            source_type="pdf",
            user_id=user_id,
            is_public=is_public,
            pdf_bytes=file_bytes,
            pdf_filename=file.filename,
        )
    )

    return IngestResponse(
        task_id=task_id,
        document_id=document_id,
        status="processing",
        message=f"Ingestion started for '{file.filename}'.",
    )


# ── Ingest: Web URL ───────────────────────────────────────────────────────────

@router.post("/url", response_model=IngestResponse, status_code=status.HTTP_202_ACCEPTED)
async def ingest_url(
    body: IngestURLRequest,
    current_user: dict = Depends(get_current_user),
):
    """Ingest content from a web URL."""
    task_id, document_id = _make_task_and_doc_ids()
    user_id = current_user["_id"]

    await create_job(
        task_id=task_id,
        document_id=document_id,
        user_id=user_id,
        source=body.url,
        source_type="web",
        is_public=body.is_public,
    )
    logger.info("Ingest queued: task=%s doc=%s url=%s user=%s", task_id, document_id, body.url, user_id)

    asyncio.create_task(
        run_ingestion(
            task_id=task_id,
            document_id=document_id,
            source_type="web",
            user_id=user_id,
            is_public=body.is_public,
            url=body.url,
        )
    )

    return IngestResponse(
        task_id=task_id,
        document_id=document_id,
        status="processing",
        message=f"Ingestion started for URL: {body.url}",
    )


# ── Ingest: GitHub repo ───────────────────────────────────────────────────────

@router.post("/github", response_model=IngestResponse, status_code=status.HTTP_202_ACCEPTED)
async def ingest_github(
    body: IngestGitHubRequest,
    current_user: dict = Depends(get_current_user),
):
    """Ingest text files from a GitHub repository."""
    task_id, document_id = _make_task_and_doc_ids()
    user_id = current_user["_id"]

    await create_job(
        task_id=task_id,
        document_id=document_id,
        user_id=user_id,
        source=body.repo_url,
        source_type="github",
        is_public=body.is_public,
    )
    logger.info("Ingest queued: task=%s doc=%s repo=%s user=%s", task_id, document_id, body.repo_url, user_id)

    asyncio.create_task(
        run_ingestion(
            task_id=task_id,
            document_id=document_id,
            source_type="github",
            user_id=user_id,
            is_public=body.is_public,
            github_url=body.repo_url,
        )
    )

    return IngestResponse(
        task_id=task_id,
        document_id=document_id,
        status="processing",
        message=f"Ingestion started for repo: {body.repo_url}",
    )


# ── Status polling ────────────────────────────────────────────────────────────

@router.get("/status/{task_id}", response_model=IngestionJobStatus)
async def get_ingestion_status(
    task_id: str,
    current_user: dict = Depends(get_current_user),
):
    """Poll the status of an ingestion job."""
    job = await get_job(task_id, current_user["_id"])
    if not job:
        raise HTTPException(status_code=404, detail="Job not found.")
    return _format_job(job)


# ── List documents ────────────────────────────────────────────────────────────

@router.get("/documents", response_model=list[DocumentListItem])
async def list_documents(
    type: str | None = None,
    current_user: dict = Depends(get_current_user),
):
    """
    List documents ingested by the current user.

    Optional query params:
      ?type=pdf       → only PDFs
      ?type=web       → only web URLs
      ?type=github    → only GitHub repos
    """
    jobs = await list_jobs(current_user["_id"], source_type=type)
    return [_format_job(j) for j in jobs]


@router.get("/documents/public", response_model=list[DocumentListItem])
async def list_public_documents(
    type: str | None = None,
    current_user: dict = Depends(get_current_user),
):
    """
    Browse ALL public documents (contributed by any user to the shared KB).
    Useful to see what's available before using include_public=true in chat.

    Optional query params:
      ?type=pdf | ?type=web | ?type=github
    """
    jobs = await list_public_jobs(source_type=type)
    return [_format_job(j) for j in jobs]


# ── Delete document ───────────────────────────────────────────────────────────

@router.delete("/document/{document_id}", status_code=status.HTTP_200_OK)
async def delete_document(
    document_id: str,
    current_user: dict = Depends(get_current_user),
):
    """
    Delete a document: removes vectors from Qdrant, raw files from disk,
    and the job record from MongoDB.
    """
    user_id = current_user["_id"]

    # 1. Verify ownership
    job = await get_job_by_document(document_id, user_id)
    if not job:
        raise HTTPException(status_code=404, detail="Document not found.")

    is_public = job.get("is_public", False)
    collection_name = get_collection_name(user_id, is_public)

    # 2. Delete vectors from Qdrant
    try:
        await delete_by_document_id(collection_name, document_id)
        logger.info("Vectors deleted from collection '%s' for doc=%s", collection_name, document_id)
    except Exception as e:
        logger.error("Qdrant delete failed for doc=%s: %s", document_id, e)

    # 3. Delete raw files
    await _delete_raw_files(user_id, document_id)

    # 4. Delete job record
    await delete_job(document_id, user_id)
    logger.info("Document deleted: doc=%s user=%s", document_id, user_id)

    return {"message": f"Document '{document_id}' deleted successfully."}
