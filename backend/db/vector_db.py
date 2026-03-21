"""
Qdrant vector database client.
Singleton pattern — one client shared across the app.
Pluggable: swap provider by changing VECTOR_DB_PROVIDER in .env
"""
from __future__ import annotations

from typing import Optional
from qdrant_client import AsyncQdrantClient
from qdrant_client.models import (
    Distance,
    VectorParams,
    Filter,
    FieldCondition,
    MatchValue,
)
from core.config import settings

# ── Singleton ────────────────────────────────────────────────────────────────

_client: Optional[AsyncQdrantClient] = None


def get_qdrant_client() -> AsyncQdrantClient:
    """Return the shared Qdrant async client."""
    global _client
    if _client is None:
        kwargs: dict = {"url": settings.QDRANT_URL}
        if settings.QDRANT_API_KEY:
            kwargs["api_key"] = settings.QDRANT_API_KEY
        _client = AsyncQdrantClient(**kwargs)
    return _client


# ── Collection helpers ────────────────────────────────────────────────────────

def get_collection_name(user_id: str, is_public: bool) -> str:
    """
    Returns the Qdrant collection name based on ownership AND embedding model.
    Format: {user_id or "public"}_{slugified_model_name}
    """
    # Slugify model name: replace non-alphanumeric with underscore
    import re
    model_slug = re.sub(r'[^a-zA-Z0-9]', '_', settings.EMBEDDING_MODEL).lower()
    
    base = "public" if is_public else f"user_{user_id}"
    return f"{base}_{model_slug}"


async def ensure_collection(collection_name: str, vector_size: int) -> None:
    """
    Idempotently create a Qdrant collection if it doesn't already exist.
    Uses cosine distance (standard for text embeddings).
    """
    client = get_qdrant_client()
    existing = await client.get_collections()
    existing_names = {c.name for c in existing.collections}
    if collection_name not in existing_names:
        await client.create_collection(
            collection_name=collection_name,
            vectors_config=VectorParams(
                size=vector_size,
                distance=Distance.COSINE,
            ),
        )

    # Idempotently add payload index for user_id to allow efficient (and required) filtering
    # NOTE: In recent versions of qdrant-client, create_payload_index is idempotent by default.
    await client.create_payload_index(
        collection_name=collection_name,
        field_name="user_id",
        field_schema="keyword",
    )


# ── Vector Operations ─────────────────────────────────────────────────────────

async def delete_by_document_id(collection_name: str, document_id: str) -> int:
    """
    Delete all vectors in the collection whose payload contains the given document_id.
    Returns the number of deleted points.
    """
    client = get_qdrant_client()
    result = await client.delete(
        collection_name=collection_name,
        points_selector=Filter(
            must=[
                FieldCondition(
                    key="document_id",
                    match=MatchValue(value=document_id),
                )
            ]
        ),
    )
    return result.status
