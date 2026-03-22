from fastapi import APIRouter, Depends
from .deps import get_current_user

router = APIRouter()

@router.get("/me")
async def read_users_me(current_user: dict = Depends(get_current_user)):
    # Return user info without the hashed password
    return {
        "user": current_user
    }
