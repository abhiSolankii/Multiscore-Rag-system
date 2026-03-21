"""
Vector similarity search via Qdrant.
"""
from __future__ import annotations

from typing import List, Dict, Any
from db.vector_db import get_qdrant_client
from qdrant_client.models import Filter, FieldCondition, MatchValue, MatchAny

async def vector_search(
    query_vector: List[float],
    collection_name: str,
    top_k: int,
    user_id: str | None = None,
    is_public_collection: bool = False,
    inactive_docs: List[str] | None = None,
) -> List[Dict[str, Any]]:
    """
    Search for the top_k most similar vectors in a Qdrant collection.

    Args:
        query_vector: Embedded query
        collection_name: Qdrant collection to search
        top_k: Number of results to return
        user_id: If set and not a public collection, filter by user_id as extra safety
        is_public_collection: Skip user filter for public collections
        inactive_docs: Optional list of document_ids to exclude from search

    Returns:
        List of dicts: {"content": str, "metadata": dict, "score": float}
    """
    client = get_qdrant_client()

    # Build payload filters
    must_conditions = []
    must_not_conditions = []
    
    if user_id and not is_public_collection:
        must_conditions.append(
            FieldCondition(key="user_id", match=MatchValue(value=user_id))
        )
        
    if inactive_docs:
        must_not_conditions.append(
            FieldCondition(key="document_id", match=MatchAny(any=inactive_docs))
        )

    query_filter = None
    if must_conditions or must_not_conditions:
        query_filter = Filter(must=must_conditions, must_not=must_not_conditions)

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
