from fastapi import APIRouter, Depends, HTTPException, status
from typing import List
from datetime import datetime
from bson import ObjectId

from schemas import (
    ChatCreate, 
    ChatUpdate,
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
    
    new_chat = chat_in.model_dump()
    new_chat["user_id"] = current_user["_id"]
    new_chat["created_at"] = datetime.utcnow()
    new_chat["updated_at"] = datetime.utcnow()
    
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

@router.patch("/{chat_id}", response_model=ChatResponse)
async def update_chat(
    chat_id: str,
    chat_in: ChatUpdate,
    current_user: dict = Depends(get_current_user)
):
    """Update a chat's title or config (e.g. toggle documents or change mode)."""
    db = get_database()
    
    try:
        chat_obj_id = ObjectId(chat_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid chat ID format")
        
    chat = await db.chats.find_one({"_id": chat_obj_id, "user_id": current_user["_id"]})
    if not chat:
        raise HTTPException(status_code=404, detail="Chat not found")
        
    update_data = chat_in.model_dump(exclude_unset=True)
    update_data["updated_at"] = datetime.utcnow()
    
    await db.chats.update_one({"_id": chat_obj_id}, {"$set": update_data})
    
    updated_chat = await db.chats.find_one({"_id": chat_obj_id})
    updated_chat["_id"] = str(updated_chat["_id"])
    return updated_chat

@router.post("/{chat_id}/messages/send")
async def send_message(
    chat_id: str,
    message_in: MessageCreate,
    current_user: dict = Depends(get_current_user),
):
    """
    Send a message and get an AI response.
    System merges instructions dynamically based on ChatConfig (mode).
    """
    db = get_database()
    
    try:
        chat_obj_id = ObjectId(chat_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid chat ID format")
    
    # 1. Verify chat ownership & load config
    chat = await db.chats.find_one({"_id": chat_obj_id, "user_id": current_user["_id"]})
    if not chat:
        raise HTTPException(status_code=404, detail="Chat not found")
        
    chat_config = chat.get("config", {})
    include_public = chat_config.get("include_public", False)
    mode = chat_config.get("mode", "hybrid")
    inactive_docs = chat_config.get("inactive_docs", [])
    
    user_config = current_user.get("config", {})
    max_token_limit = user_config.get("max_token_limit")
    
    tokens_remaining = current_user.get("tokens_remaining", 100000)
    if tokens_remaining <= 0:
        raise HTTPException(
            status_code=status.HTTP_402_PAYMENT_REQUIRED,
            detail="Token quota exhausted. Please upgrade or refill your account."
        )
        
    actual_max_tokens = min(max_token_limit, tokens_remaining) if max_token_limit else tokens_remaining
        
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
        "Generating response: chat=%s user=%s include_public=%s mode=%s (streaming=%s)",
        chat_id, current_user["_id"], include_public, mode, settings.ENABLE_STREAMING
    )

    # 5A. Handle Streaming Response
    if settings.ENABLE_STREAMING:
        from fastapi.responses import StreamingResponse
        import json
        from generation.answer_generator import generate_rag_stream
        
        async def event_generator():
            full_content = ""
            is_completed = False
            used_chunks = []
            tokens_used = None
            try:
                # Generate chunks live
                async for chunk_data in generate_rag_stream(
                    query=message_in.content,
                    conversation_history=llm_messages,
                    user_id=current_user["_id"],
                    include_public=include_public,
                    mode=mode,
                    inactive_docs=inactive_docs,
                    max_token_limit=actual_max_tokens,
                ):
                    if chunk_data["type"] == "status":
                        status_payload = {"step": chunk_data["step"]}
                        if "meta" in chunk_data:
                            status_payload["meta"] = chunk_data["meta"]
                            if chunk_data["step"] == "retrieved" and "chunks" in chunk_data["meta"]:
                                used_chunks = chunk_data["meta"]["chunks"]
                        yield f"event: status\ndata: {json.dumps(status_payload)}\n\n"
                    elif chunk_data["type"] == "token":
                        full_content += chunk_data["text"]
                        # Yield SSE formatted data
                        yield f"event: token\ndata: {json.dumps({'text': chunk_data['text']})}\n\n"
                    elif chunk_data["type"] == "usage":
                        tokens_used = chunk_data["data"]
                        yield f"event: usage\ndata: {json.dumps(tokens_used)}\n\n"
                    
                # Signal stream is complete (standard SSE pattern)
                is_completed = True
                yield "event: done\ndata: [DONE]\n\n"
            except Exception as e:
                logger.error("SSE Streaming error: %s", str(e), exc_info=True)
                yield f"event: error\ndata: {json.dumps({'error': str(e)})}\n\n"
            finally:
                # Guaranteed to execute even if client drops connection gracefully or ungracefully
                if full_content.strip():
                    if not tokens_used:
                        import tiktoken
                        try:
                            enc = tiktoken.get_encoding("cl100k_base")
                            prompt_tokens = sum(len(enc.encode(m["content"])) for m in llm_messages)
                            output_tokens = len(enc.encode(full_content))
                            tokens_used = {"total_tokens": prompt_tokens + output_tokens}
                        except Exception as e:
                            logger.error("Failed to estimate tokens for interrupted stream: %s", str(e))
                            tokens_used = {"total_tokens": 0}

                    assistant_message = {
                        "chat_id": chat_id,
                        "role": "assistant",
                        "content": full_content,
                        "status": "completed" if is_completed else "interrupted",
                        "used_chunks": used_chunks,
                        "tokens_used": tokens_used,
                        "created_at": datetime.utcnow()
                    }
                    await db.messages.insert_one(assistant_message)
                    await db.chats.update_one({"_id": chat_obj_id}, {"$set": {"updated_at": datetime.utcnow()}})
                    
                    if tokens_used:
                        tokens_delta = tokens_used.get("total_tokens", 0)
                        await db.users.update_one(
                            {"_id": current_user["_id"]},
                            {"$inc": {
                                "total_tokens_used": tokens_delta,
                                "tokens_remaining": -tokens_delta
                            }}
                        )
                    
        return StreamingResponse(
            event_generator(),
            media_type="text/event-stream",
            headers={
                "Cache-Control": "no-cache",
                "Connection": "keep-alive",
            },
        )

    # 5B. Handle Standard Sync JSON Response
    llm_reply_content, used_chunks, tokens_used = await generate_rag_response(
        query=message_in.content,
        conversation_history=llm_messages,
        user_id=current_user["_id"],
        include_public=include_public,
        mode=mode,
        inactive_docs=inactive_docs,
        max_token_limit=actual_max_tokens,
    )
    
    # 6. Save assistant message
    assistant_message = {
        "chat_id": chat_id,
        "role": "assistant",
        "content": llm_reply_content,
        "used_chunks": used_chunks,
        "tokens_used": tokens_used,
        "created_at": datetime.utcnow()
    }
    result = await db.messages.insert_one(assistant_message)
    
    if tokens_used:
        tokens_delta = tokens_used.get("total_tokens", 0)
        await db.users.update_one(
            {"_id": current_user["_id"]},
            {"$inc": {
                "total_tokens_used": tokens_delta,
                "tokens_remaining": -tokens_delta
            }}
        )
    
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
