from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime

class ChatBase(BaseModel):
    title: str = Field(..., max_length=255)

class ChatCreate(ChatBase):
    pass

class ChatResponse(ChatBase):
    id: str = Field(..., alias="_id")
    user_id: str
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

class MessageBase(BaseModel):
    role: str = Field(..., pattern="^(user|assistant|system)$")
    content: str

class MessageCreate(MessageBase):
    pass

class MessageResponse(MessageBase):
    id: str = Field(..., alias="_id")
    chat_id: str
    created_at: datetime

    class Config:
        from_attributes = True
