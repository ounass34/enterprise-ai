from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from sqlalchemy import text
from .config import get_settings

settings = get_settings()
engine = create_async_engine(settings.database_url, pool_pre_ping=True, pool_size=10, max_overflow=10)
SessionLocal = async_sessionmaker(engine, expire_on_commit=False, class_=AsyncSession)

async def db_execute(sql: str, params: dict | None = None):
    async with SessionLocal() as session:
        result = await session.execute(text(sql), params or {})
        await session.commit()
        return result

async def db_fetchall(sql: str, params: dict | None = None):
    async with SessionLocal() as session:
        result = await session.execute(text(sql), params or {})
        return result.mappings().all()

async def db_fetchone(sql: str, params: dict | None = None):
    async with SessionLocal() as session:
        result = await session.execute(text(sql), params or {})
        return result.mappings().first()
