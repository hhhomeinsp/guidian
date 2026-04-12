from functools import lru_cache
from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


def _to_async_url(url: str) -> str:
    if url.startswith("postgres://"):
        url = "postgresql://" + url[len("postgres://") :]
    if url.startswith("postgresql://"):
        return "postgresql+asyncpg://" + url[len("postgresql://") :]
    return url


def _to_sync_url(url: str) -> str:
    if url.startswith("postgres://"):
        url = "postgresql://" + url[len("postgres://") :]
    if url.startswith("postgresql://"):
        return "postgresql+psycopg://" + url[len("postgresql://") :]
    return url


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    ENVIRONMENT: str = "development"
    PROJECT_NAME: str = "Guidian"
    API_V1_PREFIX: str = "/api/v1"

    DATABASE_URL: str
    SYNC_DATABASE_URL: str

    @field_validator("DATABASE_URL", mode="after")
    @classmethod
    def _normalize_async(cls, v: str) -> str:
        return _to_async_url(v)

    @field_validator("SYNC_DATABASE_URL", mode="after")
    @classmethod
    def _normalize_sync(cls, v: str) -> str:
        return _to_sync_url(v)

    REDIS_URL: str = "redis://redis:6379/0"
    CELERY_BROKER_URL: str = "redis://redis:6379/1"
    CELERY_RESULT_BACKEND: str = "redis://redis:6379/2"

    JWT_SECRET_KEY: str = "change-me"
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 15
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7

    S3_ENDPOINT_URL: str | None = None
    S3_ACCESS_KEY: str | None = None
    S3_SECRET_KEY: str | None = None
    S3_BUCKET_COURSES: str = "guidian-courses"
    S3_BUCKET_AUDIO: str = "guidian-audio"
    S3_BUCKET_CERTIFICATES: str = "guidian-certificates"
    S3_REGION: str = "us-east-1"

    ANTHROPIC_API_KEY: str | None = None
    ANTHROPIC_MODEL: str = "claude-opus-4-6"
    OPENAI_API_KEY: str | None = None
    TTS_PROVIDER: str = "openai"
    TTS_VOICE: str = "alloy"


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
