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
- `is_admin` flag on every user (default `False`) — elevate manually in MongoDB to grant admin access

### 👑 Admin System

- **`GET /api/admin/users`** — list all users (passwords excluded)
- **`PATCH /api/admin/users/:id`** — edit any user's `tokens_remaining`, `total_tokens_used`, `is_active`, `is_admin`, and `config`. Email and password are protected from this endpoint.
- **`GET /api/admin/documents`** — list all documents across all users
- **`DELETE /api/admin/documents/:id`** — delete any document
- All admin routes are guarded by `require_admin` dependency — returns `403` for any user without `is_admin: true`
- To promote a user: `db.users.updateOne({ email: "..." }, { $set: { is_admin: true } })`

### 🗄️ Ingestion & RAG Pipeline

- **Multi-source ingestion** — PDFs, web pages, entire GitHub repositories (async)
- **Intelligent chunking** — recursive `tiktoken` (cl100k_base) splitter with strict token budget (default ~512 + 64 overlap)
- **Dynamic collection mapping** — per-user + per-embedding-model collections (e.g. `user_123_baai_bge_small`)
- **Query Decomposition** — automated multi-query generation and routing to eliminate semantic dilution across heterogeneous topics
- **Hybrid Retrieval** — parallel semantic vector queries + BM25 keyword search + optional cross-encoder reranking
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

### 📦 Chunk Metadata & Rich Citations

Every stored chunk includes exact origin footprints:

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

→ **Upfront Loading**: For peak frontend UI rendering, the _exact chunks_ used by the RAG search are yielded inside the SSE stream instantly (`event: status`, `data: {"step": "retrieved", "meta": {"chunks": [...]}}`) BEFORE the LLM begins streaming text.
→ **Index-Based Citation Mapping**: To eliminate LLM hallucinations and reduce token overhead, the backend labels context chunks as `[[Chunk 1]]`, `[[Chunk 2]]`, etc. The assistant is strictly commanded to cite using only these tokens. Frontends can then use the order of the `chunks` array from the `retrieved` event to map these tokens back to rich metadata (PDF source, page numbers, etc.) for interactive UI elements.

### 📊 Token Metrics & Cost Tracking

- **API Transparency**: `generate_chat_stream` automatically invokes `$stream_options` to boldly capture exact OpenRouter/OpenAI token counts (`prompt_tokens`, `completion_tokens`).
- **Global Budgeting**: Every chat cleanly captures and appends local token metadata strictly to the isolated `Message` document in the DB.
- **Aggregation**: It executes an incredibly fast `$inc` query to update the overall `total_tokens_used` ceiling inside the parent `User` profile dynamically.
- **Real-time UX**: During generation, the SSE handler cleanly bridges an `event: usage` packet immediately as the stream closes.

---

## 📂 Project Structure

