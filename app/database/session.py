import ssl
from collections.abc import AsyncGenerator

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.config import get_settings

_settings = get_settings()


def _asyncpg_connect_args(database_url: str) -> dict:
    """Supabase (and other managed Postgres) require TLS for asyncpg."""
    lower = database_url.lower()
    if "supabase.co" not in lower and "ssl=require" not in lower and "ssl=true" not in lower:
        return {}
    ctx = ssl.create_default_context()
    # Supavisor pooler: Docker slim CA store may reject the chain; keep TLS, skip verify.
    if "pooler.supabase.com" in lower:
        ctx.check_hostname = False
        ctx.verify_mode = ssl.CERT_NONE
    return {"ssl": ctx}


_connect_args = _asyncpg_connect_args(_settings.DATABASE_URL)

engine = create_async_engine(
    _settings.DATABASE_URL,
    pool_pre_ping=True,
    pool_size=_settings.DB_POOL_SIZE,
    max_overflow=_settings.DB_MAX_OVERFLOW,
    pool_recycle=_settings.DB_POOL_RECYCLE,
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
