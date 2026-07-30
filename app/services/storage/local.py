from logging import getLogger
from pathlib import Path
import hashlib
import hmac
import time
import urllib.parse

from app.config import get_settings
from app.services.storage.base import StorageProvider

logger = getLogger(__name__)


class LocalStorage(StorageProvider):
    """Filesystem-backed storage for local dev and Docker Compose deployments."""

    def __init__(self, base_dir: Path | None = None):
        settings = get_settings()
        self.base_dir = (base_dir or Path(settings.LOCAL_STORAGE_PATH)).resolve()
        self.base_dir.mkdir(parents=True, exist_ok=True)

    def _path(self, key: str) -> Path:
        normalized = key.lstrip("/")
        path = (self.base_dir / normalized).resolve()
        if not str(path).startswith(str(self.base_dir)):
            raise ValueError(f"Invalid storage key: {key}")
        return path

    def upload(self, key: str, data: bytes, *, content_type: str | None = None) -> str:
        path = self._path(key)
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(data)
        logger.info("Uploaded %s bytes to local storage: %s", len(data), path)
        return key

    def download(self, key: str) -> bytes:
        path = self._path(key)
        if not path.is_file():
            raise FileNotFoundError(f"Object not found: {key}")
        return path.read_bytes()

    def delete(self, key: str) -> None:
        path = self._path(key)
        if path.is_file():
            path.unlink()
            logger.info("Deleted local object: %s", path)

    def exists(self, key: str) -> bool:
        return self._path(key).is_file()

    def generate_signed_url(self, key: str, expires_in: int = 3600) -> str:
        """HMAC-signed URL for dev; validate via a future /storage/signed endpoint."""
        settings = get_settings()
        base = (settings.API_BASE_URL or settings.FRONTEND_URL).rstrip("/")
        if not base:
            raise ValueError(
                "API_BASE_URL or FRONTEND_URL required for local signed URLs"
            )

        expires = int(time.time()) + expires_in
        message = f"{key}:{expires}"
        sig = hmac.new(
            settings.JWT_SECRET.encode(),
            message.encode(),
            hashlib.sha256,
        ).hexdigest()
        params = urllib.parse.urlencode({"key": key, "expires": expires, "sig": sig})
        url = f"{base}/storage/signed?{params}"
        logger.info("Generated local signed URL for %s (expires in %ss)", key, expires_in)
        return url
