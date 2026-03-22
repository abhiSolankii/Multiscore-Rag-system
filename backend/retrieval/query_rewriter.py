from typing import List, Tuple
import json
import re

from core.config import settings
from core.logging import get_logger
from generation.llm import generate_chat_response

logger = get_logger(__name__)

REWRITE_SYSTEM_PROMPT = """\
You are an expert search query analyzer and decomposer.
Your goal is to break down complex, multi-part user queries into distinct, independent sub-queries to maximize vector search retrieval effectiveness.

Instructions:
1. If the query asks about clearly distinct concepts, split it into 2 to 3 standalone sub-queries.
2. If the query is simple and singular, just return it as a single element list.
3. Ensure each sub-query contains enough context to be searched independently.
4. Output strictly a JSON array of strings and nothing else. No markdown formatting, no explanations.

Example 1:
User: "Where is the Indian army HQ and is there corruption in the judiciary?"
Output: ["Where is the headquarters of the Indian army?", "Is there corruption in the Indian judiciary?"]
   
Example 2:
User: "Tell me about climate change."
Output: ["What is climate change?"]
"""

async def decompose_query(query: str) -> Tuple[List[str], dict]:
    """
    Decompose a complex user query into multiple sub-queries using the LLM.
    Returns a list of string sub-queries.
    """
    logger.debug("Decomposing query: %s", query)
    
    messages = [
        {"role": "system", "content": REWRITE_SYSTEM_PROMPT},
        {"role": "user", "content": query}
    ]
    
    try:
        # Ask LLM for the decomposed queries
        # We don't want a huge response, so we bound it strictly
        response_text, usage = await generate_chat_response(messages, max_token_limit=settings.REWRITE_TOKEN_CAP)
        
        # Clean the output in case the LLM returned markdown code blocks
        clean_text = response_text.strip()
        if clean_text.startswith("```json"):
            clean_text = clean_text[7:]
        if clean_text.startswith("```"):
            clean_text = clean_text[3:]
        if clean_text.endswith("```"):
            clean_text = clean_text[:-3]
        clean_text = clean_text.strip()
        
        # Parse the JSON array
        sub_queries = json.loads(clean_text)
        
        if not isinstance(sub_queries, list) or not all(isinstance(q, str) for q in sub_queries):
            raise ValueError("LLM returned JSON but it is not a list of strings.")
            
        if not sub_queries:
            sub_queries = [query]
            
        logger.info("Decomposed query into %d sub-queries: %s", len(sub_queries), sub_queries)
        return sub_queries, usage
        
    except Exception as e:
        logger.warning(
            "Query decomposition failed: %s. Falling back to original standalone query.", str(e)
        )
        return [query], {}
