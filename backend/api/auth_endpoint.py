from fastapi import APIRouter, Depends, HTTPException, status
from jose import jwt, JWTError
from datetime import datetime
import uuid

from core import settings, verify_password, get_password_hash, create_access_token, create_refresh_token
from core.logging import get_logger
from db import get_database
from schemas import UserCreate, UserLogin, UserResponse, Token, TokenPayload, RefreshTokenRequest

logger = get_logger(__name__)
router = APIRouter()

@router.post("/signup", response_model=UserResponse)
async def signup(user_in: UserCreate):
    logger.debug("Signup attempt: email=%s", user_in.email)
    db = get_database()
    existing_user = await db.users.find_one({"email": user_in.email})
    if existing_user:
        logger.debug("Signup rejected — email already exists: %s", user_in.email)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User with this email already exists",
        )
    
    user_dict = {
        "_id": str(uuid.uuid4()),
        "email": user_in.email,
        "hashed_password": get_password_hash(user_in.password),
        "is_active": True,
        "total_tokens_used": 0,
        "tokens_remaining": 100000,
        "config": user_in.config.model_dump(),
        "created_at": datetime.utcnow()
    }
    
    await db.users.insert_one(user_dict)
    logger.info("New user registered: %s", user_in.email)
    logger.debug("New user created: id=%s email=%s", user_dict["_id"], user_in.email)
    
    user_dict["id"] = user_dict.pop("_id")
    return user_dict

@router.post("/login", response_model=Token)
async def login(user_in: UserLogin):
    logger.debug("Login attempt: email=%s", user_in.email)
    db = get_database()
    user = await db.users.find_one({"email": user_in.email})
    
    if not user or not verify_password(user_in.password, user["hashed_password"]):
        logger.warning("Failed login attempt for email: %s", user_in.email)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    if not user["is_active"]:
        raise HTTPException(status_code=400, detail="Inactive user")

    access_token = create_access_token(subject=user["_id"])
    refresh_token = create_refresh_token(subject=user["_id"])
    logger.info("User logged in: %s (id=%s)", user["email"], user["_id"])
    logger.debug(
        "Tokens issued: user_id=%s | access=30min | refresh=%dd",
        user["_id"], settings.REFRESH_TOKEN_EXPIRE_DAYS,
    )
    
    return {
        "access_token": access_token,
        "refresh_token": refresh_token,
        "token_type": "bearer",
    }

@router.post("/refresh", response_model=Token)
async def refresh_token(request: RefreshTokenRequest):
    logger.debug("Token refresh attempt")
    try:
        payload = jwt.decode(
            request.refresh_token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM]
        )
        token_data = TokenPayload(**payload)
        if token_data.type != "refresh":
            raise HTTPException(status_code=401, detail="Invalid token type")
    except (JWTError, Exception):
        logger.debug("Token refresh failed — invalid or expired refresh token")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate refresh token",
        )
    
    db = get_database()
    user = await db.users.find_one({"_id": token_data.sub})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    if not user["is_active"]:
        raise HTTPException(status_code=400, detail="Inactive user")

    access_token = create_access_token(subject=user["_id"])
    new_refresh_token = create_refresh_token(subject=user["_id"])
    logger.info("Tokens refreshed for user id=%s", token_data.sub)
    logger.debug("New tokens issued for user_id=%s", token_data.sub)
    
    return {
        "access_token": access_token,
        "refresh_token": new_refresh_token,
        "token_type": "bearer",
    }
