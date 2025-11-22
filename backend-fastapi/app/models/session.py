from beanie import Document, PydanticObjectId
from pydantic import BaseModel, Field
from datetime import datetime
from enum import Enum
from typing import Optional, List

class SessionStatus(str, Enum):
    PENDING = "pending"
    IN_PROGRESS = "in_progress"
    PAUSED = "paused"
    COMPLETED = "completed"

class Participant(BaseModel):
    student: PydanticObjectId
    joinedAt: datetime = Field(default_factory=datetime.utcnow)
    currentImageIndex: int = 0

class ExaminerStudentPair(BaseModel):
    examiner: PydanticObjectId
    student: PydanticObjectId

class ExamSession(Document):
    name: str
    exam: PydanticObjectId
    examiner: Optional[PydanticObjectId] = None
    examiners: List[PydanticObjectId] = []
    assignedStudents: List[PydanticObjectId] = []
    status: SessionStatus = SessionStatus.PENDING
    currentImageIndex: int = 0
    timeRemaining: Optional[int] = None
    participants: List[Participant] = []
    examinerStudentPairs: List[ExaminerStudentPair] = []
    scheduledFor: Optional[datetime] = None
    startedAt: Optional[datetime] = None
    completedAt: Optional[datetime] = None
    isArchived: bool = False
    createdBy: PydanticObjectId
    createdAt: datetime = Field(default_factory=datetime.utcnow)
    updatedAt: datetime = Field(default_factory=datetime.utcnow)

    class Settings:
        name = "examsessions"
