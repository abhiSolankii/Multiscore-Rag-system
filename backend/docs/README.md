# Multiscore RAG Backend

A high-performance Retrieval-Augmented Generation (RAG) system with a secure authentication layer, modular architecture, and pluggable models.

## 🧠 System Context (For LLMs / Developers)

This project is a FastAPI backend serving a scalable RAG pipeline.
**Core Tech Stack:**
- **Framework:** FastAPI / Python 3.12+
- **Database:** MongoDB (Motor async driver) for users, chats, and ingestion job tracking.
- **Tokens/Auth:** JWT (Access & Refresh tokens) with Bcrypt password hashing.
- **Dependencies Manager:** `uv`
- **Vector Database:** Qdrant (local Docker or Cloud) mapped dynamically.
- **LLM Provider:** OpenRouter API (Default: `deepseek/deepseek-chat`). Pluggable via `.env`.
- **Embeddings Pipeline:** Fully pluggable. Supports `openai` APIs natively, or completely `local` embeddings via HuggingFace `SentenceTransformers` (Default: `BAAI/bge-small-en-v1.5`).
- **Loaders:** Custom local parsers for PDFs (`pypdf`), Web URLs (`BeautifulSoup`), and GitHub repositories.

**Architecture Paradigm:**
Data flows from API routers → dependency resolution (passing raw MongoDB dicts) → service logic → Pydantic serialization. The architecture is explicitly decoupled, allowing the LLM, Embedder, and Vector DB to be swapped dynamically via `.env` without rewriting business logic.

---

## 🚀 Key Features

### 🔐 Authentication & Security
- **JWT-Based Auth**: Secure Access (30m) and Refresh (7d) token implementation.
- **Protected Routes**: Middleware dependencies verify sessions natively.

### 🗄️ Ingestion & RAG Pipeline
- **Multi-Source Ingestion**: Asynchronously loads data from PDFs, Web pages, and GitHub.
- **Intelligent Chunking**: Uses `tiktoken` (cl100k_base) to chunk strings recursively based on a strict token budget (e.g., 512 + 64 overlap). 
- **Dynamic Vector Searching**: Collections automatically map to user IDs and models (e.g., `user_123_baai_bge_small`). Vector dimensions are auto-calculated at runtime.
- **Hybrid Retrieval**: Combines native Vector Semantic Search with BM25 Lexical Keyword search.

---

## 📂 Project Structure

```text
backend/
├── api/                    # API Routers (Auth, Chat, Ingestion)
├── core/                   # Security, Config (Pydantic), and Logging
├── db/                     # MongoDB client and Qdrant connector
├── schemas/                # Pydantic data validation (In/Out)
├── generation/             # LLM logic (OpenRouter API, prompt generation)
├── ingestion/              # Data ingest pipelines
│   ├── loaders/            # Specific parsers: pdf_loader, web_loader, github_loader
│   ├── chunking.py         # Recursive token-based text splitter
│   ├── embedder.py         # Factory returning Local/OpenAI embedders
│   └── pipeline.py         # Core orchestrator (Extract -> Chunk -> Embed -> Qdrant)
├── retrieval/              # Search logic (Vector Search, BM25 Hybrid, Reranking)
├── docs/                   # Documentation (You are here)
├── logs/                   # Log output directory (app.log lives here)
├── uploads/                # Ephemeral local storage for raw ingested files
├── main.py                 # Application entry point
└── pyproject.toml          # uv dependencies
```

---

## 📋 Comprehensive Debug Logging

The application maintains a highly optimized logging system:

- **Console:** Stays clean, only showing `INFO`, `WARNING`, and `ERROR` events.
- **File (`logs/app.log`):** When `DEBUG_LOGGING=true` in `.env`, the file captures granular debug information at every stage of the pipeline without cluttering the terminal.

**Debug Coverage Examples:**
- **Auth:** Login attempts, token refresh lifecycles.
- **Ingestion:** Page extractions, 200-character content previews, GitHub tree manifests.
- **Chunking:** Every individual chunk's token count, source index, and raw text preview.
- **Embedder:** Model initialization time, vector dimensions, and sample vector fingerprints.
- **Retrieval:** The actual search query text, scores of returned candidates, and chunk indices.
- **Prompt Gen:** The complete, un-truncated final rendered system prompt passed to the LLM.
- **LLM Call:** Model slugs, message histories, and the full raw response string.

*(Note: Third-party loggers like `passlib` and `httpx` are manually silenced in `core/logging.py` to prevent log pollution).*

---

## 🛠️ Setup & Installation

### 1. Prerequisites
- Python 3.12+
- MongoDB instance (Local or Atlas)
- Qdrant Vector DB (e.g., `docker run -d -p 6333:6333 qdrant/qdrant`)

### 2. Environment Setup
```bash
cp .env.example .env
```
Update `SECRET_KEY`, `MONGODB_URL`, `OPENROUTER_API_KEY`, and embedding variables.

### 3. Install & Run
```bash
uv sync
uv run uvicorn main:app --reload
```
API runs on `http://localhost:8000`. Swagger Docs at `http://localhost:8000/docs`.
