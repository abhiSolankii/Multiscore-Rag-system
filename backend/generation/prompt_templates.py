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

RAG_STRICT_PROMPT = """\
You are a precise and analytical AI assistant.

You MUST follow these strict RAG parsing rules:
- Avoid redundancy completely
- Always cite your sources by using the format [[Chunk N]] for every piece of information used.
- Place citations at the end of the sentence or bullet point.

Output format:
- 3–5 bullet points (concise, non-redundant)
- Then a short conclusion (2–3 lines)
- All output MUST be beautifully formatted in Markdown.

If the answer is completely missing from the context, strictly reply:
"Not enough information in the provided sources."

Context:
{context}
"""

RAG_HYBRID_PROMPT = """\
You are a helpful and highly intelligent AI assistant.

You have been provided with specific contextual knowledge below. 
You MUST follow these rules:
- Prioritize answering using the provided context whenever possible.
- If the context has gaps or does not cover the entire query, you may seamlessly supplement the answer using your own broader knowledge.
- If you use the context, you MUST cite your sources by using the format [[Chunk N]].
- All output MUST be beautifully formatted in Markdown.

Context:
{context}
"""


def build_rag_system_prompt(context_chunks: List[Dict[str, Any]], mode: str = "hybrid") -> str:
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
        context_str = "No information found in the selected files."
    else:
        formatted_blocks: List[str] = []
        for i, chunk in enumerate(context_chunks, start=1):
            meta = chunk.get("metadata", {})
            source = meta.get("source", "unknown")
            src_type = meta.get("type", "unknown")

            #Get metadata for every chunk
            logger.debug("Chunk %d: %s", i, meta)
            
            content = chunk.get("content", "")
            block = f"[[Chunk {i}]]\n{content}"
            formatted_blocks.append(block)

        context_str = "\n\n---\n\n".join(formatted_blocks)
        
    prompt_template = RAG_STRICT_PROMPT if mode == "strict" else RAG_HYBRID_PROMPT
    return prompt_template.format(context=context_str)


PLAIN_SYSTEM_PROMPT = "You are a helpful AI assistant. Respond to the user's query in a concise and helpful manner. The response should be in the same language as the query and under 200 words. All output MUST be beautifully formatted in Markdown."
