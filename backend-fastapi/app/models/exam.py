from beanie import Document, PydanticObjectId
from pydantic import Field
from datetime import datetime
from typing import Optional, List

class Exam(Document):
    title: str
    description: Optional[str] = None
    cases: List[PydanticObjectId] = []
    duration: int = 60  # minutes
    createdBy: PydanticObjectId
    createdAt: datetime = Field(default_factory=datetime.utcnow)
    updatedAt: datetime = Field(default_factory=datetime.utcnow)

    class Settings:
        name = "exams"
