from uuid import UUID
from datetime import datetime
from pydantic import BaseModel, ConfigDict, EmailStr, field_validator

from guidian.models.models import UserRole


class UserRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    email: EmailStr
    full_name: str | None
    role: UserRole
    is_active: bool
    organization_id: UUID | None
    created_at: datetime
    profile: dict | None = None

    @field_validator("profile", mode="before")
    @classmethod
    def _extract_preferences(cls, v):
        if v is None or isinstance(v, dict):
            return v
        return getattr(v, "preferences", None)


class UserUpdate(BaseModel):
    full_name: str | None = None
    is_active: bool | None = None
    role: UserRole | None = None


class IdentityVerifyRequest(BaseModel):
    full_name: str
    license_number: str | None = None
    last_four_ssn: str | None = None
