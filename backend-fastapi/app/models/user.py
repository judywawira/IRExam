from beanie import Document, PydanticObjectId
from pydantic import EmailStr, Field
from datetime import datetime
from enum import Enum
from typing import Optional

class UserRole(str, Enum):
    ADMIN = "admin"
    EXAMINER = "examiner"
    STUDENT = "student"

class User(Document):
    email: EmailStr
    password: str
    firstName: str
    lastName: str
    role: UserRole = UserRole.STUDENT
    isApproved: bool = False
    isArchived: bool = False
    createdAt: datetime = Field(default_factory=datetime.utcnow)

    class Settings:
        name = "users"

    class Config:
        json_schema_extra = {
            "example": {
                "email": "user@example.com",
                "firstName": "John",
                "lastName": "Doe",
                "role": "student"
            }
        }
