"""
BM25 hybrid search + Reciprocal Rank Fusion (RRF).
Re-scores vector candidates in memory — no separate index needed.
Enabled via HYBRID_SEARCH_ENABLED env var.
"""
from __future__ import annotations

from typing import List, Dict, Any
from rank_bm25 import BM25Okapi


def _tokenize(text: str) -> List[str]:
    """Simple whitespace + lowercase tokenizer."""
    return text.lower().split()


def hybrid_search(
    query: str,
    candidates: List[Dict[str, Any]],
    top_k: int,
    rrf_k: int = 60,
) -> List[Dict[str, Any]]:
    """
    Re-rank a list of vector search candidates using BM25 + RRF merge.

    Args:
        query: Raw user query text
        candidates: Output from vector_search (dicts with "content", "score", "metadata")
        top_k: Number of final results to return
        rrf_k: RRF constant (60 is standard)

    Returns:
        Re-ranked list of candidates, same dict shape as input.
    """
    if not candidates:
        return candidates

    # ── BM25 ranking ────────────────────────────────────────────────────────
    tokenized_corpus = [_tokenize(c["content"]) for c in candidates]
    bm25 = BM25Okapi(tokenized_corpus)
    bm25_scores = bm25.get_scores(_tokenize(query))

    # Rank by BM25 score (higher = better)
    bm25_ranked = sorted(range(len(candidates)), key=lambda i: bm25_scores[i], reverse=True)
    bm25_rank = {idx: rank for rank, idx in enumerate(bm25_ranked)}

    # ── Vector ranking ───────────────────────────────────────────────────────
    # Already ranked by cosine score from vector_search; reconstruct rank map
    vector_ranked = sorted(range(len(candidates)), key=lambda i: candidates[i]["score"], reverse=True)
    vector_rank = {idx: rank for rank, idx in enumerate(vector_ranked)}

    # ── RRF fusion ───────────────────────────────────────────────────────────
    def rrf_score(i: int) -> float:
        return 1.0 / (rrf_k + vector_rank[i]) + 1.0 / (rrf_k + bm25_rank[i])

    fused = sorted(range(len(candidates)), key=rrf_score, reverse=True)

    return [candidates[i] for i in fused[:top_k]]
