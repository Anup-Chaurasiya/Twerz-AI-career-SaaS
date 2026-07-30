"""Integration smoke tests for object storage — requires real backend credentials.

Run with: INTEGRATION=1 uv run pytest tests/integration/test_smoke_gcs.py -v
For GCS: STORAGE_BACKEND=gcs
For OCI: STORAGE_BACKEND=oci
"""
import os
import uuid
import pytest

pytestmark = pytest.mark.skipif(
    os.getenv("INTEGRATION") != "1",
    reason="Integration tests require INTEGRATION=1",
)


@pytest.fixture
def storage_client():
    from app.services.storage import get_storage

    return get_storage()


@pytest.fixture
def test_pdf_bytes():
    """Minimal valid-ish PDF bytes for testing."""
    return b"%PDF-1.4 test content " + uuid.uuid4().bytes


@pytest.fixture
def test_object_key():
    return f"test-uploads/{uuid.uuid4().hex}.pdf"


class TestStorageSmoke:
    def test_upload_and_download_roundtrip(self, storage_client, test_pdf_bytes, test_object_key):
        returned_path = storage_client.upload(test_object_key, test_pdf_bytes)
        assert returned_path == test_object_key

        downloaded = storage_client.download(test_object_key)
        assert downloaded == test_pdf_bytes

        storage_client.delete(test_object_key)

    def test_delete_removes_object(self, storage_client, test_pdf_bytes, test_object_key):
        storage_client.upload(test_object_key, test_pdf_bytes)
        storage_client.delete(test_object_key)

        with pytest.raises(Exception):
            storage_client.download(test_object_key)

    def test_download_nonexistent_raises(self, storage_client):
        with pytest.raises(Exception):
            storage_client.download(f"nonexistent/{uuid.uuid4().hex}.pdf")
