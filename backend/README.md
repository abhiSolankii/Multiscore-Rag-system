# Multiscore RAG Backend

A high-performance Retrieval-Augmented Generation (RAG) system with a secure authentication layer and modular architecture.

## 🚀 Current Features

### 🔐 Authentication & Security

- **JWT-Based Auth**: Secure Access and Refresh token implementation.
- **Token Rotation**: Refresh token rotation for enhanced security.
- **Secure Hashing**: Using Bcrypt for password protection.
- **Protected Routes**: Middleware-style dependency injection for user session verification (HTTPBearer).

### 💬 Chat & LLM Integration

- **OpenRouter Support**: Uses OpenAI SDK to dynamically target OpenRouter.
- **Context Handling**: Retains recent message history (configurable) to pass context to the LLM.

### 🗄️ Database & Core

- **Asynchronous MongoDB**: Integrated using `Motor` for non-blocking I/O.
- **Settings Management**: Environment-based configuration using `Pydantic Settings`.
- **Modular Imports**: Clean, package-level imports enabled via `__init__.py` files.
- **Structured Logging**: stdlib `logging` with console + rotating file output (`logs/app.log`).

---

## 🏗️ Architecture & Flow (Simplified & Scalable)

Our backend handles requests efficiently through clear boundary separations, heavily optimized for dropping in heavy data pipelines and RAG components later:

1. **API Layer (`api/`)**: Handlers define what standard JSON inputs they expect using Pydantic `BaseModel`s (e.g., `ChatCreate`).
2. **Dependency Injection (`api/deps.py`)**: Auth and Database connections are naturally resolved. We pass **raw MongoDB dictionaries natively** downstream. Doing this skips expensive continuous parsing inside our code and unifies references (always using `["_id"]`, exactly like the database).
3. **Service Logic (`generation/`, etc.)**: Processing code (LLMs, indexing, retrievers) only touches raw native data formats. They don't need to know anything about API models.
4. **Serialization (`schemas/`)**: Upon returning the dictionary to the client, Pydantic's `response_model` beautifully steps back in, safely translating database representations (like `_id`) into RESTful standards (like `id`).

This decoupled system ensures that as we introduce the **RAG Vector Search** or **Data Ingestion Workers**, they will natively snap into the `db` layer without restructuring the entire API logic.

---

## 📋 Logging

All log output uses Python's stdlib `logging` — no external packages.

### Log format
```
2026-03-18 02:14:59 [INFO    ] api.auth_endpoint - User logged in: user@email.com (id=abc123)
2026-03-18 02:14:59 [INFO    ] main - POST /api/chats/xyz/messages/send → 200 (312.4ms)
2026-03-18 02:14:59 [WARNING ] retrieval.retriever_manager - Private collection 'user_abc' not found or search failed
2026-03-18 02:14:59 [ERROR   ] ingestion.pipeline - Ingestion failed: task=... error=... (with traceback)
```

### Sinks
| Sink | Location | Rotation |
|---|---|---|
| Console | stdout | — |
| File | `backend/logs/app.log` | Daily, 7 days kept |

### Log levels in use
| Level | When |
|---|---|
| `DEBUG` | Per-stage details (chunk counts, vector sizes, query text) — written to file only |
| `INFO` | Normal operational events (login, chat created, ingest complete, request timing) |
| `WARNING` | Recoverable issues (RAG fallback, empty retrieval, failed login attempt) |
| `ERROR` | Failures with full tracebacks (LLM error, ingestion failure, Qdrant delete failed) |

### Configuration
```bash
# .env
DEBUG_LOGGING=false   # default — both console and file show INFO+
DEBUG_LOGGING=true    # file gets DEBUG+; console stays INFO+ (terminal never gets noisy)
```

> **Note on third-party loggers**: `pymongo`, `qdrant_client`, `httpx`, and similar
> libraries are silenced to `WARNING` on **both sinks**. Their internal heartbeat /
> connection / topology DEBUG messages are never useful for application debugging.

### Adding logs to a new module
```python
from core.logging import get_logger
logger = get_logger(__name__)   # logger name = module path e.g. retrieval.vector_search

logger.info("Something happened: key=%s", value)
logger.error("Something failed", exc_info=True)  # includes traceback
```

---

## 📂 Project Structure

```text
backend/
├── api/                    # Endpoint definitions
│   ├── auth_endpoint.py    # Login, Signup, Refresh
│   ├── chat_endpoints.py   # Chat & Messaging routes
│   ├── routes.py           # Protected user routes
│   └── deps.py             # Auth dependencies
├── core/                   # System-wide logic
│   ├── config.py           # Environment settings
│   └── security.py         # Password & JWT logic
├── db/                     # Database connection
│   └── mongodb.py          # Motor/MongoDB client
├── schemas/                # Pydantic data validation
│   ├── chat.py             # Chat & Message schemas
│   └── user.py             # User & Token schemas
├── generation/             # LLM interaction
│   └── llm.py              # OpenRouter API integration
├── ingestion/              # [Placeholder] Data pipelines
├── retrieval/              # [Placeholder] Search logic
├── routing/                # [Placeholder] Query handling
├── workers/                # [Placeholder] Background tasks
├── main.py                 # Application entry point
└── pyproject.toml          # Dependencies & metadata
```

---

## 🛠️ Setup & Installation

### 1. Prerequisites

- Python 3.12+
- MongoDB instance (Local or Atlas)

### 2. Environment Setup

Create a `.env` file from the example:

```bash
cp .env.example .env
```

Update the `SECRET_KEY`, `MONGODB_URL`, `OPENROUTER_API_KEY`, and `LLM_MODEL` inside `.env`.

### 3. Install Dependencies

```bash
uv sync
```

### 4. Run the Application (Development)

```bash
uv run uvicorn main:app --reload
```

The API will be available at `http://localhost:8000`.
Docs are available at `http://localhost:8000/docs`.

---

## 📡 API Endpoints (Current)

| Method | Endpoint            | Description           | Auth Required |
| :----- | :------------------ | :-------------------- | :------------ |
| `POST` | `/api/auth/signup`  | Register a new user   | No            |
| `POST` | `/api/auth/login`   | Email/Password login  | No            |
| `POST` | `/api/auth/refresh` | Rotate JWT tokens     | No            |
| `GET`  | `/api/users/me`     | Get current user info | **Yes**       |
| `POST` | `/api/chats/create` | Create a new chat session | **Yes**   |
| `GET`  | `/api/chats/list`   | Fetch user's chats    | **Yes**       |
| `POST` | `/api/chats/{id}/messages/send` | Send a message to get an LLM response | **Yes** |
| `GET`  | `/api/chats/{id}/messages/list` | Retrieve messages for a chat | **Yes**  |
