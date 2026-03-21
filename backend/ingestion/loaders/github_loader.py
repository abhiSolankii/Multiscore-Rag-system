"""
GitHub repository loader.
Fetches text-based files (.md, .txt, .py, .js, .ts, .json, .yaml, .yml, .rst)
from a public GitHub repo using the GitHub Contents API.
"""
from __future__ import annotations

from typing import List, Dict, Any, Set
import base64
import httpx

from core.logging import get_logger

logger = get_logger(__name__)

# File extensions we care about
_TEXT_EXTENSIONS: Set[str] = {
    ".md", ".txt", ".py", ".js", ".ts", ".jsx", ".tsx",
    ".json", ".yaml", ".yml", ".rst", ".toml", ".env.example",
}


def _parse_repo_info(repo_url: str):
    """
    Extract owner/repo from a GitHub URL.
    Supports:
      https://github.com/owner/repo
      https://github.com/owner/repo.git
    """
    url = repo_url.rstrip("/").removesuffix(".git")
    parts = url.split("github.com/")
    if len(parts) < 2:
        raise ValueError(f"Not a valid GitHub URL: {repo_url}")
    segments = parts[1].split("/")
    if len(segments) < 2:
        raise ValueError(f"Cannot extract owner/repo from: {repo_url}")
    return segments[0], segments[1]


async def _fetch_tree(owner: str, repo: str, client: httpx.AsyncClient) -> List[dict]:
    """Fetch the full file tree of the repo's default branch."""
    # First get the default branch
    repo_resp = await client.get(f"https://api.github.com/repos/{owner}/{repo}")
    repo_resp.raise_for_status()
    default_branch = repo_resp.json().get("default_branch", "main")

    logger.debug("GitHub repo: %s/%s | default branch: %s", owner, repo, default_branch)

    # Get recursive tree
    tree_resp = await client.get(
        f"https://api.github.com/repos/{owner}/{repo}/git/trees/{default_branch}?recursive=1"
    )
    tree_resp.raise_for_status()
    return tree_resp.json().get("tree", [])


async def load_github_repo(
    repo_url: str,
    document_id: str,
    user_id: str,
    is_public: bool,
    max_files: int = 50,
) -> List[Dict[str, Any]]:
    """
    Load text files from a GitHub repository.
    Returns one Document dict per file (chunker handles splitting).

    Args:
        repo_url: e.g. "https://github.com/openai/openai-python"
        document_id: shared ID for all chunks from this ingestion
        user_id: owner
        is_public: whether to store in public collection
        max_files: safety cap to avoid massive repos
    """
    owner, repo = _parse_repo_info(repo_url)
    logger.debug("GitHub load started: %s/%s | max_files=%d", owner, repo, max_files)

    documents: List[Dict[str, Any]] = []

    headers = {"Accept": "application/vnd.github.v3+json"}

    async with httpx.AsyncClient(headers=headers, timeout=60.0) as client:
        tree = await _fetch_tree(owner, repo, client)

        # Filter to text-based blobs only
        text_files = [
            item for item in tree
            if item.get("type") == "blob"
            and any(item["path"].endswith(ext) for ext in _TEXT_EXTENSIONS)
        ][:max_files]

        logger.debug(
            "GitHub tree: %d total items, %d text files selected (cap=%d): %s",
            len(tree),
            len(text_files),
            max_files,
            [item["path"] for item in text_files],
        )

        for item in text_files:
            file_path = item["path"]
            try:
                content_resp = await client.get(
                    f"https://api.github.com/repos/{owner}/{repo}/contents/{file_path}"
                )
                content_resp.raise_for_status()
                data = content_resp.json()

                if data.get("encoding") == "base64":
                    raw = base64.b64decode(data["content"]).decode("utf-8", errors="replace")
                else:
                    raw = data.get("content", "")

                raw = raw.strip()
                if not raw:
                    logger.debug("Skipping empty file: %s", file_path)
                    continue

                logger.debug(
                    "Loaded file: %s | %d chars | preview: %.120s",
                    file_path, len(raw), raw,
                )

                documents.append({
                    "content": raw,
                    "metadata": {
                        "document_id": document_id,
                        "source": repo_url,
                        "type": "github",
                        "file_path": file_path,
                        "user_id": user_id,
                        "is_public": is_public,
                    },
                })
            except Exception as e:
                logger.debug("Skipped file %s: %s", file_path, e)
                continue

    logger.debug("GitHub load complete: %d files loaded from %s", len(documents), repo_url)
    return documents
