import asyncio

from app.core.config import get_settings
from app.services.storage.base import ProviderNotConfigured, StorageProvider


class S3Provider(StorageProvider):
    """Works with AWS S3 and with any S3-compatible service (Cloudflare R2, MinIO, Backblaze B2...)."""

    name = "s3"
    label = "AWS S3 / Cloudflare R2"
    description = ("Object storage used by most production apps. Pay-as-you-go (S3) or zero egress fees (R2). "
                   "Supports presigned URLs so the browser uploads straight to the bucket.")
    env_vars = ["S3_BUCKET", "S3_REGION", "S3_ACCESS_KEY_ID", "S3_SECRET_ACCESS_KEY",
                "S3_ENDPOINT_URL (R2 only)", "S3_PUBLIC_BASE_URL (optional CDN)"]
    supports_presign = True

    def __init__(self) -> None:
        self._client = None

    def is_configured(self) -> bool:
        s = get_settings()
        return bool(s.S3_BUCKET and s.S3_ACCESS_KEY_ID and s.S3_SECRET_ACCESS_KEY)

    @property
    def client(self):
        if not self.is_configured():
            raise ProviderNotConfigured("S3 is not configured. Fill S3_* in backend/.env")
        if self._client is None:
            import boto3
            from botocore.config import Config

            s = get_settings()
            self._client = boto3.client(
                "s3",
                region_name=s.S3_REGION or None,
                aws_access_key_id=s.S3_ACCESS_KEY_ID,
                aws_secret_access_key=s.S3_SECRET_ACCESS_KEY,
                endpoint_url=s.S3_ENDPOINT_URL or None,
                config=Config(signature_version="s3v4", s3={"addressing_style": "path" if s.S3_ENDPOINT_URL else "auto"}),
            )
        return self._client

    @property
    def bucket(self) -> str:
        return get_settings().S3_BUCKET

    async def upload(self, key: str, data: bytes, content_type: str) -> None:
        await asyncio.to_thread(self.client.put_object, Bucket=self.bucket, Key=key, Body=data,
                                ContentType=content_type, CacheControl="public, max-age=31536000")

    async def delete(self, key: str) -> None:
        await asyncio.to_thread(self.client.delete_object, Bucket=self.bucket, Key=key)

    async def read(self, key: str) -> bytes:
        def _get() -> bytes:
            return self.client.get_object(Bucket=self.bucket, Key=key)["Body"].read()

        return await asyncio.to_thread(_get)

    def get_url(self, key: str) -> str:
        base = get_settings().S3_PUBLIC_BASE_URL.rstrip("/")
        if base:  # CloudFront / R2 public domain: short, cacheable URL
            return f"{base}/{key}"
        # Private bucket: signed URL, valid 7 days (max for SigV4). Computed locally, no network call.
        return self.client.generate_presigned_url("get_object", Params={"Bucket": self.bucket, "Key": key},
                                                  ExpiresIn=7 * 24 * 3600)

    def presign_put(self, key: str, content_type: str, expires: int = 900) -> str:
        return self.client.generate_presigned_url(
            "put_object", Params={"Bucket": self.bucket, "Key": key, "ContentType": content_type}, ExpiresIn=expires)

    async def usage(self) -> dict:
        def _sum() -> tuple[int, int]:
            total = count = 0
            pager = self.client.get_paginator("list_objects_v2")
            for i, page in enumerate(pager.paginate(Bucket=self.bucket)):
                for obj in page.get("Contents", []):
                    total += obj["Size"]
                    count += 1
                if i >= 20:  # cap: 20k objects
                    break
            return total, count

        total, count = await asyncio.to_thread(_sum)
        return {"used_bytes": total, "objects": count, "note": "Sum of objects in the bucket (first 20k)"}
