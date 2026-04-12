from uuid import UUID
from datetime import datetime
from pydantic import BaseModel, ConfigDict, Field


class XAPIStatementRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    stored_at: datetime
    actor: dict
    verb: dict
    object: dict = Field(alias="object_")
    result: dict | None = None
    context: dict | None = None
