"""
Centralized logging configuration.

Usage in any module:
    from core.logging import get_logger
    logger = get_logger(__name__)
    logger.info("Something happened")

Two sinks with intentionally different levels:
  Console  — always INFO+. Terminal stays clean regardless of DEBUG_LOGGING flag.
  File     — DEBUG when DEBUG_LOGGING=true, else INFO. For post-hoc debugging.

Third-party internal loggers (pymongo, qdrant_client, httpx, etc.) are silenced
to WARNING on both sinks — their heartbeat / connection chatter is never useful.
"""
from __future__ import annotations

import logging
import logging.handlers
import os
import sys
from core.config import settings


_LOG_FORMAT = "%(asctime)s [%(levelname)-8s] %(name)s - %(message)s"
_DATE_FORMAT = "%Y-%m-%d %H:%M:%S"

# Third-party loggers to silence to WARNING (their DEBUG/INFO is internal noise)
_NOISY_LOGGERS = [
    "pymongo",
    "pymongo.topology",
    "pymongo.connection",
    "pymongo.command",
    "pymongo.serverSelection",
    "pymongo.monitoring",
    "motor",
    "qdrant_client",
    "httpx",
    "httpcore",
    "sentence_transformers",
    "transformers",
    "huggingface_hub",
    "uvicorn.access",   # We log requests ourselves via middleware
]


def setup_logging() -> None:
    """
    Configure the root logger with console + rotating file handlers.
    Call this once in main.py before the app starts.

    DEBUG_LOGGING=false (default)
        Console : INFO+
        File    : INFO+

    DEBUG_LOGGING=true
        Console : INFO+  ← deliberately kept at INFO, terminal stays clean
        File    : DEBUG+ ← verbose detail written to file only
    """
    log_dir = "logs"
    os.makedirs(log_dir, exist_ok=True)

    formatter = logging.Formatter(_LOG_FORMAT, datefmt=_DATE_FORMAT)

    # ── Console handler — always INFO, never noisy ────────────────────────────
    console_handler = logging.StreamHandler(sys.stdout)
    console_handler.setFormatter(formatter)
    console_handler.setLevel(logging.INFO)

    # ── Rotating file handler — DEBUG when flag is on ─────────────────────────
    file_handler = logging.handlers.TimedRotatingFileHandler(
        filename=os.path.join(log_dir, "app.log"),
        when="midnight",
        interval=1,
        backupCount=7,
        encoding="utf-8",
    )
    file_handler.setFormatter(formatter)
    file_level = logging.DEBUG if settings.DEBUG_LOGGING else logging.INFO
    file_handler.setLevel(file_level)

    # ── Root logger ───────────────────────────────────────────────────────────
    # Set root to DEBUG so file_handler can capture it; console_handler's own
    # level gates what reaches the terminal.
    root_logger = logging.getLogger()
    root_logger.setLevel(logging.DEBUG)
    root_logger.handlers.clear()
    root_logger.addHandler(console_handler)
    root_logger.addHandler(file_handler)

    # ── Silence noisy third-party loggers on BOTH sinks ──────────────────────
    for name in _NOISY_LOGGERS:
        logging.getLogger(name).setLevel(logging.WARNING)


def get_logger(name: str) -> logging.Logger:
    """
    Get a named logger. Call at module level:
        logger = get_logger(__name__)
    """
    return logging.getLogger(name)

