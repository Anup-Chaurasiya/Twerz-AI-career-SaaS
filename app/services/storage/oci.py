from datetime import datetime, timedelta, timezone
import os
import uuid
from logging import getLogger

import oci

from app.config import get_settings
from app.services.storage.base import StorageProvider, resolve_content_type

logger = getLogger(__name__)


def _resolve_key_file(config: dict, config_path: str) -> dict:
    """Resolve relative key_file paths against the OCI config directory."""
    key_file = config.get("key_file")
    if not key_file or os.path.isabs(key_file):
        return config
    config_dir = os.path.dirname(os.path.abspath(config_path))
    resolved = os.path.normpath(os.path.join(config_dir, key_file))
    config = dict(config)
    config["key_file"] = resolved
    return config


def _load_oci_config(config_path: str) -> dict:
    """Load OCI config, resolving relative key_file before SDK validation."""
    abs_path = os.path.abspath(config_path)
    config_dir = os.path.dirname(abs_path)
    with open(abs_path, encoding="utf-8") as fh:
        lines = fh.readlines()
    patched: list[str] = []
    for line in lines:
        stripped = line.strip()
        if stripped.startswith("key_file="):
            _, raw = stripped.split("=", 1)
            key = raw.strip()
            if key and not os.path.isabs(key):
                key = os.path.normpath(os.path.join(config_dir, key))
            patched.append(f"key_file={key}\n")
        else:
            patched.append(line)
    import tempfile

    fd, tmp_path = tempfile.mkstemp(suffix=".oci.conf")
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as tmp:
            tmp.writelines(patched)
        return oci.config.from_file(tmp_path)
    finally:
        try:
            os.unlink(tmp_path)
        except OSError:
            pass


class OCIStorage(StorageProvider):
    """Oracle Cloud Infrastructure Object Storage (Instance Principals in production)."""

    def __init__(self):
        settings = get_settings()
        self.bucket_name = settings.OCI_BUCKET
        self._namespace = settings.OCI_NAMESPACE or None
        self._config_path = settings.OCI_CONFIG_PATH.strip()

        if self._config_path:
            config = _load_oci_config(self._config_path)
            logger.info(
                "OCI auth: API key from %s (key_file=%s)",
                self._config_path,
                config.get("key_file"),
            )
            self._client = oci.object_storage.ObjectStorageClient(config)
        else:
            logger.info("OCI auth: Instance Principals")
            signer = oci.auth.signers.InstancePrincipalsSecurityTokenSigner()
            self._client = oci.object_storage.ObjectStorageClient(config={}, signer=signer)

    @property
    def namespace(self) -> str:
        if not self._namespace:
            self._namespace = self._client.get_namespace().data
        return self._namespace

    def upload(self, key: str, data: bytes, *, content_type: str | None = None) -> str:
        self._client.put_object(
            namespace_name=self.namespace,
            bucket_name=self.bucket_name,
            object_name=key,
            put_object_body=data,
            content_type=resolve_content_type(content_type),
        )
        logger.info("Uploaded to oci://%s/%s/%s", self.namespace, self.bucket_name, key)
        return key

    def download(self, key: str) -> bytes:
        response = self._client.get_object(
            namespace_name=self.namespace,
            bucket_name=self.bucket_name,
            object_name=key,
        )
        return response.data.content

    def delete(self, key: str) -> None:
        self._client.delete_object(
            namespace_name=self.namespace,
            bucket_name=self.bucket_name,
            object_name=key,
        )
        logger.info("Deleted oci://%s/%s/%s", self.namespace, self.bucket_name, key)

    def exists(self, key: str) -> bool:
        try:
            self._client.head_object(
                namespace_name=self.namespace,
                bucket_name=self.bucket_name,
                object_name=key,
            )
            return True
        except oci.exceptions.ServiceError as exc:
            if exc.status == 404:
                return False
            raise

    def generate_signed_url(self, key: str, expires_in: int = 3600) -> str:
        """Create an OCI Pre-Authenticated Request for temporary object read access."""
        par_details = oci.object_storage.models.CreatePreauthenticatedRequestDetails(
            name=f"dl-{uuid.uuid4().hex[:12]}",
            access_type=oci.object_storage.models.CreatePreauthenticatedRequestDetails.ACCESS_TYPE_OBJECT_READ,
            object_name=key,
            time_expires=datetime.now(timezone.utc) + timedelta(seconds=expires_in),
        )
        response = self._client.create_preauthenticated_request(
            namespace_name=self.namespace,
            bucket_name=self.bucket_name,
            create_preauthenticated_request_details=par_details,
        )
        access_uri = response.data.access_uri
        endpoint = self._client.base_client.endpoint.rstrip("/")
        url = f"{endpoint}{access_uri}"
        logger.info(
            "Generated OCI PAR for oci://%s/%s/%s (expires in %ss)",
            self.namespace,
            self.bucket_name,
            key,
            expires_in,
        )
        return url
