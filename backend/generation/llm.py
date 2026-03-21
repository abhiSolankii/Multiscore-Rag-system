import openai
from core.config import settings
from core.logging import get_logger
from typing import List, Dict

logger = get_logger(__name__)

# Create async client
if settings.OPENROUTER_API_KEY:
    client = openai.AsyncOpenAI(
        base_url="https://openrouter.ai/api/v1",
        api_key=settings.OPENROUTER_API_KEY,
    )
else:
    client = None


async def generate_chat_response(messages: List[Dict[str, str]]) -> str:
    """
    Generates a reply using OpenRouter LLM based on the conversation history.
    If no API key is provided, returns a mock development response.
    """
    if not client:
        logger.warning("OPENROUTER_API_KEY not set — returning mock response")
        return "[Mock Response] Please configure OPENROUTER_API_KEY in .env to enable real LLM responses."

    try:
        logger.debug(
            "LLM call: model=%s | messages=%d | roles=%s",
            settings.LLM_MODEL,
            len(messages),
            [m["role"] for m in messages],
        )
        response = await client.chat.completions.create(
            model=settings.LLM_MODEL,
            messages=messages,
        )
        content = response.choices[0].message.content
        logger.debug(
            "LLM response (%d chars):\n%s",
            len(content),
            content,
        )
        return content
    except Exception as e:
        logger.error("LLM generation failed: %s", str(e), exc_info=True)
        return f"[Error] Failed to generate response: {str(e)}"
