"""
Pluggable embedding service.
Controlled by EMBEDDING_PROVIDER env var: "openai" | "local"
All models configurable from env — no model names hardcoded here.
"""
from __future__ import annotations

from abc import ABC, abstractmethod
from typing import List
import openai
from core.config import settings


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
        response = await self._client.embeddings.create(
            model=settings.EMBEDDING_MODEL,
            input=texts,
        )
        # Sort by index to guarantee order
        return [item.embedding for item in sorted(response.data, key=lambda x: x.index)]

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
        self._model = SentenceTransformer(settings.EMBEDDING_MODEL)

    async def embed_many(self, texts: List[str]) -> List[List[float]]:
        if not texts:
            return []
        # sentence-transformers is sync; run in threadpool in production
        embeddings = self._model.encode(texts, convert_to_numpy=True, normalize_embeddings=True)
        return embeddings.tolist()

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
        if provider == "openai":
            _embedder_instance = OpenAIEmbedder()
        elif provider == "local":
            _embedder_instance = LocalEmbedder()
        else:
            raise ValueError(
                f"Unknown EMBEDDING_PROVIDER='{provider}'. Valid: openai | local"
            )
    return _embedder_instance
