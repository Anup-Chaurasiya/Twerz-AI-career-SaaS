from google.cloud import storage
from app.config import get_settings
from logging import getLogger
from pathlib import Path

logger = getLogger(__name__)


class GCSClient:
    def __init__(self):
        settings = get_settings()
        self.bucket_name = settings.GCS_BUCKET
        self._credentials_path = settings.GCS_CREDENTIALS_PATH
        self._client = None

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
                # Production: use Application Default Credentials (Cloud Run, GCE, etc.)
                self._client = storage.Client()
        return self._client

    def upload_pdf(self, pdf_bytes: bytes, gcs_path: str) -> str:
        """Upload PDF bytes to GCS. Returns the GCS path."""
        bucket = self.client.bucket(self.bucket_name)
        blob = bucket.blob(gcs_path)
        blob.upload_from_string(pdf_bytes, content_type="application/pdf")
        logger.info(f"Uploaded PDF to gs://{self.bucket_name}/{gcs_path}")
        return gcs_path

    def download_pdf(self, gcs_path: str) -> bytes:
        """Download PDF bytes from GCS."""
        bucket = self.client.bucket(self.bucket_name)
        blob = bucket.blob(gcs_path)
        return blob.download_as_bytes()

    def generate_signed_url(self, gcs_path: str, expiration_seconds: int = 3600) -> str:
        """Generate a signed URL for downloading a PDF from GCS.
        
        Args:
            gcs_path: Relative path in the bucket (e.g., "resumes/user_id/job_id.pdf")
            expiration_seconds: Time until URL expires (default: 1 hour)
        
        Returns:
            Signed URL string that allows temporary public access
        """
        bucket = self.client.bucket(self.bucket_name)
        blob = bucket.blob(gcs_path)
        
        # Generate signed URL valid for the specified duration
        url = blob.generate_signed_url(
            version="v4",
            expiration=expiration_seconds,
            method="GET",
        )
        logger.info(f"Generated signed URL for gs://{self.bucket_name}/{gcs_path} (expires in {expiration_seconds}s)")
        return url

    def delete_pdf(self, gcs_path: str) -> None:
        """Delete a PDF from GCS."""
        bucket = self.client.bucket(self.bucket_name)
        blob = bucket.blob(gcs_path)
        blob.delete()
        logger.info(f"Deleted gs://{self.bucket_name}/{gcs_path}")
