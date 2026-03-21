# Multiscore RAG — Pipeline & AI Context

This document outlines the operational AI, RAG architecture, and integration layers for the **Multiscore RAG** backend. It is structured to provide high-level context to Developers or autonomous LLMs operating within the codebase.

---

## 🏗️ The RAG Flow

```text
User Message (POST /api/chats/{id}/messages/send)
    │
    ▼
answer_generator.generate_rag_response()
    │
    ├── [RAG_ENABLED=false] ──→ Plain LLM response (DeepSeek on OpenRouter)
    │
    └── [RAG_ENABLED=true]
          │
          ▼
    retriever_manager.retrieve()
          │
          ├── Embed Query: Local HuggingFace or OpenAI API vectorizes the string.
          ├── Vector Search: Qdrant searches mathematical similarities in the Private user collection (e.g. `user_123_baai`).
          ├── Vector Search: Qdrant optionally hits the Public collection.
          ├── Deduplicate Chunks: Removes hash collisions.
          ├── BM25 + RRF: Lexical keyword search merges with semantic hits.
          └── Cross-Encoder: Reranks final candidates based on relevancy matrices (If Enabled).
                │
                ▼
          prompt_templates.build_rag_system_prompt()
                │
                ▼
          llm.generate_chat_response()  [Passes Prompt String to OpenRouter LLM]
```

---

## 🔒 Vector Segregation & Multi-Model Mapping

Since different embedding models generate vectors of different mathematical dimensions (e.g., `BAAI/bge-small` = 384, `text-embedding-3-large` = 3072), a single vector database collection cannot store both. 

**Our Solution (Dynamic Slugification):**
Qdrant collections are created dynamically per user AND per embedding model used.
Example: If User `abcd...` uses `BAAI/bge-small-en-v1.5`, the collection auto-generated is:
`user_abcd..._baai_bge_small_en_v1_5`

If the `.env` model is changed later, a new empty compatible collection spawns seamlessly, preventing dimension crashes and isolating embeddings by model.

---

## 📦 Ingestion Schema & Citations

The `ingestion.loaders.*` parsers pull text from PDFs, Websites, or Github Repos. Every chunk stored in Qdrant carries this payload:

```json
{
  "content": "chunk text...",
  "document_id": "uuid4",
  "source": "filename.pdf or https://...",
  "type": "pdf | web | github",
  "page": 0,    // Only applies to PDFs (1st page = 0)
  "chunk_index": 3,
  "token_count": 128,
  "user_id": "...",
  "is_public": false
}
```

The **`page` metadata** is vital. During prompt compilation (`generation/prompt_templates.py`), the RAG format strictly feeds: `[Source: filename.pdf, Page 12]`. This forces the LLM to write precise source citations that human users can cross-reference, minimizing hallucinations.

---

## ⚙️ Environment Variables (Pluggable AI)

The architecture is explicitly decoupled. The vectorizer and the generator are completely independent.

### LLM (Chat Responses)
| Variable             | Default                  | Description               |
| -------------------- | ------------------------ | ------------------------- |
| `OPENROUTER_API_KEY` | —                        | Used for LLM chat generation |
| `LLM_MODEL`          | `deepseek/deepseek-chat` | Any valid OpenRouter slug |

### Embedding (Data Intake & Query Vectors)
_Note: `EMBEDDING_DIMENSIONS` is no longer required in settings. The dimensions are auto-detected dynamically on load._
| Variable               | Default                     | Description                            |
| ---------------------- | --------------------------- | -------------------------------------- |
| `EMBEDDING_PROVIDER`   | `local`                     | `openai` \| `local`                    |
| `EMBEDDING_MODEL`      | `BAAI/bge-small-en-v1.5`    | HuggingFace ID / OpenAI Model          |

> **Local vs API:** When `local` is chosen, your machine actively loads the `sentence-transformers` matrix into local RAM. This handles **both** the heavy background digestion of 100-page PDFs into chunks, AND the 0.05-second vectorization of individual user query strings. Data never leaves your machine for vectorization.

---

## 📡 API Endpoints

### Ingestion 

| Method   | Endpoint                                   | Auth | Description                                                    |
| -------- | ------------------------------------------ | ---- | -------------------------------------------------------------- |
| `POST`   | `/api/ingest/file`                         | ✅   | Upload a PDF (`multipart/form-data`, `is_public` boolean)      |
| `POST`   | `/api/ingest/url`                          | ✅   | Ingest a web URL / Website                                     |
| `POST`   | `/api/ingest/github`                       | ✅   | Ingest an entire GitHub repository tree                        |
| `GET`    | `/api/ingest/status/{task_id}`             | ✅   | Poll background worker ingestion job status                    |
| `GET`    | `/api/ingest/documents?type=pdf`           | ✅   | Filter user documents by type: `pdf` \| `web` \| `github`      |
| `DELETE` | `/api/ingest/document/{document_id}`       | ✅   | Hard-deletes document text, raw files, and vectors securely    |

### Chat 

| Method | Endpoint                                            | Description                                     |
| ------ | --------------------------------------------------- | ----------------------------------------------- |
| `POST` | `/api/chats/{id}/messages/send`                     | RAG-augmented query (Local Semantic + BM25)     |
| `POST` | `/api/chats/{id}/messages/send?include_public=true` | Injects chunks from `public` opted-in documents |

---

## 🚀 Quick Start (Local Embedding RAG)

1. **Spin up Local Storage:**
```bash
# Optional: Use docker mapped Qdrant unless Qdrant Cloud is used.
docker run -d -p 6333:6333 qdrant/qdrant
```

2. **Configure `.env` (Privacy First Stack):**
```bash
RAG_ENABLED=true
QDRANT_URL=http://localhost:6333
EMBEDDING_PROVIDER=local
EMBEDDING_MODEL=BAAI/bge-small-en-v1.5
OPENROUTER_API_KEY=sk-...  # Only LLM output is done externally
```

3. **Install & Run:**
```bash
uv sync
uv run uvicorn main:app
```

4. **Watch the Process:**
Run `tail -f logs/app.log` in a separate terminal. The extensive DEBUG pipeline will exactly print out the parsing char counts, query scores, local embeddings execution duration, generation prompts, and LLM roles passing over the APIs.
