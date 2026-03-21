from fastapi import APIRouter, Depends
from .deps import get_current_user

router = APIRouter()

@router.get("/me")
async def read_users_me(current_user: dict = Depends(get_current_user)):
    # Return user info without the hashed password
    return {
        "id": current_user["_id"],
        "email": current_user["email"],
        "is_active": current_user["is_active"],
        "created_at": current_user["created_at"]
    }
