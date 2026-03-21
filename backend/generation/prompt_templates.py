"""
Prompt templates for RAG-augmented responses.
Context trimming is simple top_k for now (see RAG_README.md for future token-budget approach).
"""
from __future__ import annotations

from typing import List, Dict, Any
from core.logging import get_logger

logger = get_logger(__name__)

# RAG_SYSTEM_PROMPT = """\
# You are a helpful AI assistant. Answer the user's question using ONLY the provided context below.
# If the context does not contain enough information to answer the question, say so clearly — do not make up information.
# Always cite your sources by referencing the actual filename or URL, including the page number if provided (e.g., [Source: filename.pdf, Page 12]).

# Context:
# {context}

# """

RAG_SYSTEM_PROMPT = """\
You are a precise and analytical AI assistant.

You MUST follow these rules:
- Answer ONLY using the provided context
- DO NOT repeat the same idea in different words
- Merge similar points into a single concise statement
- Each point must be unique and non-overlapping
- Avoid redundancy completely
- If multiple sources say the same thing, cite them together once
- Always cite your sources by referencing the actual filename or URL, including the page number if provided (e.g., [Source: filename.pdf, Page 12]).

Output format:
- 3–5 bullet points (concise, non-redundant)
- Then a short conclusion (2–3 lines)

If the answer is not in the context, say:
"Not enough information in the provided sources."

Context:
{context}
"""


def build_rag_system_prompt(context_chunks: List[Dict[str, Any]]) -> str:
    """
    Format retrieved chunks into a system prompt with citations.

    Each chunk is formatted as:
        [Chunk N | Source: filename.pdf | Type: pdf]
        <content text>

    Args:
        context_chunks: Output from retriever_manager.retrieve()

    Returns:
        Formatted system prompt string.
    """
    if not context_chunks:
        return "You are a helpful AI assistant."

    formatted_blocks: List[str] = []
    for i, chunk in enumerate(context_chunks, start=1):
        meta = chunk.get("metadata", {})
        source = meta.get("source", "unknown")
        src_type = meta.get("type", "unknown")

        #Get metadata for every chunk
        logger.debug("Chunk %d: %s", i, meta)
        
        # Append page number to the source string if available (mostly for PDFs)
        if "page" in meta:
            # Note: page is 0-indexed in PyPDF, so we add 1 for human readability
            source = f"{source}, Page {meta['page'] + 1}"
            
        content = chunk.get("content", "")
        block = f"[Source: {source} | Type: {src_type}]\n{content}"
        formatted_blocks.append(block)

    context_str = "\n\n---\n\n".join(formatted_blocks)
    return RAG_SYSTEM_PROMPT.format(context=context_str)


PLAIN_SYSTEM_PROMPT = "You are a helpful AI assistant. Respond to the user's query in a concise and helpful manner. The response should be in the same language as the query and under 200 words."
