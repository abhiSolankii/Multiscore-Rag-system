"""
Vector similarity search via Qdrant.
"""
from __future__ import annotations

from typing import List, Dict, Any
from db.vector_db import get_qdrant_client
from qdrant_client.models import Filter, FieldCondition, MatchValue


async def vector_search(
    query_vector: List[float],
    collection_name: str,
    top_k: int,
    user_id: str | None = None,
    is_public_collection: bool = False,
) -> List[Dict[str, Any]]:
    """
    Search for the top_k most similar vectors in a Qdrant collection.

    Args:
        query_vector: Embedded query
        collection_name: Qdrant collection to search
        top_k: Number of results to return
        user_id: If set and not a public collection, filter by user_id as extra safety
        is_public_collection: Skip user filter for public collections

    Returns:
        List of dicts: {"content": str, "metadata": dict, "score": float}
    """
    client = get_qdrant_client()

    # Build an optional payload filter
    query_filter = None
    if user_id and not is_public_collection:
        query_filter = Filter(
            must=[
                FieldCondition(key="user_id", match=MatchValue(value=user_id))
            ]
        )

    results = await client.query_points(
        collection_name=collection_name,
        query=query_vector,
        limit=top_k,
        query_filter=query_filter,
        with_payload=True,
        with_vectors=False,
    )

    return [
        {
            "content": hit.payload.get("content", ""),
            "score": hit.score,
            "metadata": {k: v for k, v in hit.payload.items() if k != "content"},
        }
        for hit in results.points
    ]
