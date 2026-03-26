from fastapi import APIRouter, Depends, HTTPException, status
from db import get_database
from .deps import get_current_user
from core.logging import get_logger

logger = get_logger(__name__)
router = APIRouter()


def require_admin(current_user: dict = Depends(get_current_user)):
    if not current_user.get("is_admin"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin access required")
    return current_user


# ── List all users ────────────────────────────────────────────────────────────
@router.get("/users")
async def list_users(admin: dict = Depends(require_admin)):
    db = get_database()
    users = await db.users.find(
        {},
        {"hashed_password": 0}  # never expose password hashes
    ).to_list(length=1000)
    for u in users:
        u["id"] = u.pop("_id")
    return users


# ── Get single user ───────────────────────────────────────────────────────────
@router.get("/users/{user_id}")
async def get_user(user_id: str, admin: dict = Depends(require_admin)):
    db = get_database()
    user = await db.users.find_one({"_id": user_id}, {"hashed_password": 0})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    user["id"] = user.pop("_id")
    return user


# ── Update user (tokens, config, is_active, is_admin) ────────────────────────
@router.patch("/users/{user_id}")
async def update_user(user_id: str, data: dict, admin: dict = Depends(require_admin)):
    db = get_database()
    # Disallow changing email or password via this endpoint
    data.pop("email", None)
    data.pop("hashed_password", None)
    data.pop("password", None)

    result = await db.users.update_one({"_id": user_id}, {"$set": data})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="User not found")

    user = await db.users.find_one({"_id": user_id}, {"hashed_password": 0})
    user["id"] = user.pop("_id")
    logger.info("Admin %s updated user %s", admin["_id"], user_id)
    return user


# ── List ALL documents (across all users) ─────────────────────────────────────
@router.get("/documents")
async def list_all_documents(admin: dict = Depends(require_admin)):
    db = get_database()
    docs = await db.ingestion_jobs.find({}).to_list(length=5000)
    return docs


# ── Delete any document ───────────────────────────────────────────────────────
@router.delete("/documents/{document_id}")
async def delete_any_document(document_id: str, admin: dict = Depends(require_admin)):
    db = get_database()
    doc = await db.ingestion_jobs.find_one({"document_id": document_id})
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    await db.ingestion_jobs.delete_one({"document_id": document_id})
    logger.info("Admin %s deleted document %s", admin["_id"], document_id)
    return {"message": "Document deleted"}