```text
backend/
├── api/                    # Routers: auth, chat, ingestion, admin
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
    ├─ Decompose Query (multi-query rewrite via LLM)
    ↓
retriever_manager.retrieve()
    ├─ Embed ALL sub-queries (local HF or OpenAI)
    ├─ Vector search loop (user private collection)
    ├─ Optional: vector search in public collection
    ├─ Deduplicate (hash-based) over merged results
    ├─ BM25 keyword search + Reciprocal Rank Fusion (against original query)
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

### Advanced / Differentiating Features

1. **Per-chat document blacklisting (`inactive_docs`)**
   - Users can turn individual documents **on/off** inside a specific chat without affecting other chats or needing to re-ingest/delete anything.
   - Handled natively via Qdrant’s ultra-fast `must_not` filter on document_id — zero re-indexing cost.

2. **Public vs Private document segregation with toggle (`include_public`)**
   - Documents can be marked `is_public` at ingestion time.
   - Per-chat toggle decides whether the RAG searches **only private**, **only public**, or **both** — with strict permission isolation to prevent cross-user leakage.

3. **Per-embedding-model vector isolation**
   - Every combination of user + embedding model gets its own Qdrant collection (`user_123_baai_bge_small`, `user_123_openai_text-embedding-3-large`, etc.).
   - Prevents dimension mismatch crashes when users switch embedders (local ↔ OpenAI) — rare in open-source RAGs.

4. **Strict vs Hybrid response mode per chat**
   - `"strict"`: LLM is forced to say “No information found” if no relevant chunks → zero hallucination fallback.
   - `"hybrid"`: Allows gentle supplementation with model’s internal knowledge when context is incomplete.
   - Mode stored per chat, not globally.

5. **Decoupled index-based citations (`[[Chunk 1]]` style)**
   - LLM never sees real filenames/pages → can’t hallucinate sources.
   - Backend assigns temporary indices → sends full rich metadata (source, page, type, etc.) upfront in SSE `retrieved` event → frontend maps citations interactively.

6. **Upfront chunk metadata in streaming (`retrieved` SSE event)**
   - Exact list of used chunks (with metadata) is sent **before** any LLM tokens → frontend can show sources/previews instantly while answer streams in.

7. **Query decomposition + multi-vector parallel retrieval**
   - Automatically breaks complex/multi-topic questions into sub-queries → embeds & searches each separately → merges & deduplicates.
   - Eliminates semantic dilution that kills single-vector retrieval on compound questions.

8. **Real cross-encoder reranking (not just vector + BM25)**
   - Optional but production-grade cross-encoder re-scores top candidates after hybrid retrieval → dramatically better precision than cosine + keyword alone.

9. **Graceful interrupted stream handling with accurate token charging**
   - If user disconnects mid-stream, backend uses `tiktoken` fallback to calculate exact prompt + generated tokens → charges correctly instead of giving free partial answers.

10. **Dynamic per-user token budgeting with hard truncation**
    - `max_tokens` sent to LLM is min(remaining_quota, model_limit) → response physically stops the instant quota hits zero (no overdraft loophole).

11. **Type-aware rich chunk metadata preserved**
    - Every chunk tracks: `source` (pdf/web/github), `type`, `page` (PDF only), `chunk_index`, `token_count` → enables precise citations, page jumps in PDF viewer, GitHub file links, etc.

12. **Pluggable everything without logic changes**
    - Swap LLM (any OpenRouter model), embeddings (local HF ↔ OpenAI), vector DB URL → only `.env` change needed.
    - Collections auto-adapt to new embedder dimensions.

13. **SSE thinking traces with granular steps**
    - Real-time status events: `retrieving` → `retrieved` (with chunks) → `building_context` → `calling_llm` → `generating` → tokens.
    - Gives ChatGPT-like “thinking” UX without faking it.

# Challenges Faced & Solutions

3. **Fixed Chunk Size vs. Semantic / Hierarchical Chunking Trade-offs**
   - **Challenge:** Fixed-size or simple recursive splitting often splits sentences/tables/code blocks mid-unit → lost context or averaged embeddings (multi-topic dilution inside chunk). Pure semantic chunking (LLM-sentence distance) is expensive/slow at scale and uneven.
   - **Solution:** Hybrid approach: semantic boundary detection + controlled overlap + parent-child / hierarchical indexing (small chunks for precision + larger summaries/parents for context) to balance recall, precision, and cost.

4. **Normal Embedding vs Hybrid Search**
   - **Challenge:** Initially, we used only normal embedding search. However, we found that it was not very effective in retrieving relevant information.
   - **Solution:** We introduced hybrid search which combines normal embedding search with BM25 keyword search. This improved the retrieval accuracy significantly.

5. **Token Quota Loophole: Crossing the Limit Mid-Stream**
   - **Challenge:** To protect costs, we checked if a user had `tokens_remaining > 0` before initiating an LLM query. The fatal flaw was that a user with merely 10 tokens left could invoke a massive 4000-token prompt, wildly overdrafting their bounds before the query terminated naturally.
   - **Solution:** We introduced a dynamic `actual_max_tokens = min(max_token_limit, tokens_remaining)` variable inside the chat endpoint. By passing this minimum natively to the LLM's `max_tokens` restrictor, the LLM physically truncates response generation the exact millisecond the user's account drains.

6. **Token Quota Loophole: Free Tokens from Interrupted Streams**
   - **Challenge:** OpenAI-compatible APIs only send the usage data envelope in the absolute final chunk of an established stream. If a user interrupts generation mid-stream (e.g. closing the browser early), the API drops connection, the `usage` chunk never surfaces, and users receive the generated snippet completely free of charge.
   - **Solution:** We implemented a generic fallback inside the SSE generation loop's `finally` block. If the stream exits but the API `tokens_used` tracker is empty, we spin up the `tiktoken` library to manually calculate both prompt and generated output tokens, accurately auto-charging the user's balance for exactly what they yielded before disconnecting.

7. **Strict Mode Ignoring Empty Context (Falling back to plain LLM)**
   - **Challenge:** When the Vector DB returned 0 chunks (e.g. searching across unindexed/empty documents), the backend was designed to short-circuit and revert to a `PLAIN_SYSTEM_PROMPT` (like ChatGPT). This bypassed the `"strict"` chat mode restrictions, causing the LLM to hallucinate answers instead of correctly stating that no context was found.
   - **Solution:** We removed the short-circuiting logic in `answer_generator.py`. Now, even if the Vector DB returns 0 chunks, the flow correctly passes an empty context list to `build_rag_system_prompt()`. We updated the prompt template builder to explicitly format this empty state as `"No information found in the selected files."`, forcing the LLM to abide by its strict directive and politely refuse to answer.

8. **Multi-Topic Queries and Semantic Dilution in Vector Retrieval**
   - **Challenge:** When users pose a single query asking about multiple completely distinct concepts (e.g., "Where is the headquarters of the Indian army and is there corruption in the Judiciary?"), the resulting text embedding becomes an "averaged" hybrid vector. In the high-dimensional vector space, one topic usually exerts a slightly stronger mathematical pull, placing the query vector much closer to chunks of the dominant topic. Consequently, the vector database disproportionately returns chunks for only one half of the query, dropping critical context for the other half completely.
   - **Solution:** We implemented a **Query Decomposition (Multi-Query)** pipeline. Before retrieval, the raw query is passed to an LLM `query_rewriter` with instructions to break multi-part queries down into an array of isolated sub-queries (e.g., `["Where is the Indian army HQ?", "Is there corruption in the judiciary?"]`). We then utilize `embed_many` to map these sub-queries into independent vectors, run vector searches on all of them in parallel, consolidate the results into a massive shared pool, and mathematically deduplicate them. Finally, we run standard Hybrid/BM25 and Cross-Encoder reranking against the original raw query to enforce unified relevance before feeding the rich context back to the primary LLM.

9. **Source Citation Complexity and Hallucination**
   - **Challenge:** Initially, the system prompt injected full metadata strings (e.g., `[Source: document.pdf, Page 12]`) for every chunk. This was problematic for three reasons: it consumed excessive token bandwidth, the redundant filenames confused the LLM during multi-topic retrieval, and the assistant occasionally hallucinated incorrect page/source mappings.
   - **Overall Strategy for Effective Source Citation:** To achieve zero-hallucination and high performance, we designed a **Decoupled Indexing Strategy** implemented from scratch:
     1. **Backend Indexing (Temporal Identity):** Instead of forcing the LLM to parse and reproduce full file paths, the prompt builder assigns every retrieved chunk a temporal index (`[[Chunk 1]]`, `[[Chunk 2]]`). This index only exists within the context of a single request, creating a simple, unambiguous way for the LLM to reference data.
     2. **Prompt Logic Enforcement:** Both "strict" and "hybrid" system prompts are hard-wired with a directive to _only_ cite using these tokens. By removing file metadata from the prompt blocks entirely, we prevent the LLM from ever having the "vocabulary" to hallucinate a wrong source filename.
     3. **Metadata Pipeline (SSE Status):** We leveraged the Server-Sent Events (SSE) stream to push the full metadata payload to the frontend as soon as retrieval completes (using the `retrieved` event). This payload includes the original `document_id`, `page_number`, and `source` string for every chunk in the exact same array order as the indexing (1, 2, 3...).
     4. **Frontend UI Rendering:** The final LLM response contains tokens like `[[Chunk 1]]`. The frontend performs a simple regex match to find these tokens and replaces them with interactive UI buttons or links. The frontend "knows" that `[[Chunk 1]]` corresponds to index 0 of the `retrieved` chunks array, allowing it to render the beautiful source details without the LLM ever needing to process them.

# Future Tasks & Roadmap

This document outlines planned improvements, refactors, and feature additions for the Multiscore RAG backend and its integration with the frontend.

## 1. Streaming & Real-Time UX - Done

- **LLM Streaming (ChatGPT-style)**: Implement Server-Sent Events (SSE) to stream the final LLM response token-by-token.
  - _Debugging Consideration_: To prevent streams from obfuscating backend debug logs, streaming will be strictly controlled via a toggle in the `.env` settings (e.g., `ENABLE_STREAMING=true`).
- **Live "Thinking" Status Traces**: Send live, step-by-step progress updates to the frontend during the generation phase (e.g., `"Retrieving documents..."` → `"Building context..."` → `"LLM is thinking..."`). This provides transparency and improves perceived latency.

## 2. Schema Expansion: User Configs - Done

- **User Preferences Object**: Expand the `User` MongoDB schema to include a dedicated `settings` or `config` object.
  - This object will persist user-specific toggles horizontally across the app, such as whether they have streaming responses turned on/off by default, UI themes, or default prompt behaviors.

## 3. Schema Expansion: Chat-wise Configs - Done

Certain features require granular control at the individual _Chat_ level, rather than globally:

- **Strict vs. Hybrid Knowledge**: A toggle in the `Chat` schema allowing the user to decide if the LLM should answer _strictly_ using the provided PDF/Web sources, or if it is allowed to seamlessly merge the sources with its own internet/training knowledge.
- **Document-Level Filtering**: A chat-wise whitelist/blacklist. The frontend will display a list of all documents owned by the user, allowing them to explicitly toggle specific documents off for _that specific chat_. The `retriever_manager` will apply an `$in` or `$nin` filter on `document_id` during the Qdrant search.

## 4. Ingestion / Source Improvements

Current loaders need to be upgraded for higher-fidelity text extraction:

- **PDFs**:
  - Add Table extraction capabilities (crucial for financial/scientific docs).
  - Enhance page splitting boundaries.
  - Strip header/footer noise (page numbers, repeating titles) that disrupts semantic meaning.
- **Web Pages**:
  - Implement a "Readability" parse to aggressively strip out navbars, sidebars, footers, and ads, isolating only the core article text.
- **GitHub Repositories**:
  - Implement strict `.gitignore` style filtering.
  - **Ignore**: `node_modules/`, `*.lock`, `venv/`, and all binary/image files.
  - **Focus explicitly on**: `README`, `/docs`, `.md`, `.py`, `.ts`, `.js`, etc.

## 5. Rich Source Citations (Frontend UX) - Done

When the LLM cites a source, the frontend UX should be deeply interactive:

- **Chunk Previews**: When the user hovers over a cited source `[Source: document.pdf]`, a modal/popup should appear displaying the exact textual chunks that the LLM pulled that information from. The backend will package the `used_chunks` data array alongside the final text response.
- **Clickable Links**:
  - Web sources should be rendered as clickable `a href` tags.
  - PDF sources should ideally bridge to an active PDF viewer in the frontend, jumping directly to the referenced page.

## 6. Answer Execution Modes

- Give the user a dropdown or quick-action buttons to enforce the format of the response natively in the system prompt.
- **Modes**: `Summary`, `Bullet points`, `Table format`, `Detailed explanation`.

## 8. Context Memory Optimization

- We currently blindly fetch the latest 5 messages + the current query to maintain conversation context.
- _Improvement needed_: Explore upgrading this from a fixed `message_count` to a dynamic **Token Budget**. If the last 2 messages were massive 4,000-word essays, fetching 5 could blow out the OpenRouter context window. It should dynamically pack as many prior messages as fit comfortably into a `MAX_HISTORY_TOKENS` limit.

## 9. User Token Limits & Cost Tracking - Done

- **Is it possible?** Yes! Every API response from OpenRouter includes a `usage` object detailing exact `prompt_tokens`, `completion_tokens`, and `total_tokens`.
- Expand the message schema to store `tokens_used` for every single assistant response.
- Expose this data to the frontend so the user can literally see the token cost attached to each message bubble.
- Add a `max_token_limit` and `total_tokens_used` field to the `User` config. Deduct/increment tokens per chat to enforce quotas or offer tiered subscription plans.

## 10. Make an architecture diagram for the project
