from fastapi import APIRouter, HTTPException, Depends, Query
from beanie import PydanticObjectId
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime
from app.models.user import User, UserRole
from app.models.exam import Exam
from app.models.session import ExamSession, SessionStatus
from app.middleware.auth import require_admin

router = APIRouter(prefix="/api/admin", tags=["Admin"])

def user_to_response(user: User) -> dict:
    return {
        "id": str(user.id), "_id": str(user.id),
        "email": user.email, "firstName": user.firstName, "lastName": user.lastName,
        "role": user.role.value, "isApproved": user.isApproved, "isArchived": user.isArchived,
        "createdAt": user.createdAt.isoformat()
    }

@router.get("/users")
async def list_users(
    role: Optional[str] = None,
    isApproved: Optional[bool] = None,
    isArchived: Optional[bool] = None,
    user: User = Depends(require_admin)
):
    query = {}
    if role:
        query["role"] = role
    if isApproved is not None:
        query["isApproved"] = isApproved
    if isArchived is not None:
        query["isArchived"] = isArchived

    users = await User.find(query).to_list() if query else await User.find_all().to_list()
    return [user_to_response(u) for u in users]

@router.get("/examiners")
async def list_examiners(user: User = Depends(require_admin)):
    examiners = await User.find(User.role == UserRole.EXAMINER).to_list()
    return [user_to_response(e) for e in examiners]

@router.patch("/users/{user_id}/approve")
async def approve_user(user_id: str, admin: User = Depends(require_admin)):
    user = await User.get(PydanticObjectId(user_id))
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    user.isApproved = True
    await user.save()
    return user_to_response(user)

@router.patch("/users/{user_id}/revoke")
async def revoke_user(user_id: str, admin: User = Depends(require_admin)):
    user = await User.get(PydanticObjectId(user_id))
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    user.isApproved = False
    await user.save()
    return user_to_response(user)

@router.patch("/users/{user_id}/archive")
async def archive_user(user_id: str, admin: User = Depends(require_admin)):
    user = await User.get(PydanticObjectId(user_id))
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    user.isArchived = True
    await user.save()
    return user_to_response(user)

@router.patch("/users/{user_id}/unarchive")
async def unarchive_user(user_id: str, admin: User = Depends(require_admin)):
    user = await User.get(PydanticObjectId(user_id))
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    user.isArchived = False
    await user.save()
    return user_to_response(user)

@router.delete("/users/{user_id}")
async def delete_user(user_id: str, admin: User = Depends(require_admin)):
    user = await User.get(PydanticObjectId(user_id))
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    await user.delete()
    return {"message": "User deleted"}

class AdminSessionCreate(BaseModel):
    name: str
    exam: str
    examiner: Optional[str] = None
    examiners: List[str] = []
    assignedStudents: List[str] = []
    scheduledFor: Optional[datetime] = None

class SessionUpdate(BaseModel):
    name: Optional[str] = None
    examiner: Optional[str] = None
    assignedStudents: Optional[List[str]] = None
    scheduledFor: Optional[datetime] = None

async def session_response(session: ExamSession) -> dict:
    return {
        "id": str(session.id), "_id": str(session.id),
        "name": session.name, "exam": str(session.exam),
        "examiner": str(session.examiner) if session.examiner else None,
        "examiners": [str(e) for e in session.examiners],
        "assignedStudents": [str(s) for s in session.assignedStudents],
        "status": session.status.value, "isArchived": session.isArchived,
        "scheduledFor": session.scheduledFor.isoformat() if session.scheduledFor else None,
        "createdAt": session.createdAt.isoformat()
    }

@router.post("/sessions")
async def admin_create_session(body: AdminSessionCreate, admin: User = Depends(require_admin)):
    exam = await Exam.get(PydanticObjectId(body.exam))
    if not exam:
        raise HTTPException(status_code=404, detail="Exam not found")

    session = ExamSession(
        name=body.name,
        exam=PydanticObjectId(body.exam),
        examiner=PydanticObjectId(body.examiner) if body.examiner else None,
        examiners=[PydanticObjectId(e) for e in body.examiners],
        assignedStudents=[PydanticObjectId(s) for s in body.assignedStudents],
        timeRemaining=exam.duration * 60,
        scheduledFor=body.scheduledFor,
        createdBy=admin.id
    )
    await session.insert()
    return await session_response(session)

@router.get("/sessions")
async def admin_list_sessions(includeArchived: bool = False, admin: User = Depends(require_admin)):
    if includeArchived:
        sessions = await ExamSession.find_all().to_list()
    else:
        sessions = await ExamSession.find(ExamSession.isArchived == False).to_list()
    return [await session_response(s) for s in sessions]

@router.patch("/sessions/{session_id}")
async def admin_update_session(session_id: str, body: SessionUpdate, admin: User = Depends(require_admin)):
    session = await ExamSession.get(PydanticObjectId(session_id))
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    if body.name:
        session.name = body.name
    if body.examiner:
        session.examiner = PydanticObjectId(body.examiner)
    if body.assignedStudents is not None:
        session.assignedStudents = [PydanticObjectId(s) for s in body.assignedStudents]
    if body.scheduledFor:
        session.scheduledFor = body.scheduledFor
    session.updatedAt = datetime.utcnow()
    await session.save()
    return await session_response(session)

@router.patch("/sessions/{session_id}/assign-examiner")
async def assign_examiner(session_id: str, body: dict, admin: User = Depends(require_admin)):
    session = await ExamSession.get(PydanticObjectId(session_id))
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    session.examiner = PydanticObjectId(body["examinerId"])
    await session.save()
    return await session_response(session)

@router.patch("/sessions/{session_id}/assign-students")
async def assign_students(session_id: str, body: dict, admin: User = Depends(require_admin)):
    session = await ExamSession.get(PydanticObjectId(session_id))
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    session.assignedStudents = [PydanticObjectId(s) for s in body.get("studentIds", [])]
    await session.save()
    return await session_response(session)

@router.delete("/sessions/{session_id}")
async def admin_delete_session(session_id: str, admin: User = Depends(require_admin)):
    session = await ExamSession.get(PydanticObjectId(session_id))
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    session.isArchived = True
    await session.save()
    return {"message": "Session archived"}

@router.patch("/sessions/{session_id}/archive")
async def archive_session(session_id: str, admin: User = Depends(require_admin)):
    session = await ExamSession.get(PydanticObjectId(session_id))
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    session.isArchived = True
    await session.save()
    return await session_response(session)

@router.patch("/sessions/{session_id}/unarchive")
async def unarchive_session(session_id: str, admin: User = Depends(require_admin)):
    session = await ExamSession.get(PydanticObjectId(session_id))
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    session.isArchived = False
    await session.save()
    return await session_response(session)

@router.post("/sessions/{session_id}/clone")
async def clone_session(session_id: str, admin: User = Depends(require_admin)):
    session = await ExamSession.get(PydanticObjectId(session_id))
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    new_session = ExamSession(
        name=f"{session.name} (Copy)",
        exam=session.exam,
        examiner=session.examiner,
        examiners=session.examiners.copy(),
        assignedStudents=session.assignedStudents.copy(),
        timeRemaining=session.timeRemaining,
        createdBy=admin.id
    )
    await new_session.insert()
    return await session_response(new_session)
