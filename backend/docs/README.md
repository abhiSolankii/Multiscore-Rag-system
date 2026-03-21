# Multiscore RAG Backend

A high-performance Retrieval-Augmented Generation (RAG) system with secure authentication, modular architecture, and fully pluggable models (LLM, embeddings, vector DB).

## 🧠 System Context (For Developers / LLMs)

This project is a **FastAPI** backend delivering a scalable, private-capable RAG pipeline.

**Core Tech Stack**
- **Framework:** FastAPI / Python 3.12+
- **Database:** MongoDB (Motor async driver) — users, chats, ingestion job tracking
- **Tokens / Auth:** JWT (Access 30m + Refresh 7d) with bcrypt password hashing
- **Dependencies:** managed with `uv`
- **Vector Database:** Qdrant (local Docker or Cloud), collections created dynamically
- **LLM Provider:** OpenRouter API (default: `deepseek/deepseek-chat`), pluggable via `.env`
- **Embeddings:** Fully pluggable — `openai` APIs or local `sentence-transformers` (default: `BAAI/bge-small-en-v1.5`)
- **Document Loaders:** Custom parsers for PDFs (`pypdf`), Web URLs (`BeautifulSoup`), GitHub repositories

**Architecture Paradigm**  
API routers → dependency resolution (raw MongoDB dicts) → service layer → Pydantic serialization.  
LLM, Embedder and Vector DB are completely decoupled — swap any of them via `.env` without changing business logic.

---

## 🚀 Key Features

### 🔐 Authentication & Security
- JWT-based authentication with short-lived access tokens and long-lived refresh tokens
- Protected routes via FastAPI dependency injection / middleware

### 🗄️ Ingestion & RAG Pipeline
- **Multi-source ingestion** — PDFs, web pages, entire GitHub repositories (async)
- **Intelligent chunking** — recursive `tiktoken` (cl100k_base) splitter with strict token budget (default ~512 + 64 overlap)
- **Dynamic collection mapping** — per-user + per-embedding-model collections (e.g. `user_123_baai_bge_small`)
- **Hybrid Retrieval** — semantic vector search + BM25 keyword search + optional cross-encoder reranking
- **Vector segregation** — different embedding models → different collections (prevents dimension mismatch)

### ⚙️ User & Chat Configurations
- **User Settings**: Horizontal preferences stored globally per user (e.g. `enable_streaming`, `default_mode`).
- **Chat Configs**: Granular control natively embedded on every chat session:
  - `include_public`: Toggles if the public knowledge base is searched.
  - `mode ("strict" vs "hybrid")`: Instructs the LLM to either fiercely reject out-of-context knowledge, or softly supplement the context with its native knowledge if gaps exist.
  - `inactive_docs`: Array of disabled document IDs. The RAG vector search ignores these natively via Qdrant's ultra-fast `must_not` query filter payloads.

### 🌊 Live SSE Streaming 
- **ChatGPT-style StreamResponse**: Enable `ENABLE_STREAMING=true` in `.env` to return real-time Server-Sent Events (SSE). 
- **Thinking Traces**: The stream yields ephemeral progress cleanly formatted (`event: status`, `data: {"step": "retrieving", "meta": {"query": "..."}}`) covering `retrieving`, `retrieved`, `building_context`, `calling_llm`, and `generating`, before yielding text chunks (`event: token`, `data: {"text": "chunk"}`).
- **Graceful DB Savings**: The backend only hits MongoDB once at the absolute end of the stream (or upon client disconnect). Disconnected streams save whatever was completed so far and are explicitly marked with `"status": "interrupted"`, while full streams are marked `"completed"`. 

### 📦 Chunk Metadata & Citations
Every stored chunk includes:
```json
{
  "content": "...",
  "document_id": "uuid4",
  "source": "filename.pdf | https://... | github://...",
  "type": "pdf | web | github",
  "page": 0, // 0-based, PDF only
  "chunk_index": 3,
  "token_count": 128,
  "user_id": "...",
  "is_public": false
}
```
→ Prompts include precise citations: `[Source: filename.pdf, Page 12]` → reduces hallucinations

---

## 📂 Project Structure

```text
backend/
├── api/                    # Routers: auth, chat, ingestion
├── core/                   # Security, config (Pydantic), logging setup
├── db/                     # MongoDB client + Qdrant connector
├── schemas/                # All Pydantic models (request/response)
├── generation/             # LLM calls, streaming generators, prompt templates
├── ingestion/              # Full ingestion pipeline
│   ├── loaders/            # pdf_loader, web_loader, github_loader
│   ├── chunking.py         # Recursive token-aware text splitter
│   ├── embedder.py         # Factory: local HF or OpenAI embedder
│   └── pipeline.py         # Orchestrator: load → chunk → embed → store
├── retrieval/              # Vector + BM25 hybrid search, reranking, deduplication
├── docs/                   # Documentation
├── logs/                   # app.log (when DEBUG_LOGGING=true)
├── uploads/                # Temporary raw file storage
├── main.py                 # FastAPI app entry point
└── pyproject.toml          # uv / PEP 621 dependencies
```

