"""
PDF document loader.
Uses pypdf to extract text page-by-page with metadata including document_id.
"""
from __future__ import annotations

from typing import List, Dict, Any
from pypdf import PdfReader
import io

from core.logging import get_logger

logger = get_logger(__name__)


def load_pdf(
    file_bytes: bytes,
    filename: str,
    document_id: str,
    user_id: str,
    is_public: bool,
) -> List[Dict[str, Any]]:
    """
    Parse a PDF from raw bytes into a list of Document dicts (one per page).

    Returns:
        [
            {
                "content": "page text...",
                "metadata": {
                    "document_id": "...",
                    "source": "filename.pdf",
                    "type": "pdf",
                    "page": 0,
                    "user_id": "...",
                    "is_public": False,
                }
            },
            ...
        ]
    """
    documents: List[Dict[str, Any]] = []
    reader = PdfReader(io.BytesIO(file_bytes))
    total_pages = len(reader.pages)

    logger.debug("PDF opened: %s | total pages=%d | doc_id=%s", filename, total_pages, document_id)

    for page_num, page in enumerate(reader.pages):
        text = page.extract_text() or ""
        text = text.strip()
        if not text:
            logger.debug("Page %d is blank — skipping", page_num)
            continue

        logger.debug(
            "Page %d extracted: %d chars | preview: %.200s",
            page_num, len(text), text,
        )

        documents.append({
            "content": text,
            "metadata": {
                "document_id": document_id,
                "source": filename,
                "type": "pdf",
                "page": page_num,
                "user_id": user_id,
                "is_public": is_public,
            },
        })

    logger.debug(
        "PDF load complete: %s | %d/%d pages had content",
        filename, len(documents), total_pages,
    )
    return documents
