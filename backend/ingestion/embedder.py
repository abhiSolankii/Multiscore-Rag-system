"""
Pluggable embedding service.
Controlled by EMBEDDING_PROVIDER env var: "openai" | "local"
All models configurable from env — no model names hardcoded here.
"""
from __future__ import annotations

import time
from abc import ABC, abstractmethod
from typing import List
import openai
from core.config import settings
from core.logging import get_logger

logger = get_logger(__name__)


class EmbedderBase(ABC):
    """Abstract embedding interface — swap implementations without touching callers."""

    @abstractmethod
    async def embed_many(self, texts: List[str]) -> List[List[float]]:
        """Embed a batch of texts. Returns list of float vectors."""
        ...

    @abstractmethod
    async def embed_one(self, text: str) -> List[float]:
        """Embed a single text."""
        ...


# ── OpenAI-compatible embedder ────────────────────────────────────────────────

class OpenAIEmbedder(EmbedderBase):
    """
    Calls any OpenAI-compatible /embeddings endpoint.
    Configured via:
      EMBEDDING_API_BASE  — e.g. https://api.openai.com/v1
      EMBEDDING_API_KEY   — API key for that host
      EMBEDDING_MODEL     — e.g. text-embedding-3-large
    """

    def __init__(self):
        self._client = openai.AsyncOpenAI(
            base_url=settings.EMBEDDING_API_BASE,
            api_key=settings.EMBEDDING_API_KEY or "no-key",
        )

    async def embed_many(self, texts: List[str]) -> List[List[float]]:
        if not texts:
            return []
        logger.debug(
            "Embedding %d texts via OpenAI-compatible API | model=%s",
            len(texts), settings.EMBEDDING_MODEL,
        )
        t0 = time.perf_counter()
        response = await self._client.embeddings.create(
            model=settings.EMBEDDING_MODEL,
            input=texts,
        )
        elapsed = time.perf_counter() - t0
        # Sort by index to guarantee order
        vectors = [item.embedding for item in sorted(response.data, key=lambda x: x.index)]
        if vectors:
            logger.debug(
                "Embedding done: model=%s | batch=%d | dim=%d | took=%.2fs | vector[0][:5]=%s",
                settings.EMBEDDING_MODEL, len(vectors), len(vectors[0]),
                elapsed, [round(v, 4) for v in vectors[0][:5]],
            )
        return vectors

    async def embed_one(self, text: str) -> List[float]:
        results = await self.embed_many([text])
        return results[0]


# ── Local sentence-transformers embedder ─────────────────────────────────────

class LocalEmbedder(EmbedderBase):
    """
    Uses sentence-transformers locally (no API key needed).
    Model is configurable via EMBEDDING_MODEL env var.
    """

    def __init__(self):
        # Lazy import — only pay the heavy import cost if local is actually used
        from sentence_transformers import SentenceTransformer
        logger.debug("Loading local embedding model: %s", settings.EMBEDDING_MODEL)
        self._model = SentenceTransformer(settings.EMBEDDING_MODEL)
        logger.debug("Local model loaded: %s", settings.EMBEDDING_MODEL)

    async def embed_many(self, texts: List[str]) -> List[List[float]]:
        if not texts:
            return []
        logger.debug(
            "Embedding %d texts locally | model=%s",
            len(texts), settings.EMBEDDING_MODEL,
        )
        t0 = time.perf_counter()
        embeddings = self._model.encode(texts, convert_to_numpy=True, normalize_embeddings=True)
        elapsed = time.perf_counter() - t0
        vectors = embeddings.tolist()
        if vectors:
            logger.debug(
                "Embedding done: model=%s | batch=%d | dim=%d | took=%.2fs | vector[0][:5]=%s",
                settings.EMBEDDING_MODEL, len(vectors), len(vectors[0]),
                elapsed, [round(v, 4) for v in vectors[0][:5]],
            )
        return vectors

    async def embed_one(self, text: str) -> List[float]:
        results = await self.embed_many([text])
        return results[0]


# ── Factory ───────────────────────────────────────────────────────────────────

_embedder_instance: EmbedderBase | None = None


def get_embedder() -> EmbedderBase:
    """
    Returns (and caches) the configured embedder.
    EMBEDDING_PROVIDER=openai → OpenAIEmbedder
    EMBEDDING_PROVIDER=local  → LocalEmbedder
    """
    global _embedder_instance
    if _embedder_instance is None:
        provider = settings.EMBEDDING_PROVIDER.lower()
        logger.debug("Initialising embedder: provider=%s model=%s", provider, settings.EMBEDDING_MODEL)
        if provider == "openai":
            _embedder_instance = OpenAIEmbedder()
        elif provider == "local":
            _embedder_instance = LocalEmbedder()
        else:
            raise ValueError(
                f"Unknown EMBEDDING_PROVIDER='{provider}'. Valid: openai | local"
            )
    return _embedder_instance
