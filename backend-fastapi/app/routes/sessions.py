from fastapi import APIRouter, HTTPException, Depends
from beanie import PydanticObjectId
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime
from app.models.user import User, UserRole
from app.models.exam import Exam
from app.models.case import Case
from app.models.session import ExamSession, SessionStatus, Participant
from app.middleware.auth import get_current_user, require_admin, require_student

router = APIRouter(prefix="/api/sessions", tags=["Sessions"])

class SessionCreate(BaseModel):
    name: str
    exam: str
    examiner: Optional[str] = None
    assignedStudents: List[str] = []
    scheduledFor: Optional[datetime] = None

async def session_to_response(session: ExamSession, full: bool = False) -> dict:
    resp = {
        "id": str(session.id),
        "_id": str(session.id),
        "name": session.name,
        "exam": str(session.exam),
        "examiner": str(session.examiner) if session.examiner else None,
        "examiners": [str(e) for e in session.examiners],
        "assignedStudents": [str(s) for s in session.assignedStudents],
        "status": session.status.value,
        "currentImageIndex": session.currentImageIndex,
        "timeRemaining": session.timeRemaining,
        "scheduledFor": session.scheduledFor.isoformat() if session.scheduledFor else None,
        "isArchived": session.isArchived,
        "createdAt": session.createdAt.isoformat()
    }

    if full:
        exam = await Exam.get(session.exam)
        if exam:
            cases = []
            for case_id in exam.cases:
                case = await Case.get(case_id)
                if case:
                    cases.append({
                        "id": str(case.id), "_id": str(case.id), "title": case.title,
                        "clinicalHistory": case.clinicalHistory, "findings": case.findings,
                        "diagnosis": case.diagnosis, "discussionPoints": case.discussionPoints,
                        "images": [{"id": img.id, "_id": img.id, "filename": img.filename,
                                   "path": img.path, "isDicom": img.isDicom,
                                   "dicomMetadata": img.dicomMetadata.model_dump() if img.dicomMetadata else None}
                                  for img in case.images],
                        "annotations": [{"id": a.id, "imageId": a.imageId, "toolType": a.toolType,
                                        "data": a.data, "isVisible": a.isVisible} for a in case.annotations]
                    })
            resp["exam"] = {
                "id": str(exam.id), "_id": str(exam.id), "title": exam.title,
                "duration": exam.duration, "cases": cases
            }

        # Populate examiner info
        if session.examiner:
            examiner = await User.get(session.examiner)
            if examiner:
                resp["examiner"] = {"id": str(examiner.id), "_id": str(examiner.id),
                                   "firstName": examiner.firstName, "lastName": examiner.lastName}

    return resp

@router.get("")
async def list_sessions(user: User = Depends(get_current_user)):
    if user.role == UserRole.ADMIN:
        sessions = await ExamSession.find(ExamSession.isArchived == False).to_list()
    elif user.role == UserRole.EXAMINER:
        sessions = await ExamSession.find(
            {"$and": [{"isArchived": False}, {"$or": [{"examiner": user.id}, {"examiners": user.id}]}]}
        ).to_list()
    else:
        sessions = await ExamSession.find(
            {"$and": [{"isArchived": False}, {"assignedStudents": user.id}]}
        ).to_list()
    return [await session_to_response(s) for s in sessions]

@router.get("/{session_id}")
async def get_session(session_id: str, user: User = Depends(get_current_user)):
    session = await ExamSession.get(PydanticObjectId(session_id))
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    return await session_to_response(session, full=True)

@router.post("")
async def create_session(body: SessionCreate, user: User = Depends(require_admin)):
    exam = await Exam.get(PydanticObjectId(body.exam))
    if not exam:
        raise HTTPException(status_code=404, detail="Exam not found")

    session = ExamSession(
        name=body.name,
        exam=PydanticObjectId(body.exam),
        examiner=PydanticObjectId(body.examiner) if body.examiner else None,
        assignedStudents=[PydanticObjectId(s) for s in body.assignedStudents],
        timeRemaining=exam.duration * 60,
        scheduledFor=body.scheduledFor,
        createdBy=user.id
    )
    await session.insert()
    return await session_to_response(session)

@router.post("/{session_id}/join")
async def join_session(session_id: str, user: User = Depends(require_student)):
    session = await ExamSession.get(PydanticObjectId(session_id))
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    if user.id not in session.assignedStudents:
        raise HTTPException(status_code=403, detail="Not assigned to this session")

    if not any(p.student == user.id for p in session.participants):
        session.participants.append(Participant(student=user.id))
        await session.save()

    return await session_to_response(session, full=True)

@router.delete("/{session_id}")
async def delete_session(session_id: str, user: User = Depends(get_current_user)):
    if user.role not in [UserRole.ADMIN, UserRole.EXAMINER]:
        raise HTTPException(status_code=403, detail="Insufficient permissions")

    session = await ExamSession.get(PydanticObjectId(session_id))
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    session.isArchived = True
    await session.save()
    return {"message": "Session archived"}
