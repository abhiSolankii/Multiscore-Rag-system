from ingestion.loaders.pdf_loader import load_pdf
from ingestion.loaders.web_loader import load_url
from ingestion.loaders.github_loader import load_github_repo

__all__ = ["load_pdf", "load_url", "load_github_repo"]
