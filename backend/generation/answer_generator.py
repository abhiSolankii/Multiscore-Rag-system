"""
Context-augmented answer generator.
Wraps the retrieval layer + prompt builder + LLM call into one clean interface.
Falls back to plain LLM if RAG is disabled or no context found.
"""
from __future__ import annotations

from typing import List, Dict

from core.config import settings
from core.logging import get_logger
from generation.llm import generate_chat_response
from generation.prompt_templates import build_rag_system_prompt, PLAIN_SYSTEM_PROMPT
from retrieval.retriever_manager import retrieve

logger = get_logger(__name__)


async def generate_rag_response(
    query: str,
    conversation_history: List[Dict[str, str]],
    user_id: str,
    include_public: bool = False,
) -> str:
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
        return await generate_chat_response(conversation_history)

    # Retrieve context
    try:
        context_chunks = await retrieve(
            query=query,
            user_id=user_id,
            include_public=include_public,
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
        logger.info("No context found for user %s — using plain LLM", user_id)
        messages = [{"role": "system", "content": PLAIN_SYSTEM_PROMPT}] + conversation_history
        return await generate_chat_response(messages)

    # Build context-augmented prompt
    system_prompt = build_rag_system_prompt(context_chunks)

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

    return await generate_chat_response(messages)