---

## 📋 Comprehensive Debug Logging

Optimized dual-output logging:
- **Console** — only `INFO`, `WARNING`, `ERROR`
- **File** (`logs/app.log`) — full DEBUG trace when `DEBUG_LOGGING=true`

**Traces include (when debug enabled):**
- Auth: login, token lifecycle
- Ingestion: extracted text previews, GitHub tree manifests
- Chunking: token counts, source offsets, chunk previews
- Embedder: model load time, vector dimensions, sample fingerprints
- Retrieval: query text, candidate scores, chunk indices
- Prompt: complete rendered system prompt
- LLM: model slug, full message history, raw response strings

Third-party loggers (`passlib`, `httpx`, etc.) are silenced to reduce noise.

---

## 🏗️ The RAG Flow (when RAG_ENABLED=true)

```
User message → /api/chats/{id}/messages/send
    ↓
answer_generator.generate_rag_response() / generate_rag_stream()
    ↓
retriever_manager.retrieve()
    ├─ Embed query (local HF or OpenAI)
    ├─ Vector search (user private collection)
    ├─ Optional: vector search in public collection
    ├─ Deduplicate (hash-based)
    ├─ BM25 keyword search + Reciprocal Rank Fusion
    └─ Optional: cross-encoder reranking
    ↓
prompt_templates.build_rag_system_prompt()   # with citations
    ↓
llm.generate_chat_response() / generate_chat_stream()  → OpenRouter
```

When `RAG_ENABLED=false` → direct LLM call (no retrieval)

---

## ⚙️ Important Environment Variables

### LLM (generation)
| Variable             | Default                  | Purpose                   |
| -------------------- | ------------------------ | ------------------------- |
| `OPENROUTER_API_KEY` | —                        | Required for LLM calls    |
| `LLM_MODEL`          | `deepseek/deepseek-chat` | Any OpenRouter model slug |
| `ENABLE_STREAMING`   | `true`                   | Yields streaming SSEs     |

### Embeddings
| Variable             | Default                  | Purpose                             |
| -------------------- | ------------------------ | ----------------------------------- |
| `EMBEDDING_PROVIDER` | `local`                  | `local` or `openai`                 |
| `EMBEDDING_MODEL`    | `BAAI/bge-small-en-v1.5` | HuggingFace ID or OpenAI model name |

> Dimensions are **auto-detected** at runtime — no need to set `EMBEDDING_DIMENSIONS`

### Infrastructure
- `QDRANT_URL` – local: `http://localhost:6333` or cloud
- `MONGODB_URL`
- `SECRET_KEY` – JWT signing
- `RAG_ENABLED` – `true` / `false`
- `DEBUG_LOGGING` – `true` for detailed file logs

---

## 🛠️ Setup & Quick Start (Recommended: Local Embeddings)

1. Start Qdrant (if local)
```bash
docker run -d -p 6333:6333 qdrant/qdrant
```

2. Prepare environment
```bash
cp .env.example .env
```

Minimal privacy-focused `.env` example:
```bash
# ────────────────────────────────────────
SECRET_KEY=your-very-long-random-secret-here
MONGODB_URL=mongodb://localhost:27017
QDRANT_URL=http://localhost:6333

RAG_ENABLED=true
DEBUG_LOGGING=true

ENABLE_STREAMING=true

EMBEDDING_PROVIDER=local
EMBEDDING_MODEL=BAAI/bge-small-en-v1.5

OPENROUTER_API_KEY=sk-or-v1-...
LLM_MODEL=deepseek/deepseek-chat
```

3. Install & launch
```bash
uv sync
uv run uvicorn main:app --reload
```

→ API available at `http://localhost:8000`  
→ Interactive docs: `http://localhost:8000/docs`

4. Monitor (very verbose when debug is on)
```bash
tail -f logs/app.log
```

---

## 📡 Main API Endpoints

### Ingestion
- `POST /api/ingest/file` — upload PDF + `is_public` flag
- `POST /api/ingest/url` — ingest webpage
- `POST /api/ingest/github` — ingest repo
- `GET  /api/ingest/status/{task_id}`
- `GET  /api/ingest/documents?...` — list by type (`pdf`, `web`, `github`)
- `DELETE /api/ingest/document/{document_id}`

### Chat
- `GET   /api/chats/list` — fetch chat history
- `POST  /api/chats/create` — create new chat w/ config defaults
- `PATCH /api/chats/{id}` — update chat config dynamically (e.g. toggling `inactive_docs`)
- `POST  /api/chats/{id}/messages/send` — standard messaging endpoint (inherits all rules from chat document)

Enjoy building with Multiscore RAG.
