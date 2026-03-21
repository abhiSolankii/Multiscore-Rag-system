from motor.motor_asyncio import AsyncIOMotorClient
from core.config import settings
from core.logging import get_logger
import certifi

logger = get_logger(__name__)

class MongoDB:
    client: AsyncIOMotorClient = None
    db = None

db = MongoDB()

async def connect_to_mongo():
    db.client = AsyncIOMotorClient(
        settings.MONGODB_URL,
        tlsCAFile=certifi.where()
    )
    db.db = db.client[settings.DATABASE_NAME]
    logger.info("Connected to MongoDB database: %s", settings.DATABASE_NAME)

async def close_mongo_connection():
    if db.client:
        db.client.close()
        logger.info("Closed MongoDB connection")

def get_database():
    return db.db

