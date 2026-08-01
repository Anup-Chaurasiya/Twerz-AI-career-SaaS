from collections.abc import AsyncGenerator

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.config import get_settings

_settings = get_settings()


def _asyncpg_connect_args(database_url: str) -> dict:
    """Supabase (and other managed Postgres) require TLS for asyncpg."""
    lower = database_url.lower()
    if "supabase.co" in lower or "ssl=require" in lower or "ssl=true" in lower:
        return {"ssl": True}
    return {}


_connect_args = _asyncpg_connect_args(_settings.DATABASE_URL)

engine = create_async_engine(
    _settings.DATABASE_URL,
    pool_pre_ping=True,
    pool_size=5,
    max_overflow=5,
    connect_args=_connect_args,
)

async_session_factory = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
)


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    async with async_session_factory() as session:
        yield session
