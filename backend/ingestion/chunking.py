"""
Recursive character text chunker.
Chunk size and overlap configured from env (CHUNK_SIZE, CHUNK_OVERLAP).
Token counts included per chunk using tiktoken.
"""
from __future__ import annotations

from typing import List, Dict, Any
import tiktoken
from core.config import settings
from core.logging import get_logger

logger = get_logger(__name__)

# Use cl100k_base tokenizer (works for GPT-4, text-embedding-3, and is a
# reasonable proxy for other models)
_tokenizer = tiktoken.get_encoding("cl100k_base")


def _count_tokens(text: str) -> int:
    return len(_tokenizer.encode(text))


def _split_text(text: str, size: int, overlap: int) -> List[str]:
    """
    Recursive character splitter.
    Tries to split on paragraph → line → word boundaries before brute force.
    """
    separators = ["\n\n", "\n", " ", ""]
    chunks: List[str] = []

    def _split(s: str, seps: List[str]) -> None:
        if not s.strip():
            return
        if _count_tokens(s) <= size:
            chunks.append(s.strip())
            return

        sep = seps[0] if seps else ""
        parts = s.split(sep) if sep else list(s)

        current: List[str] = []
        current_tokens = 0

        for part in parts:
            part_tokens = _count_tokens(part + sep)
            if current_tokens + part_tokens > size and current:
                # Flush current chunk
                chunk_text = sep.join(current).strip()
                if chunk_text:
                    if _count_tokens(chunk_text) > size and len(seps) > 1:
                        _split(chunk_text, seps[1:])
                    else:
                        chunks.append(chunk_text)
                # Start overlap window
                overlap_tokens = 0
                while current and overlap_tokens < overlap:
                    overlap_tokens += _count_tokens(current[-1] + sep)
                    if overlap_tokens >= overlap:
                        break
                    current.pop(0)
                current_tokens = sum(_count_tokens(p + sep) for p in current)

            current.append(part)
            current_tokens += part_tokens

        # Flush remaining
        if current:
            chunk_text = sep.join(current).strip()
            if chunk_text:
                if _count_tokens(chunk_text) > size and len(seps) > 1:
                    _split(chunk_text, seps[1:])
                else:
                    chunks.append(chunk_text)

    _split(text, separators)
    return [c for c in chunks if c.strip()]


def chunk_documents(documents: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """
    Split a list of Document dicts into smaller chunks.
    Each Document dict must have: {"content": str, "metadata": dict}

    Returns a flat list of chunk dicts:
    {
        "content": str,
        "metadata": {
            "document_id": str,
            "source": str,
            "type": str,
            "chunk_index": int,
            "token_count": int,
            ...original metadata fields...
        }
    }
    """
    size = settings.CHUNK_SIZE
    overlap = settings.CHUNK_OVERLAP
    all_chunks: List[Dict[str, Any]] = []

    for doc in documents:
        content: str = doc.get("content", "")
        metadata: Dict[str, Any] = doc.get("metadata", {})

        raw_chunks = _split_text(content, size, overlap)

        for idx, chunk_text in enumerate(raw_chunks):
            token_count = _count_tokens(chunk_text)
            chunk_meta = {
                **metadata,
                "chunk_index": idx,
                "token_count": token_count,
            }
            chunk = {"content": chunk_text, "metadata": chunk_meta}
            all_chunks.append(chunk)

            # Log every chunk at DEBUG level — actual content, not just count
            logger.debug(
                "chunk[%d] tokens=%d source=%s | %s",
                idx,
                token_count,
                metadata.get("source", "?"),
                chunk_text[:120],
            )

    # Summary at INFO — always visible
    if all_chunks:
        token_counts = [c["metadata"]["token_count"] for c in all_chunks]
        logger.info(
            "Chunking complete: %d chunks | avg=%d tok | min=%d | max=%d",
            len(all_chunks),
            sum(token_counts) // len(token_counts),
            min(token_counts),
            max(token_counts),
        )
    else:
        logger.warning("Chunking produced 0 chunks from %d documents", len(documents))

    return all_chunks
