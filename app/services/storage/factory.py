from functools import lru_cache

from app.config import get_settings
from app.services.storage.base import StorageProvider
from app.services.storage.gcs import GCSStorage
from app.services.storage.local import LocalStorage
from app.services.storage.oci import OCIStorage

_BACKENDS = {
    "local": LocalStorage,
    "gcs": GCSStorage,
    "oci": OCIStorage,
}


@lru_cache
def get_storage() -> StorageProvider:
    """Return the configured storage backend (singleton per process)."""
    backend = get_settings().STORAGE_BACKEND.lower().strip()
    try:
        return _BACKENDS[backend]()
    except KeyError as exc:
        raise ValueError(
            f"Unknown STORAGE_BACKEND={backend!r}. Expected one of: {', '.join(_BACKENDS)}"
        ) from exc
