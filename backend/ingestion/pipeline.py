"""
Ingestion pipeline orchestrator.
Runs: load → save raw file → chunk → embed → upsert to Qdrant → update status.

Usage:
    from ingestion.pipeline import run_ingestion
    asyncio.create_task(run_ingestion(...))   # fire-and-forget with internal try/catch
"""
from __future__ import annotations

import uuid
import os
import asyncio
import aiofiles
from typing import Literal
from datetime import datetime

from core.config import settings
from core.logging import get_logger
from ingestion.pdf_loader import load_pdf
from ingestion.web_loader import load_url
from ingestion.github_loader import load_github_repo
from ingestion.chunking import chunk_documents
from ingestion.embedder import get_embedder
from ingestion.job_tracker import create_job, mark_done, mark_failed
from db.vector_db import get_qdrant_client, ensure_collection, get_collection_name
from qdrant_client.models import PointStruct

logger = get_logger(__name__)
SourceType = Literal["pdf", "web", "github"]


# ── Raw file storage ─────────────────────────────────────────────────────────

async def _save_raw_file(
    content: bytes,
    user_id: str,
    document_id: str,
    filename: str,
) -> str:
    """
    Save raw file bytes to:
      {UPLOAD_DIR}/{user_id}/{document_id}/{filename}

    Returns the absolute path.
    """
    directory = os.path.join(settings.UPLOAD_DIR, user_id, document_id)
    os.makedirs(directory, exist_ok=True)
    file_path = os.path.join(directory, filename)
    async with aiofiles.open(file_path, "wb") as f:
        await f.write(content)
    return file_path


async def _delete_raw_files(user_id: str, document_id: str) -> None:
    """Remove the raw file directory for a document."""
    import shutil
    directory = os.path.join(settings.UPLOAD_DIR, user_id, document_id)
    if os.path.exists(directory):
        shutil.rmtree(directory)


# ── Main ingestion entry point ────────────────────────────────────────────────

async def run_ingestion(
    *,
    task_id: str,
    document_id: str,
    source_type: SourceType,
    user_id: str,
    is_public: bool,
    # Source-specific payloads (only one will be set)
    pdf_bytes: bytes | None = None,
    pdf_filename: str | None = None,
    url: str | None = None,
    github_url: str | None = None,
) -> None:
    """
    Full ingestion pipeline — runs inside asyncio.create_task.
    Updates job status in MongoDB on completion or failure.
    """
    try:
        logger.info(
            "Ingestion started: task=%s doc=%s source_type=%s user=%s is_public=%s",
            task_id, document_id, source_type, user_id, is_public,
        )

        # 1. Load documents from source
        if source_type == "pdf":
            assert pdf_bytes and pdf_filename
            await _save_raw_file(pdf_bytes, user_id, document_id, pdf_filename)
            docs = load_pdf(pdf_bytes, pdf_filename, document_id, user_id, is_public)
            source_label = pdf_filename
            logger.debug("PDF loaded: %d pages from %s", len(docs), pdf_filename)

        elif source_type == "web":
            assert url
            docs = await load_url(url, document_id, user_id, is_public)
            raw_text = docs[0]["content"].encode() if docs else b""
            await _save_raw_file(raw_text, user_id, document_id, "page.txt")
            source_label = url
            logger.debug("Web page loaded: %d chars from %s", len(raw_text), url)

        elif source_type == "github":
            assert github_url
            docs = await load_github_repo(github_url, document_id, user_id, is_public)
            manifest = "\n".join(d["metadata"].get("file_path", "") for d in docs)
            await _save_raw_file(manifest.encode(), user_id, document_id, "manifest.txt")
            source_label = github_url
            logger.debug("GitHub repo loaded: %d files from %s", len(docs), github_url)

        else:
            raise ValueError(f"Unknown source_type: {source_type}")

        if not docs:
            raise ValueError("No content could be extracted from the source.")

        # 2. Chunk
        chunks = chunk_documents(docs)
        if not chunks:
            raise ValueError("Chunking produced no output.")
        logger.info("Chunked into %d chunks (task=%s)", len(chunks), task_id)

        # 3. Embed
        embedder = get_embedder()
        texts = [c["content"] for c in chunks]
        vectors = await embedder.embed_many(texts)
        logger.info("Embedded %d chunks (task=%s)", len(vectors), task_id)

        # 4. Determine collection and ensure it exists with correct dimensions
        vector_size = len(vectors[0]) if vectors else 0
        collection_name = get_collection_name(user_id, is_public)
        await ensure_collection(collection_name, vector_size)

        # 5. Upsert into Qdrant
        client = get_qdrant_client()
        points = [
            PointStruct(
                id=str(uuid.uuid4()),
                vector=vectors[i],
                payload={
                    "content": chunks[i]["content"],
                    **chunks[i]["metadata"],
                },
            )
            for i in range(len(chunks))
        ]

        batch_size = 100
        for batch_start in range(0, len(points), batch_size):
            batch = points[batch_start : batch_start + batch_size]
            await client.upsert(collection_name=collection_name, points=batch)
        logger.info(
            "Upserted %d vectors into collection '%s' (task=%s)",
            len(points), collection_name, task_id,
        )

        # 6. Mark done
        await mark_done(task_id, chunks_ingested=len(chunks))
        logger.info(
            "Ingestion complete: task=%s doc=%s chunks=%d",
            task_id, document_id, len(chunks),
        )

    except Exception as exc:
        error_msg = str(exc)
        logger.error(
            "Ingestion failed: task=%s doc=%s error=%s",
            task_id, document_id, error_msg, exc_info=True,
        )
        await mark_failed(task_id, error=error_msg)
