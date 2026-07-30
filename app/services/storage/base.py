from abc import ABC, abstractmethod

DEFAULT_CONTENT_TYPE = "application/pdf"


def resolve_content_type(content_type: str | None) -> str:
    return content_type or DEFAULT_CONTENT_TYPE


class StorageProvider(ABC):
    """Generic object storage interface (local disk, GCS, OCI, …)."""

    @abstractmethod
    def upload(self, key: str, data: bytes, *, content_type: str | None = None) -> str:
        """Store bytes at key. Returns the key."""

    @abstractmethod
    def download(self, key: str) -> bytes:
        """Fetch bytes for key. Raises if missing."""

    @abstractmethod
    def delete(self, key: str) -> None:
        """Remove object at key (no-op or ignored if already absent)."""

    @abstractmethod
    def exists(self, key: str) -> bool:
        """Return True when key is present."""

    @abstractmethod
    def generate_signed_url(self, key: str, expires_in: int = 3600) -> str:
        """Return a time-limited URL for secure direct download."""

    @property
    def backend_name(self) -> str:
        return self.__class__.__name__


def is_object_key(path: str | None) -> bool:
    """True for relative object keys; False for legacy absolute local paths."""
    return bool(path) and not path.startswith("/")
