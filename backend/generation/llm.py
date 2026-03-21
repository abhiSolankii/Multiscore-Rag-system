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


from typing import List, Dict, Tuple, Optional

async def generate_chat_response(messages: List[Dict[str, str]]) -> Tuple[str, Optional[dict]]:
    """
    Generates a reply using OpenRouter LLM based on the conversation history.
    If no API key is provided, returns a mock development response.
    """
    if not client:
        logger.warning("OPENROUTER_API_KEY not set — returning mock response")
        return "[Mock Response] Please configure OPENROUTER_API_KEY in .env to enable real LLM responses.", None

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
        usage = getattr(response, "usage", None)
        logger.debug(
            "LLM response (%d chars):\n%s",
            len(content),
            content,
        )
        return content, usage.model_dump() if usage else None
    except Exception as e:
        logger.error("LLM generation failed: %s", str(e), exc_info=True)
        return f"[Error] Failed to generate response: {str(e)}", None


async def generate_chat_stream(messages: List[Dict[str, str]]):
    """
    Generates a streaming reply using OpenRouter LLM based on the conversation history.
    Outputs an AsyncGenerator yielding raw text chunks.
    """
    if not client:
        logger.warning("OPENROUTER_API_KEY not set — returning mock response stream")
        yield {"type": "token", "text": "[Mock Stream] Please configure OPENROUTER_API_KEY in .env"}
        return

    try:
        logger.debug(
            "LLM STREAM call: model=%s | messages=%d",
            settings.LLM_MODEL,
            len(messages),
        )
        # We explicitly request a stream from the API, enabling token usage data
        response_stream = await client.chat.completions.create(
            model=settings.LLM_MODEL,
            messages=messages,
            stream=True,
            stream_options={"include_usage": True},
        )
        
        async for chunk in response_stream:
            usage = getattr(chunk, "usage", None)
            if usage:
                yield {"type": "usage", "data": usage.model_dump()}
                
            if chunk.choices and len(chunk.choices) > 0:
                content = chunk.choices[0].delta.content
                if content:
                    yield {"type": "token", "text": content}
    except Exception as e:
        logger.error("LLM streaming failed: %s", str(e), exc_info=True)
        yield {"type": "error", "text": f"[Error] Failed to stream response: {str(e)}"}
