from logging import getLogger
from pathlib import Path

from google.cloud import storage

from app.config import get_settings
from app.services.storage.base import StorageProvider, resolve_content_type

logger = getLogger(__name__)


class GCSStorage(StorageProvider):
    """Google Cloud Storage backend."""

    def __init__(self):
        settings = get_settings()
        self.bucket_name = settings.GCS_BUCKET
        self._credentials_path = settings.GCS_CREDENTIALS_PATH
        self._client: storage.Client | None = None

    @property
    def client(self) -> storage.Client:
        if self._client is None:
            creds_path = Path(self._credentials_path)
            if creds_path.exists():
                self._client = storage.Client.from_service_account_json(str(creds_path))
            else:
                settings = get_settings()
                if settings.ENVIRONMENT.upper() == "DEV":
                    raise FileNotFoundError(
                        f"GCS credentials not found at {creds_path} (optional in local dev)"
                    )
                self._client = storage.Client()
        return self._client

    def upload(self, key: str, data: bytes, *, content_type: str | None = None) -> str:
        bucket = self.client.bucket(self.bucket_name)
        blob = bucket.blob(key)
        blob.upload_from_string(data, content_type=resolve_content_type(content_type))
        logger.info("Uploaded to gs://%s/%s", self.bucket_name, key)
        return key

    def download(self, key: str) -> bytes:
        bucket = self.client.bucket(self.bucket_name)
        blob = bucket.blob(key)
        return blob.download_as_bytes()

    def delete(self, key: str) -> None:
        bucket = self.client.bucket(self.bucket_name)
        blob = bucket.blob(key)
        blob.delete()
        logger.info("Deleted gs://%s/%s", self.bucket_name, key)

    def exists(self, key: str) -> bool:
        bucket = self.client.bucket(self.bucket_name)
        return bucket.blob(key).exists()

    def generate_signed_url(self, key: str, expires_in: int = 3600) -> str:
        bucket = self.client.bucket(self.bucket_name)
        blob = bucket.blob(key)
        url = blob.generate_signed_url(
            version="v4",
            expiration=expires_in,
            method="GET",
        )
        logger.info(
            "Generated signed URL for gs://%s/%s (expires in %ss)",
            self.bucket_name,
            key,
            expires_in,
        )
        return url


# Backward compatibility for existing imports and tests
class GCSClient(GCSStorage):
    def upload_pdf(self, pdf_bytes: bytes, gcs_path: str) -> str:
        return self.upload(gcs_path, pdf_bytes)

    def download_pdf(self, gcs_path: str) -> bytes:
        return self.download(gcs_path)

    def delete_pdf(self, gcs_path: str) -> None:
        self.delete(gcs_path)
