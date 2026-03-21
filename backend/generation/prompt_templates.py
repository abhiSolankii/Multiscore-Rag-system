"""
Prompt templates for RAG-augmented responses.
Context trimming is simple top_k for now (see RAG_README.md for future token-budget approach).
"""
from __future__ import annotations

from typing import List, Dict, Any


RAG_SYSTEM_PROMPT = """\
You are a helpful AI assistant. Answer the user's question using ONLY the provided context below.
If the context does not contain enough information to answer the question, say so clearly — do not make up information.
Always cite your sources by referencing the [Source] tag at the end of each context block.

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
        content = chunk.get("content", "")
        block = f"[Chunk {i} | Source: {source} | Type: {src_type}]\n{content}"
        formatted_blocks.append(block)

    context_str = "\n\n---\n\n".join(formatted_blocks)
    return RAG_SYSTEM_PROMPT.format(context=context_str)


PLAIN_SYSTEM_PROMPT = "You are a helpful AI assistant. Respond to the user's query in a concise and helpful manner. The response should be in the same language as the query and under 200 words."
