import time
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from db import connect_to_mongo, close_mongo_connection
from core import settings, setup_logging
from core.logging import get_logger
from api import auth_router, user_router, chat_router, ingestion_router, admin_router

# ── Logging — must be first ───────────────────────────────────────────────────
setup_logging()
logger = get_logger(__name__)

app = FastAPI(title=settings.PROJECT_NAME)

# ── CORS ──────────────────────────────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Request logging middleware ────────────────────────────────────────────────
@app.middleware("http")
async def log_requests(request: Request, call_next):
    start = time.perf_counter()
    response = await call_next(request)
    duration_ms = (time.perf_counter() - start) * 1000
    logger.info(
        "%s %s → %s (%.1fms)",
        request.method,
        request.url.path,
        response.status_code,
        duration_ms,
    )
    return response

# ── Lifecycle ─────────────────────────────────────────────────────────────────
@app.on_event("startup")
async def startup():
    logger.info("Starting %s...", settings.PROJECT_NAME)
    await connect_to_mongo()
    if settings.RAG_ENABLED:
        from db.vector_db import get_qdrant_client
        get_qdrant_client()
        logger.info("Qdrant client initialised (RAG enabled)")
    else:
        logger.info("RAG disabled — running in plain LLM mode")

@app.on_event("shutdown")
async def shutdown():
    logger.info("Shutting down %s", settings.PROJECT_NAME)
    await close_mongo_connection()

# ── Routers ───────────────────────────────────────────────────────────────────
app.include_router(auth_router,      prefix="/api/auth",   tags=["auth"])
app.include_router(user_router,      prefix="/api/users",  tags=["users"])
app.include_router(chat_router,      prefix="/api/chats",  tags=["chats"])
app.include_router(ingestion_router, prefix="/api/ingest", tags=["ingestion"])
app.include_router(admin_router,     prefix="/api/admin",  tags=["admin"])

@app.get("/")
async def root():
    return {"message": "Welcome to Multiscore RAG API", "rag_enabled": settings.RAG_ENABLED}
