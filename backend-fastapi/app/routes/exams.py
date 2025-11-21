from fastapi import APIRouter, HTTPException, Depends
from beanie import PydanticObjectId
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime
from app.models.user import User
from app.models.exam import Exam
from app.models.case import Case
from app.middleware.auth import get_current_user, require_admin

router = APIRouter(prefix="/api/exams", tags=["Exams"])

class ExamCreate(BaseModel):
    title: str
    description: Optional[str] = None
    cases: List[str] = []
    duration: int = 60

class ExamUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    cases: Optional[List[str]] = None
    duration: Optional[int] = None

async def exam_to_response(exam: Exam, populate_cases: bool = False) -> dict:
    resp = {
        "id": str(exam.id),
        "_id": str(exam.id),
        "title": exam.title,
        "description": exam.description,
        "duration": exam.duration,
        "createdBy": str(exam.createdBy),
        "createdAt": exam.createdAt.isoformat()
    }
    if populate_cases:
        cases = []
        for case_id in exam.cases:
            case = await Case.get(case_id)
            if case:
                cases.append({
                    "id": str(case.id), "_id": str(case.id), "title": case.title,
                    "clinicalHistory": case.clinicalHistory,
                    "images": [{"id": img.id, "_id": img.id, "filename": img.filename,
                               "path": img.path, "isDicom": img.isDicom} for img in case.images]
                })
        resp["cases"] = cases
    else:
        resp["cases"] = [str(c) for c in exam.cases]
    return resp

@router.get("")
async def list_exams(user: User = Depends(get_current_user)):
    exams = await Exam.find_all().to_list()
    return [await exam_to_response(e) for e in exams]

@router.get("/{exam_id}")
async def get_exam(exam_id: str, user: User = Depends(get_current_user)):
    exam = await Exam.get(PydanticObjectId(exam_id))
    if not exam:
        raise HTTPException(status_code=404, detail="Exam not found")
    return await exam_to_response(exam, populate_cases=True)

@router.post("")
async def create_exam(body: ExamCreate, user: User = Depends(require_admin)):
    exam = Exam(
        title=body.title,
        description=body.description,
        cases=[PydanticObjectId(c) for c in body.cases],
        duration=body.duration,
        createdBy=user.id
    )
    await exam.insert()
    return await exam_to_response(exam)

@router.put("/{exam_id}")
async def update_exam(exam_id: str, body: ExamUpdate, user: User = Depends(require_admin)):
    exam = await Exam.get(PydanticObjectId(exam_id))
    if not exam:
        raise HTTPException(status_code=404, detail="Exam not found")

    if body.title:
        exam.title = body.title
    if body.description is not None:
        exam.description = body.description
    if body.cases is not None:
        exam.cases = [PydanticObjectId(c) for c in body.cases]
    if body.duration is not None:
        exam.duration = body.duration
    exam.updatedAt = datetime.utcnow()
    await exam.save()
    return await exam_to_response(exam)

@router.post("/{exam_id}/clone")
async def clone_exam(exam_id: str, user: User = Depends(require_admin)):
    exam = await Exam.get(PydanticObjectId(exam_id))
    if not exam:
        raise HTTPException(status_code=404, detail="Exam not found")

    new_exam = Exam(
        title=f"{exam.title} (Copy)",
        description=exam.description,
        cases=exam.cases.copy(),
        duration=exam.duration,
        createdBy=user.id
    )
    await new_exam.insert()
    return await exam_to_response(new_exam)

@router.delete("/{exam_id}")
async def delete_exam(exam_id: str, user: User = Depends(require_admin)):
    exam = await Exam.get(PydanticObjectId(exam_id))
    if not exam:
        raise HTTPException(status_code=404, detail="Exam not found")
    await exam.delete()
    return {"message": "Exam deleted"}
