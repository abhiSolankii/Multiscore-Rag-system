"""
Context-augmented answer generator.
Wraps the retrieval layer + prompt builder + LLM call into one clean interface.
Falls back to plain LLM if RAG is disabled or no context found.
"""
from __future__ import annotations

from typing import List, Dict, Tuple, Optional

from core.config import settings
from core.logging import get_logger
from generation.llm import generate_chat_response, generate_chat_stream
from generation.prompt_templates import build_rag_system_prompt, PLAIN_SYSTEM_PROMPT
from retrieval.retriever_manager import retrieve
from retrieval.query_rewriter import decompose_query

logger = get_logger(__name__)


# ── Helpers ─────────────────────────────────────────────────────────────────

async def _decompose_query_step(query: str) -> Tuple[List[str], dict]:
    """Helper to handle query decomposition."""
    return await decompose_query(query)

# ── Main Generator Functions ───────────────────────────────────────────────

async def generate_rag_response(
    query: str,
    conversation_history: List[Dict[str, str]],
    user_id: str,
    include_public: bool = False,
    mode: str = "hybrid",
    inactive_docs: List[str] | None = None,
    max_token_limit: Optional[int] = None,
) -> Tuple[str, Optional[List[Dict]], Optional[dict]]:
    """
    Generate an answer, optionally augmented with retrieved context.

    Flow:
        1. If RAG_ENABLED=false → plain LLM call with conversation history
        2. Retrieve relevant chunks (private + optionally public)
        3. If no chunks found → fall back to plain LLM (no hallucinated citations)
        4. Build system prompt with context + citations
        5. LLM call with [system_prompt] + conversation_history
    """
    if not settings.RAG_ENABLED:
        logger.debug("RAG disabled — using plain LLM for user %s", user_id)
        content, usage = await generate_chat_response(conversation_history, max_token_limit=max_token_limit)
        return content, [], usage

    # Decompose query
    sub_queries, rewrite_usage = await _decompose_query_step(query)

    # Retrieve context
    try:
        context_chunks = await retrieve(
            query=query,
            user_id=user_id,
            include_public=include_public,
            inactive_docs=inactive_docs,
            sub_queries=sub_queries,
        )
        logger.info(
            "Retrieved %d chunks for user %s (include_public=%s)",
            len(context_chunks), user_id, include_public,
        )
    except Exception as e:
        logger.warning(
            "Retrieval failed for user %s — falling back to plain LLM: %s",
            user_id, str(e),
        )
        context_chunks = []

    if not context_chunks:
        logger.info("No context chunks retrieved for user %s. Proceeding with empty context.", user_id)

    # Build context-augmented prompt
    system_prompt = build_rag_system_prompt(context_chunks, mode=mode)

    logger.debug(
        "System prompt built (%d chars):\n%s",
        len(system_prompt),
        system_prompt,
    )

    messages = [{"role": "system", "content": system_prompt}] + conversation_history
    logger.debug(
        "Sending to LLM: %d messages total (1 system + %d history)",
        len(messages), len(conversation_history),
    )

    content, usage = await generate_chat_response(messages, max_token_limit=max_token_limit)
    
    if rewrite_usage:
        if not usage:
            usage = rewrite_usage
        else:
            usage["total_tokens"] = usage.get("total_tokens", 0) + rewrite_usage.get("total_tokens", 0)
            usage["prompt_tokens"] = usage.get("prompt_tokens", 0) + rewrite_usage.get("prompt_tokens", 0)
            usage["completion_tokens"] = usage.get("completion_tokens", 0) + rewrite_usage.get("completion_tokens", 0)
            
    return content, context_chunks, usage


async def generate_rag_stream(
    query: str,
    conversation_history: List[Dict[str, str]],
    user_id: str,
    include_public: bool = False,
    mode: str = "hybrid",
    inactive_docs: List[str] | None = None,
    max_token_limit: Optional[int] = None,
):
    """
    Generate an answer via streaming, optionally augmented with retrieved context.
    Yields text chunks.
    """
    if not settings.RAG_ENABLED:
        logger.debug("RAG disabled — using plain LLM stream for user %s", user_id)
        yield {"type": "status", "step": "calling_llm"}
        yield {"type": "status", "step": "generating"}
        async for chunk in generate_chat_stream(conversation_history, max_token_limit=max_token_limit):
            yield chunk
        return

    # Decompose query
    yield {"type": "status", "step": "rewriting_query", "meta": {"query": query}}
    sub_queries, rewrite_usage = await _decompose_query_step(query)

    # Retrieve context
    yield {"type": "status", "step": "retrieving", "meta": {"query": query, "sub_queries": sub_queries}}
    try:
        context_chunks = await retrieve(
            query=query,
            user_id=user_id,
            include_public=include_public,
            inactive_docs=inactive_docs,
            sub_queries=sub_queries,
        )
        yield {
            "type": "status", 
            "step": "retrieved", 
            "meta": {"chunks_count": len(context_chunks), "chunks": context_chunks}
        }
        logger.info(
            "Retrieved %d chunks for streaming (user %s)",
            len(context_chunks), user_id,
        )
    except Exception as e:
        logger.warning(
            "Retrieval failed for user %s stream — falling back to plain LLM: %s",
            user_id, str(e),
        )
        context_chunks = []

    if not context_chunks:
        logger.info("No context chunks retrieved for user %s stream. Proceeding with empty context.", user_id)

    # Build context-augmented prompt
    yield {"type": "status", "step": "building_context"}
    system_prompt = build_rag_system_prompt(context_chunks, mode=mode)

    logger.debug(
        "System prompt built for stream (%d chars):\n%s",
        len(system_prompt),
        system_prompt,
    )

    messages = [{"role": "system", "content": system_prompt}] + conversation_history
    logger.debug(
        "Sending stream to LLM: %d messages total",
        len(messages)
    )

    yield {"type": "status", "step": "calling_llm"}
    yield {"type": "status", "step": "generating"}
    async for chunk in generate_chat_stream(messages, max_token_limit=max_token_limit):
        if chunk.get("type") == "usage" and rewrite_usage:
            chunk["total_tokens"] = chunk.get("total_tokens", 0) + rewrite_usage.get("total_tokens", 0)
            chunk["prompt_tokens"] = chunk.get("prompt_tokens", 0) + rewrite_usage.get("prompt_tokens", 0)
            chunk["completion_tokens"] = chunk.get("completion_tokens", 0) + rewrite_usage.get("completion_tokens", 0)
        yield chunk
