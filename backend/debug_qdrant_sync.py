from qdrant_client import QdrantClient
client = QdrantClient(url="http://localhost:6333")
print(f"Sync Has search: {hasattr(client, 'search')}")
print(f"Sync Methods: {[m for m in dir(client) if not m.startswith('_')]}")
