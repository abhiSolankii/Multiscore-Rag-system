"""
Web page loader.
Fetches a URL with httpx, extracts clean text via BeautifulSoup.
"""
from __future__ import annotations

from typing import List, Dict, Any
import httpx
from bs4 import BeautifulSoup

from core.logging import get_logger

logger = get_logger(__name__)


async def load_url(
    url: str,
    document_id: str,
    user_id: str,
    is_public: bool,
) -> List[Dict[str, Any]]:
    """
    Fetch a web page and extract its main text content.

    Returns a single-element list (the whole page as one Document).
    The chunker will split it later.
    """
    logger.debug("Fetching URL: %s", url)

    async with httpx.AsyncClient(follow_redirects=True, timeout=30.0) as client:
        response = await client.get(url)
        response.raise_for_status()
        html = response.text

    logger.debug("Fetched %d bytes from %s | status=%d", len(html), url, response.status_code)

    soup = BeautifulSoup(html, "html.parser")

    # Remove script / style / nav noise
    for tag in soup(["script", "style", "nav", "footer", "header", "aside"]):
        tag.decompose()

    # Extract readable text blocks
    blocks: List[str] = []
    for tag in soup.find_all(["h1", "h2", "h3", "h4", "h5", "h6", "p", "li", "td"]):
        text = tag.get_text(separator=" ", strip=True)
        if text:
            blocks.append(text)

    content = "\n\n".join(blocks)

    if not content.strip():
        # Fallback: get_text of entire body
        body = soup.find("body")
        content = body.get_text(separator="\n", strip=True) if body else ""

    logger.debug(
        "Web extracted: %d chars from %s | preview: %.200s",
        len(content), url, content,
    )

    return [
        {
            "content": content,
            "metadata": {
                "document_id": document_id,
                "source": url,
                "type": "web",
                "user_id": user_id,
                "is_public": is_public,
            },
        }
    ]
