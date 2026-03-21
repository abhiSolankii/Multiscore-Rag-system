# Multiscore RAG — RAG Pipeline

This document covers the RAG-specific architecture, configuration, and API for the Multiscore RAG backend.

---

## 🏗️ RAG Architecture

```
User Message (POST /api/chats/{id}/messages/send)
    │
    ▼
answer_generator.generate_rag_response()
    │
    ├── [RAG_ENABLED=false] ──→ Plain LLM response
    │
    └── [RAG_ENABLED=true]
          │
          ▼
    retriever_manager.retrieve()
          │
          ├── Embed query (EMBEDDING_PROVIDER)
          ├── Vector search  → private collection (user_{user_id})
          ├── Vector search  → public collection  (if include_public=true)
          ├── Deduplicate chunks
          ├── BM25 + RRF hybrid re-rank (if HYBRID_SEARCH_ENABLED)
          └── Cross-encoder rerank (if RERANKER_ENABLED)
                │
                ▼
          prompt_templates.build_rag_system_prompt()
                │
                ▼
          llm.generate_chat_response()  [OpenRouter]
```

---

## 🔒 Data Privacy Model

Every ingested document is **private by default**:

| Collection | Name pattern     | Who can read   |
| ---------- | ---------------- | -------------- |
| Private    | `user_{user_id}` | Only the owner |
| Public     | `public`         | All users      |

**Ingestion** — user chooses `is_public: true/false` per document.  
**Retrieval** — always searches private collection. Public is opt-in per message via `include_public=true` query param.

---

## 📁 Ingested File Storage

Raw source files are stored at:

```
{UPLOAD_DIR}/{user_id}/{document_id}/
  └── original.pdf     (for PDFs)
  └── page.txt         (for web URLs)
  └── manifest.txt     (for GitHub repos — list of fetched files)
```

Files survive ingestion pipeline failures, allowing retry.

---

## 📦 Chunk Metadata Schema

Every vector stored in Qdrant carries this payload:

```json
{
  "content": "chunk text...",
  "document_id": "uuid4",
  "source": "filename.pdf or https://...",
  "type": "pdf | web | github",
  "page": 0,
  "chunk_index": 3,
  "token_count": 128,
  "user_id": "...",
  "is_public": false
}
```

`document_id` is the key for bulk delete and deduplication.

---

## ⚙️ Environment Variables

### LLM (OpenRouter — for chat answers)

| Variable             | Default                  | Description               |
| -------------------- | ------------------------ | ------------------------- |
| `OPENROUTER_API_KEY` | —                        | OpenRouter API key        |
| `LLM_MODEL`          | `deepseek/deepseek-chat` | Any OpenRouter model slug |

### Embedding (OpenAI-compatible — _separate from OpenRouter_)

> OpenRouter doesn't expose an `/embeddings` endpoint, so embeddings use a dedicated key.

| Variable               | Default                     | Description                            |
| ---------------------- | --------------------------- | -------------------------------------- |
| `EMBEDDING_PROVIDER`   | `openai`                    | `openai` \| `local`                    |
| `EMBEDDING_MODEL`      | `text-embedding-3-large`    | Any model compatible with the API host |
| `EMBEDDING_API_BASE`   | `https://api.openai.com/v1` | OpenAI-compatible base URL             |
| `EMBEDDING_API_KEY`    | —                           | API key for the embedding host         |
| `EMBEDDING_DIMENSIONS` | `1536`                      | Must match chosen model output size    |

> **Local mode** (`EMBEDDING_PROVIDER=local`): Set `EMBEDDING_MODEL` to any HuggingFace model ID (e.g. `BAAI/bge-large-en-v1.5`). No API key needed.

### Reranker (local — no API key)

| Variable           | Default                   | Description                         |
| ------------------ | ------------------------- | ----------------------------------- |
| `RERANKER_ENABLED` | `false`                   | Enable cross-encoder reranking      |
| `RERANKER_MODEL`   | `BAAI/bge-reranker-large` | Any HuggingFace cross-encoder model |

### Vector DB

| Variable                 | Default                 | Description                  |
| ------------------------ | ----------------------- | ---------------------------- |
| `VECTOR_DB_PROVIDER`     | `qdrant`                | `qdrant` (Weaviate planned)  |
| `QDRANT_URL`             | `http://localhost:6333` | Qdrant server URL            |
| `QDRANT_API_KEY`         | —                       | Leave blank for local Qdrant |
| `QDRANT_COLLECTION_NAME` | `multiscore_docs`       | Base collection name         |

