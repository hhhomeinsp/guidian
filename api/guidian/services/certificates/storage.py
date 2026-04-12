"""S3-compatible storage for certificate PDFs.

Works with AWS S3, Cloudflare R2, and local MinIO via the S3_ENDPOINT_URL
setting. Uses signature v4 explicitly for MinIO compatibility.
"""
from __future__ import annotations

import boto3
from botocore.client import Config
from botocore.exceptions import ClientError

from guidian.core.config import settings

CERTIFICATE_CONTENT_TYPE = "application/pdf"


def get_s3_client():
    return boto3.client(
        "s3",
        endpoint_url=settings.S3_ENDPOINT_URL,
        aws_access_key_id=settings.S3_ACCESS_KEY,
        aws_secret_access_key=settings.S3_SECRET_KEY,
        region_name=settings.S3_REGION,
        config=Config(signature_version="s3v4"),
    )


def ensure_bucket(bucket: str) -> None:
    client = get_s3_client()
    try:
        client.head_bucket(Bucket=bucket)
    except ClientError as e:
        code = (e.response.get("Error") or {}).get("Code")
        if code in ("404", "NoSuchBucket", "NotFound"):
            client.create_bucket(Bucket=bucket)
        else:
            raise


def upload_certificate_pdf(pdf_bytes: bytes, key: str) -> str:
    """Upload the PDF bytes and return an `s3://bucket/key` URI.

    The `pdf_url` column stores the URI, not a public URL — clients fetch a
    presigned URL on demand via `presigned_download_url()`.
    """
    bucket = settings.S3_BUCKET_CERTIFICATES
    ensure_bucket(bucket)
    client = get_s3_client()
    client.put_object(
        Bucket=bucket,
        Key=key,
        Body=pdf_bytes,
        ContentType=CERTIFICATE_CONTENT_TYPE,
        CacheControl="private, max-age=0, no-store",
    )
    return f"s3://{bucket}/{key}"


def presigned_download_url(key: str, expires_in: int = 900) -> str:
    client = get_s3_client()
    return client.generate_presigned_url(
        "get_object",
        Params={
            "Bucket": settings.S3_BUCKET_CERTIFICATES,
            "Key": key,
            "ResponseContentType": CERTIFICATE_CONTENT_TYPE,
            "ResponseContentDisposition": "inline",
        },
        ExpiresIn=expires_in,
    )
