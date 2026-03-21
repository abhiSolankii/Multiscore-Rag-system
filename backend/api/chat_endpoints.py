from fastapi import APIRouter, Depends, HTTPException, status
from typing import List
from datetime import datetime
from bson import ObjectId

from schemas import (
    ChatCreate, 
    ChatResponse, 
    MessageCreate, 
    MessageResponse
)
from api.deps import get_current_user
from db import get_database
from core.config import settings
from core.logging import get_logger
from generation.answer_generator import generate_rag_response

logger = get_logger(__name__)
router = APIRouter()

@router.post("/create", response_model=ChatResponse)
async def create_chat(
    chat_in: ChatCreate,
    current_user: dict = Depends(get_current_user)
):
    """Create a new chat session."""
    db = get_database()
    
    new_chat = {
        "user_id": current_user["_id"],
        "title": chat_in.title,
        "created_at": datetime.utcnow(),
        "updated_at": datetime.utcnow(),
    }
    
    result = await db.chats.insert_one(new_chat)
    created_chat = await db.chats.find_one({"_id": result.inserted_id})
    logger.info("Chat created: id=%s user=%s", str(result.inserted_id), current_user["_id"])
    
    created_chat["_id"] = str(created_chat["_id"])
    return created_chat

@router.get("/list", response_model=List[ChatResponse])
async def get_chats(
    current_user: dict = Depends(get_current_user)
):
    """Get all chats for the current user."""
    db = get_database()
    
    chats_cursor = db.chats.find({"user_id": current_user["_id"]}).sort("updated_at", -1)
    chats = await chats_cursor.to_list(length=100)
    
    for chat in chats:
        chat["_id"] = str(chat["_id"])
        
    return chats

@router.post("/{chat_id}/messages/send")
async def send_message(
    chat_id: str,
    message_in: MessageCreate,
    current_user: dict = Depends(get_current_user),
    include_public: bool = False,
):
    """
    Send a message and get an AI response.

    Query param:
      include_public=true  →  also search the shared public knowledge base
    """
    db = get_database()
    
    try:
        chat_obj_id = ObjectId(chat_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid chat ID format")
    
    # 1. Verify chat ownership
    chat = await db.chats.find_one({"_id": chat_obj_id, "user_id": current_user["_id"]})
    if not chat:
        raise HTTPException(status_code=404, detail="Chat not found")
        
    # 2. Save user message
    user_message = {
        "chat_id": chat_id,
        "role": message_in.role,
        "content": message_in.content,
        "created_at": datetime.utcnow()
    }
    await db.messages.insert_one(user_message)
    
    # 3. Retrieve recent conversation history
    msg_cursor = db.messages.find({"chat_id": chat_id}).sort("created_at", -1).limit(settings.MAX_HISTORY_MESSAGES)
    recent_msgs = await msg_cursor.to_list(length=settings.MAX_HISTORY_MESSAGES)
    recent_msgs.reverse()  # chronological order for the model
    
    # 4. Format history for LLM
    llm_messages = [{"role": msg["role"], "content": msg["content"]} for msg in recent_msgs]
    
    logger.info(
        "Generating response: chat=%s user=%s include_public=%s (streaming=%s)",
        chat_id, current_user["_id"], include_public, settings.ENABLE_STREAMING
    )

    # 5A. Handle Streaming Response
    if settings.ENABLE_STREAMING:
        from fastapi.responses import StreamingResponse
        import json
        from generation.answer_generator import generate_rag_stream
        
        async def event_generator():
            full_content = ""
            is_completed = False
            try:
                # Generate chunks live
                async for chunk_data in generate_rag_stream(
                    query=message_in.content,
                    conversation_history=llm_messages,
                    user_id=current_user["_id"],
                    include_public=include_public,
                ):
                    if chunk_data["type"] == "status":
                        status_payload = {"step": chunk_data["step"]}
                        if "meta" in chunk_data:
                            status_payload["meta"] = chunk_data["meta"]
                        yield f"event: status\ndata: {json.dumps(status_payload)}\n\n"
                    elif chunk_data["type"] == "token":
                        full_content += chunk_data["text"]
                        # Yield SSE formatted data
                        yield f"event: token\ndata: {json.dumps({'text': chunk_data['text']})}\n\n"
                    
                # Signal stream is complete (standard SSE pattern)
                is_completed = True
                yield "event: done\ndata: [DONE]\n\n"
            except Exception as e:
                logger.error("SSE Streaming error: %s", str(e), exc_info=True)
                yield f"event: error\ndata: {json.dumps({'error': str(e)})}\n\n"
            finally:
                # Guaranteed to execute even if client drops connection gracefully or ungracefully
                if full_content.strip():
                    assistant_message = {
                        "chat_id": chat_id,
                        "role": "assistant",
                        "content": full_content,
                        "status": "completed" if is_completed else "interrupted",
                        "created_at": datetime.utcnow()
                    }
                    await db.messages.insert_one(assistant_message)
                    await db.chats.update_one({"_id": chat_obj_id}, {"$set": {"updated_at": datetime.utcnow()}})
                    
        return StreamingResponse(
            event_generator(),
            media_type="text/event-stream",
            headers={
                "Cache-Control": "no-cache",
                "Connection": "keep-alive",
            },
        )

    # 5B. Handle Standard Sync JSON Response
    llm_reply_content = await generate_rag_response(
        query=message_in.content,
        conversation_history=llm_messages,
        user_id=current_user["_id"],
        include_public=include_public,
    )
    
    # 6. Save assistant message
    assistant_message = {
        "chat_id": chat_id,
        "role": "assistant",
        "content": llm_reply_content,
        "created_at": datetime.utcnow()
    }
    result = await db.messages.insert_one(assistant_message)
    
    # 7. Update chat timestamp
    await db.chats.update_one({"_id": chat_obj_id}, {"$set": {"updated_at": datetime.utcnow()}})
    
    # 8. Return assistant message
    saved_assistant_msg = await db.messages.find_one({"_id": result.inserted_id})
    saved_assistant_msg["_id"] = str(saved_assistant_msg["_id"])
    
    return saved_assistant_msg

@router.get("/{chat_id}/messages/list", response_model=List[MessageResponse])
async def get_messages(
    chat_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Get all messages for a specific chat."""
    db = get_database()
    
    try:
        chat_obj_id = ObjectId(chat_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid chat ID format")
    
    chat = await db.chats.find_one({"_id": chat_obj_id, "user_id": current_user["_id"]})
    if not chat:
        raise HTTPException(status_code=404, detail="Chat not found")
        
    msg_cursor = db.messages.find({"chat_id": chat_id}).sort("created_at", 1)
    messages = await msg_cursor.to_list(length=500)
    
    for msg in messages:
        msg["_id"] = str(msg["_id"])
        
    return messages