### Chunking & Retrieval

| Variable                | Default | Description                       |
| ----------------------- | ------- | --------------------------------- |
| `CHUNK_SIZE`            | `512`   | Max tokens per chunk              |
| `CHUNK_OVERLAP`         | `64`    | Token overlap between chunks      |
| `RETRIEVAL_TOP_K`       | `5`     | Final chunks passed to LLM        |
| `HYBRID_SEARCH_ENABLED` | `true`  | BM25 + RRF over vector candidates |

### Misc

| Variable      | Default     | Description                        |
| ------------- | ----------- | ---------------------------------- |
| `RAG_ENABLED` | `false`     | Master switch; `false` = plain LLM |
| `UPLOAD_DIR`  | `./uploads` | Local raw file storage root        |

---

## 📡 API Endpoints

### Ingestion — source types (PDF, Web URL, GitHub) all share the same list/delete APIs

| Method   | Endpoint                                   | Auth | Description                                                    |
| -------- | ------------------------------------------ | ---- | -------------------------------------------------------------- |
| `POST`   | `/api/ingest/file`                         | ✅   | Upload a PDF (`multipart/form-data`, `is_public` field)        |
| `POST`   | `/api/ingest/url`                          | ✅   | Ingest a web URL (`{"url": "...", "is_public": false}`)        |
| `POST`   | `/api/ingest/github`                       | ✅   | Ingest GitHub repo (`{"repo_url": "...", "is_public": false}`) |
| `GET`    | `/api/ingest/status/{task_id}`             | ✅   | Poll ingestion job status                                      |
| `GET`    | `/api/ingest/documents`                    | ✅   | List **my** docs (pdf + web + github)                          |
| `GET`    | `/api/ingest/documents?type=pdf`           | ✅   | Filter my docs by type: `pdf` \| `web` \| `github`             |
| `GET`    | `/api/ingest/documents/public`             | ✅   | Browse **all** public docs (from any user)                     |
| `GET`    | `/api/ingest/documents/public?type=github` | ✅   | Filter public docs by type                                     |
| `DELETE` | `/api/ingest/document/{document_id}`       | ✅   | Delete document, vectors, raw files                            |

> **Ownership on delete**: The delete endpoint matches on both `document_id` AND `user_id`.
> This means a user can only delete their own documents — **including public ones**.
> If User A ingested a public doc, only User A can delete it. User B gets a 404.

### Chat (updated)

| Method | Endpoint                                            | Description                                     |
| ------ | --------------------------------------------------- | ----------------------------------------------- |
| `POST` | `/api/chats/{id}/messages/send`                     | RAG-augmented chat (uses private KB by default) |
| `POST` | `/api/chats/{id}/messages/send?include_public=true` | Also searches public KB                         |

---

## 🔄 Ingestion Status Flow

```
POST /api/ingest/file  →  task_id returned, status: "processing"
         │
         └──(asyncio.create_task)──→ pipeline.run_ingestion()
                  ├── success → MongoDB status: "done", chunks_ingested: N
                  └── failure → MongoDB status: "failed", error: "..."

GET /api/ingest/status/{task_id}  →  current status from MongoDB
```

---

## 🚀 Quick Start

```bash
# 1. Start Qdrant
docker run -d -p 6333:6333 qdrant/qdrant

# 2. Set env vars in .env
RAG_ENABLED=true
QDRANT_URL=http://localhost:6333
EMBEDDING_PROVIDER=openai
EMBEDDING_MODEL=text-embedding-3-large
EMBEDDING_API_KEY=sk-...

# 3. Install deps
uv sync

# 4. Run
uv run uvicorn main:app --reload

# 5. Open /docs and:
#    - POST /api/ingest/file  (upload a PDF)
#    - GET  /api/ingest/status/{task_id}
#    - POST /api/chats/{id}/messages/send  (ask a question)
```

---

## 🔮 Future: Smart Context Trimming

> Currently, context is limited by `RETRIEVAL_TOP_K` (number of chunks).
>
> **Planned**: Replace `top_k` with a `max_context_tokens` budget.  
> Each chunk carries `token_count` metadata (already stored) — the context builder
> will greedily fill the budget from the highest-scored chunks downward.
> This enables accurate cost tracking and prevents context window overflow on small models.
