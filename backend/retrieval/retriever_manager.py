"""
Retriever manager — main entry point for the retrieval layer.

Orchestrates:
  1. Embed the query
  2. Vector search (private + optionally public)
  3. Hybrid BM25 re-ranking (if HYBRID_SEARCH_ENABLED)
  4. Deduplication by content hash
  5. Cross-encoder reranking (if RERANKER_ENABLED)
  6. Return top_k results
"""
from __future__ import annotations

import hashlib
from typing import List, Dict, Any

from core.config import settings
from core.logging import get_logger
from ingestion.embedder import get_embedder
from db.vector_db import get_collection_name
from retrieval.vector_search import vector_search
from retrieval.hybrid_search import hybrid_search
from retrieval.reranker import get_reranker

logger = get_logger(__name__)


def _deduplicate(candidates: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """Remove duplicate chunks by content hash, preserving order."""
    seen: set = set()
    unique: List[Dict[str, Any]] = []
    for c in candidates:
        h = hashlib.md5(c["content"].encode()).hexdigest()
        if h not in seen:
            seen.add(h)
            unique.append(c)
    return unique


async def retrieve(
    query: str,
    user_id: str,
    include_public: bool = False,
    inactive_docs: List[str] = None,
    top_k: int | None = None,
) -> List[Dict[str, Any]]:
    """
    Retrieve the most relevant chunks for a query.

    Args:
        query        : Raw user query
        user_id      : Requesting user (for private collection)
        include_public: Also search the shared public collection
        top_k        : Number of final chunks (defaults to RETRIEVAL_TOP_K)

    Returns:
        List of chunk dicts: {"content": str, "score": float, "metadata": dict}
    """
    if top_k is None:
        top_k = settings.RETRIEVAL_TOP_K

    logger.debug(
        "Retrieve called: query='%s' | user=%s | include_public=%s | top_k=%d",
        query, user_id, include_public, top_k,
    )

    # 1. Embed query
    embedder = get_embedder()
    query_vector = await embedder.embed_one(query)

    # 2. Vector search — private collection
    private_collection = get_collection_name(user_id, is_public=False)
    candidates: List[Dict[str, Any]] = []

    try:
        private_results = await vector_search(
            query_vector=query_vector,
            collection_name=private_collection,
            top_k=top_k * 3,
            user_id=user_id,
            is_public_collection=False,
            inactive_docs=inactive_docs,
        )
        candidates.extend(private_results)
        logger.debug(
            "Private vector search: %d results from '%s'",
            len(private_results), private_collection,
        )
        for i, r in enumerate(private_results):
            logger.debug(
                "  private[%d] score=%.4f | source=%s | chunk_index=%s | %.120s",
                i,
                r.get("score", 0),
                r.get("metadata", {}).get("source", "?"),
                r.get("metadata", {}).get("chunk_index", "?"),
                r.get("content", ""),
            )
    except Exception as e:
        logger.warning("Private collection '%s' not found or search failed: %s", private_collection, e)

    # 3. Optionally merge public collection results
    if include_public:
        public_collection = get_collection_name(user_id, is_public=True)
        try:
            public_results = await vector_search(
                query_vector=query_vector,
                collection_name=public_collection,
                top_k=top_k * 2,
                user_id=None,
                is_public_collection=True,
                inactive_docs=inactive_docs,
            )
            candidates.extend(public_results)
            logger.debug(
                "Public vector search: %d results from '%s'",
                len(public_results), public_collection,
            )
            for i, r in enumerate(public_results):
                logger.debug(
                    "  public[%d] score=%.4f | source=%s | %.120s",
                    i,
                    r.get("score", 0),
                    r.get("metadata", {}).get("source", "?"),
                    r.get("content", ""),
                )
        except Exception as e:
            logger.warning("Public collection search failed: %s", e)

    if not candidates:
        logger.info("No candidates found for user %s", user_id)
        return []

    # 4. Deduplication
    before = len(candidates)
    candidates = _deduplicate(candidates)
    logger.debug("Deduplication: %d → %d candidates", before, len(candidates))

    # 5. Hybrid BM25 re-ranking
    if settings.HYBRID_SEARCH_ENABLED:
        candidates = hybrid_search(query, candidates, top_k=min(top_k * 3, len(candidates)))
        logger.debug("Hybrid BM25+RRF applied: %d candidates", len(candidates))

    # 6. Cross-encoder reranking (optional)
    reranker = get_reranker()
    if reranker:
        candidates = reranker.rerank(query, candidates, top_k=top_k)
        logger.debug("Reranker applied: %d final candidates", len(candidates))
    else:
        candidates = candidates[:top_k]

    # Final results summary
    logger.info("Retrieval complete: %d final chunks returned for user %s", len(candidates), user_id)
    logger.debug("Final chunks passed to LLM:")
    for i, c in enumerate(candidates):
        logger.debug(
            "  final[%d] score=%.4f | source=%s | tokens=%s | %.150s",
            i,
            c.get("score", 0),
            c.get("metadata", {}).get("source", "?"),
            c.get("metadata", {}).get("token_count", "?"),
            c.get("content", ""),
        )

    return candidates
