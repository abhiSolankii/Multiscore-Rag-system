import asyncio
import sys
import os
from pathlib import Path

# Add the backend directory to sys.path so we can import settings
backend_path = Path(__file__).parent / "backend"
sys.path.append(str(backend_path))

try:
    from core.config import settings
    from qdrant_client import AsyncQdrantClient
except ImportError:
    print("Error: Could not find backend core modules or qdrant_client.")
    print("Make sure you are running this from the project root and dependencies are installed.")
    sys.exit(1)

async def clear_vector_db():
    print(f"--- Vector DB Cleanup Script ---")
    print(f"Target Qdrant URL: {settings.QDRANT_URL}")
    
    confirm = input("Are you sure you want to DELETE ALL collections? (y/N): ")
    if confirm.lower() != 'y':
        print("Aborted.")
        return

    kwargs = {
        "url": settings.QDRANT_URL,
        "timeout": 60.0,
    }
    if settings.QDRANT_API_KEY:
        kwargs["api_key"] = settings.QDRANT_API_KEY
        
    client = AsyncQdrantClient(**kwargs)

    try:
        collections_response = await client.get_collections()
        collections = collections_response.collections
        
        if not collections:
            print("No collections found in the Vector DB.")
            return

        print(f"Found {len(collections)} collections.")
        for col in collections:
            name = col.name
            print(f"Deleting collection: {name}...")
            await client.delete_collection(collection_name=name)
            
        print("\n--- Cleanup Complete ---")
        print("Vector DB has been fully cleared.")
        
    except Exception as e:
        print(f"\nCRITICAL ERROR: {e}")
    finally:
        await client.close()

if __name__ == "__main__":
    asyncio.run(clear_vector_db())
