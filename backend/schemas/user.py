from pydantic import BaseModel, EmailStr, Field
from typing import Optional, List
from datetime import datetime

class UserConfig(BaseModel):
    enable_streaming: bool = True
    default_mode: str = Field(default="hybrid", pattern="^(strict|hybrid)$")

class UserBase(BaseModel):
    email: EmailStr
    config: UserConfig = Field(default_factory=UserConfig)

class UserCreate(UserBase):
    password: str = Field(..., min_length=8)

class UserLogin(UserBase):
    password: str

class UserUpdate(BaseModel):
    password: Optional[str] = Field(None, min_length=8)
    is_active: Optional[bool] = None
    config: Optional[UserConfig] = None

class UserInDB(UserBase):
    id: str = Field(..., alias="_id")
    hashed_password: str
    is_active: bool = True
    created_at: datetime = Field(default_factory=datetime.utcnow)

class UserResponse(UserBase):
    id: str
    is_active: bool
    created_at: datetime

    class Config:
        from_attributes = True

class Token(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"

class TokenPayload(BaseModel):
    sub: Optional[str] = None
    type: Optional[str] = None

class RefreshTokenRequest(BaseModel):
    refresh_token: str
