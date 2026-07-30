"""Unit tests for storage abstraction — local, factory, and GCS backend."""
import pytest
from pathlib import Path
from unittest.mock import MagicMock, patch


@pytest.fixture
def local_storage(tmp_path):
    from app.services.storage.local import LocalStorage

    return LocalStorage(base_dir=tmp_path)


class TestLocalStorage:
    def test_upload_download_roundtrip(self, local_storage):
        data = b"%PDF-1.4 test"
        key = "resumes/user1/job1.pdf"

        returned = local_storage.upload(key, data)
        assert returned == key
        assert local_storage.download(key) == data

    def test_exists(self, local_storage):
        key = "uploads/test.pdf"
        assert local_storage.exists(key) is False
        local_storage.upload(key, b"data")
        assert local_storage.exists(key) is True

    def test_delete(self, local_storage):
        key = "uploads/remove-me.pdf"
        local_storage.upload(key, b"data")
        local_storage.delete(key)
        assert local_storage.exists(key) is False

    def test_rejects_path_traversal(self, local_storage):
        with pytest.raises(ValueError, match="Invalid storage key"):
            local_storage.upload("../escape.pdf", b"bad")

    def test_download_missing_raises(self, local_storage):
        with pytest.raises(FileNotFoundError):
            local_storage.download("missing/file.pdf")

    def test_generate_signed_url(self, local_storage):
        with patch("app.services.storage.local.get_settings") as mock_settings:
            mock_settings.return_value = MagicMock(
                API_BASE_URL="http://localhost:8000",
                FRONTEND_URL="http://localhost:3000",
                JWT_SECRET="test-secret-for-hmac-signing-32chars",
            )
            url = local_storage.generate_signed_url("resumes/u/1.pdf", expires_in=600)
            assert url.startswith("http://localhost:8000/storage/signed?")
            assert "key=resumes%2Fu%2F1.pdf" in url
            assert "expires=" in url
            assert "sig=" in url

    def test_generate_signed_url_requires_base_url(self, local_storage):
        with patch("app.services.storage.local.get_settings") as mock_settings:
            mock_settings.return_value = MagicMock(API_BASE_URL="", FRONTEND_URL="")
            with pytest.raises(ValueError, match="API_BASE_URL or FRONTEND_URL"):
                local_storage.generate_signed_url("resumes/u/1.pdf")


class TestStorageFactory:
    def test_get_storage_local(self):
        with patch("app.services.storage.factory.get_settings") as mock_settings:
            mock_settings.return_value = MagicMock(STORAGE_BACKEND="local")
            from app.services.storage.factory import get_storage

            get_storage.cache_clear()
            storage = get_storage()
            assert storage.backend_name == "LocalStorage"
            get_storage.cache_clear()

    def test_get_storage_gcs(self):
        with patch("app.services.storage.factory.get_settings") as mock_settings:
            mock_settings.return_value = MagicMock(STORAGE_BACKEND="gcs")
            with patch("app.services.storage.gcs.GCSStorage.__init__", return_value=None):
                from app.services.storage.factory import get_storage

                get_storage.cache_clear()
                storage = get_storage()
                assert storage.backend_name == "GCSStorage"
                get_storage.cache_clear()

    def test_unknown_backend_raises(self):
        with patch("app.services.storage.factory.get_settings") as mock_settings:
            mock_settings.return_value = MagicMock(STORAGE_BACKEND="s3")
            from app.services.storage.factory import get_storage

            get_storage.cache_clear()
            with pytest.raises(ValueError, match="Unknown STORAGE_BACKEND"):
                get_storage()
            get_storage.cache_clear()


class TestIsObjectKey:
    def test_relative_key(self):
        from app.services.storage.base import is_object_key

        assert is_object_key("resumes/u/1.pdf") is True

    def test_absolute_path(self):
        from app.services.storage.base import is_object_key

        assert is_object_key("/tmp/data/pdfs/1.pdf") is False

    def test_empty(self):
        from app.services.storage.base import is_object_key

        assert is_object_key(None) is False
        assert is_object_key("") is False
