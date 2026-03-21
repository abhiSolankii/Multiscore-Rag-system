from qdrant_client import AsyncQdrantClient
from core.config import settings
import asyncio
import re

async def migrate():
    client = AsyncQdrantClient(url=settings.QDRANT_URL, api_key=settings.QDRANT_API_KEY)
    
    # Target our specific current collection
    user_id = "dfef0480-d006-4e7f-9e11-26ba48de4dbe"
    model_slug = re.sub(r'[^a-zA-Z0-9]', '_', settings.EMBEDDING_MODEL).lower()
    collection_name = f"user_{user_id}_{model_slug}"
    
    print(f"Adding index to: {collection_name}")
    try:
        await client.create_payload_index(
            collection_name=collection_name,
            field_name="user_id",
            field_schema="keyword",
        )
        print("Index added successfully!")
    except Exception as e:
        print(f"Error adding index: {e}")

if __name__ == "__main__":
    asyncio.run(migrate())
