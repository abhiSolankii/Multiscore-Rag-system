"""
Ingestion status tracking via MongoDB.
Stores task/job state so the polling endpoint always reflects reality.

Collection: ingestion_jobs
"""
from __future__ import annotations

from datetime import datetime
from typing import Optional
from db import get_database


async def create_job(
    task_id: str,
    document_id: str,
    user_id: str,
    source: str,
    source_type: str,
    is_public: bool,
) -> None:
    """Insert a new job record with status 'processing'."""
    db = get_database()
    await db.ingestion_jobs.insert_one({
        "_id": task_id,
        "document_id": document_id,
        "user_id": user_id,
        "source": source,
        "type": source_type,
        "is_public": is_public,
        "status": "processing",
        "chunks_ingested": 0,
        "error": None,
        "created_at": datetime.utcnow(),
        "updated_at": datetime.utcnow(),
    })


async def mark_done(task_id: str, chunks_ingested: int) -> None:
    """Mark a job as successfully completed."""
    db = get_database()
    await db.ingestion_jobs.update_one(
        {"_id": task_id},
        {"$set": {
            "status": "done",
            "chunks_ingested": chunks_ingested,
            "updated_at": datetime.utcnow(),
        }},
    )


async def mark_failed(task_id: str, error: str) -> None:
    """Mark a job as failed with an error message."""
    db = get_database()
    await db.ingestion_jobs.update_one(
        {"_id": task_id},
        {"$set": {
            "status": "failed",
            "error": error,
            "updated_at": datetime.utcnow(),
        }},
    )


async def get_job(task_id: str, user_id: str) -> Optional[dict]:
    """Fetch a job record, ensuring it belongs to the requesting user."""
    db = get_database()
    return await db.ingestion_jobs.find_one({"_id": task_id, "user_id": user_id})


async def get_job_by_document(document_id: str, user_id: str) -> Optional[dict]:
    """Fetch a job by document_id (used for delete ownership check)."""
    db = get_database()
    return await db.ingestion_jobs.find_one({"document_id": document_id, "user_id": user_id})


async def list_jobs(user_id: str, source_type: str | None = None) -> list[dict]:
    """
    List all ingestion jobs for a user, newest first.
    Optionally filter by source type: 'pdf' | 'web' | 'github'
    """
    db = get_database()
    query: dict = {"user_id": user_id}
    if source_type:
        query["type"] = source_type
    cursor = db.ingestion_jobs.find(query).sort("created_at", -1)
    jobs = await cursor.to_list(length=200)
    return jobs


async def list_public_jobs(source_type: str | None = None) -> list[dict]:
    """
    List all public documents across all users, newest first.
    These are docs ingested with is_public=True.
    Optionally filter by source type.
    """
    db = get_database()
    query: dict = {"is_public": True, "status": "done"}
    if source_type:
        query["type"] = source_type
    cursor = db.ingestion_jobs.find(query).sort("created_at", -1)
    jobs = await cursor.to_list(length=500)
    return jobs


async def delete_job(document_id: str, user_id: str) -> None:
    """Delete the job record for a document."""
    db = get_database()
    await db.ingestion_jobs.delete_one({"document_id": document_id, "user_id": user_id})
