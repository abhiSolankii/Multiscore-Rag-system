"""
PDF document loader.
Uses pypdf to extract text page-by-page with metadata including document_id.
"""
from __future__ import annotations

from typing import List, Dict, Any
from pypdf import PdfReader
import io


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

    for page_num, page in enumerate(reader.pages):
        text = page.extract_text() or ""
        text = text.strip()
        if not text:
            continue  # Skip blank pages

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

    return documents
