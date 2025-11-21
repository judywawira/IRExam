from beanie import Document, PydanticObjectId
from pydantic import BaseModel, Field
from datetime import datetime
from typing import Optional, List, Dict, Any

class DicomMetadata(BaseModel):
    seriesInstanceUID: Optional[str] = None
    instanceNumber: Optional[int] = None
    modality: Optional[str] = None
    patientId: Optional[str] = None
    studyDate: Optional[str] = None
    seriesDescription: Optional[str] = None

class CaseImage(BaseModel):
    id: str = Field(default_factory=lambda: str(PydanticObjectId()))
    filename: str
    originalName: str
    path: str
    mimetype: str
    size: int
    isDicom: bool = False
    dicomMetadata: Optional[DicomMetadata] = None
    uploadedAt: datetime = Field(default_factory=datetime.utcnow)

class Annotation(BaseModel):
    id: str = Field(default_factory=lambda: str(PydanticObjectId()))
    imageId: str
    toolType: str
    data: Dict[str, Any]
    createdBy: PydanticObjectId
    createdByName: Optional[str] = None
    isVisible: bool = True
    createdAt: datetime = Field(default_factory=datetime.utcnow)

class UsageHistory(BaseModel):
    sessionId: PydanticObjectId
    usedAt: datetime = Field(default_factory=datetime.utcnow)

class Case(Document):
    title: str
    clinicalHistory: Optional[str] = None
    findings: Optional[str] = None
    diagnosis: Optional[str] = None
    discussionPoints: Optional[str] = None
    images: List[CaseImage] = []
    annotations: List[Annotation] = []
    usageHistory: List[UsageHistory] = []
    createdBy: PydanticObjectId
    createdAt: datetime = Field(default_factory=datetime.utcnow)
    updatedAt: datetime = Field(default_factory=datetime.utcnow)

    class Settings:
        name = "cases"
