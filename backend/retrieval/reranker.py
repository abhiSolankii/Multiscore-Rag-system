"""
Cross-encoder reranker.
Pluggable: controlled by RERANKER_ENABLED and RERANKER_MODEL env vars.
Runs locally — no API key needed.
"""
from __future__ import annotations

from abc import ABC, abstractmethod
from typing import List, Dict, Any, Optional
from core.config import settings


class RerankerBase(ABC):
    @abstractmethod
    def rerank(self, query: str, candidates: List[Dict[str, Any]], top_k: int) -> List[Dict[str, Any]]:
        ...


class BGEReranker(RerankerBase):
    """
    Cross-encoder reranker using sentence-transformers.
    Model configurable via RERANKER_MODEL (e.g. BAAI/bge-reranker-large).
    """

    def __init__(self):
        from sentence_transformers import CrossEncoder
        self._model = CrossEncoder(settings.RERANKER_MODEL)

    def rerank(
        self,
        query: str,
        candidates: List[Dict[str, Any]],
        top_k: int,
    ) -> List[Dict[str, Any]]:
        if not candidates:
            return candidates

        # Score each candidate
        pairs = [(query, c["content"]) for c in candidates]
        scores = self._model.predict(pairs)

        # Attach reranker score and sort descending
        for i, c in enumerate(candidates):
            c["reranker_score"] = float(scores[i])

        reranked = sorted(candidates, key=lambda x: x["reranker_score"], reverse=True)
        return reranked[:top_k]


# ── Factory ───────────────────────────────────────────────────────────────────

_reranker_instance: Optional[RerankerBase] = None


def get_reranker() -> Optional[RerankerBase]:
    """
    Returns the configured reranker, or None if disabled.
    RERANKER_ENABLED=false → returns None (skip reranking step)
    """
    global _reranker_instance
    if not settings.RERANKER_ENABLED:
        return None
    if _reranker_instance is None:
        _reranker_instance = BGEReranker()
    return _reranker_instance
