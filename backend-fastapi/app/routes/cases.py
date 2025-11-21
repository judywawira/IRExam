from fastapi import APIRouter, HTTPException, Depends, UploadFile, File, Form
from beanie import PydanticObjectId
from typing import Optional, List
from datetime import datetime
import os
import uuid
import zipfile
import aiofiles
from app.config import get_settings
from app.models.user import User, UserRole
from app.models.case import Case, CaseImage, Annotation, DicomMetadata
from app.middleware.auth import get_current_user, require_examiner_or_admin
from app.utils.dicom import extract_dicom_metadata, is_dicom_file

router = APIRouter(prefix="/api/cases", tags=["Cases"])
settings = get_settings()

def case_to_response(case: Case) -> dict:
    return {
        "id": str(case.id),
        "_id": str(case.id),
        "title": case.title,
        "clinicalHistory": case.clinicalHistory,
        "findings": case.findings,
        "diagnosis": case.diagnosis,
        "discussionPoints": case.discussionPoints,
        "images": [{"id": img.id, "_id": img.id, "filename": img.filename, "originalName": img.originalName,
                    "path": img.path, "mimetype": img.mimetype, "size": img.size, "isDicom": img.isDicom,
                    "dicomMetadata": img.dicomMetadata.model_dump() if img.dicomMetadata else None} for img in case.images],
        "annotations": [{"id": ann.id, "_id": ann.id, "imageId": ann.imageId, "toolType": ann.toolType,
                        "data": ann.data, "createdBy": str(ann.createdBy), "isVisible": ann.isVisible} for ann in case.annotations],
        "createdBy": str(case.createdBy),
        "createdAt": case.createdAt.isoformat(),
        "updatedAt": case.updatedAt.isoformat()
    }

async def save_upload(file: UploadFile) -> dict:
    ext = os.path.splitext(file.filename)[1] if file.filename else ""
    filename = f"{datetime.now().strftime('%Y%m%d%H%M%S')}-{uuid.uuid4().hex[:8]}{ext}"
    filepath = os.path.join(settings.upload_dir, filename)

    os.makedirs(settings.upload_dir, exist_ok=True)
    content = await file.read()
    async with aiofiles.open(filepath, 'wb') as f:
        await f.write(content)

    is_dicom = is_dicom_file(filepath)
    dicom_meta = extract_dicom_metadata(filepath) if is_dicom else None

    return CaseImage(
        filename=filename,
        originalName=file.filename or filename,
        path=f"/uploads/{filename}",
        mimetype=file.content_type or "application/octet-stream",
        size=len(content),
        isDicom=is_dicom,
        dicomMetadata=DicomMetadata(**dicom_meta) if dicom_meta else None
    )

async def process_zip(filepath: str) -> List[CaseImage]:
    images = []
    extract_dir = f"{filepath}_extracted"
    os.makedirs(extract_dir, exist_ok=True)

    with zipfile.ZipFile(filepath, 'r') as zf:
        zf.extractall(extract_dir)

    for root, _, files in os.walk(extract_dir):
        for fname in files:
            fpath = os.path.join(root, fname)
            if is_dicom_file(fpath):
                new_filename = f"{datetime.now().strftime('%Y%m%d%H%M%S')}-{uuid.uuid4().hex[:8]}.dcm"
                new_path = os.path.join(settings.upload_dir, new_filename)
                os.rename(fpath, new_path)
                dicom_meta = extract_dicom_metadata(new_path)
                images.append(CaseImage(
                    filename=new_filename,
                    originalName=fname,
                    path=f"/uploads/{new_filename}",
                    mimetype="application/dicom",
                    size=os.path.getsize(new_path),
                    isDicom=True,
                    dicomMetadata=DicomMetadata(**dicom_meta) if dicom_meta else None
                ))

    import shutil
    shutil.rmtree(extract_dir, ignore_errors=True)
    os.remove(filepath)
    return images

@router.get("")
async def list_cases(user: User = Depends(get_current_user)):
    if user.role == UserRole.EXAMINER:
        cases = await Case.find(Case.createdBy == user.id).to_list()
    else:
        cases = await Case.find_all().to_list()
    return [case_to_response(c) for c in cases]

@router.get("/{case_id}")
async def get_case(case_id: str, user: User = Depends(get_current_user)):
    case = await Case.get(PydanticObjectId(case_id))
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")
    return case_to_response(case)

@router.post("")
async def create_case(
    title: str = Form(...),
    clinicalHistory: Optional[str] = Form(None),
    findings: Optional[str] = Form(None),
    diagnosis: Optional[str] = Form(None),
    discussionPoints: Optional[str] = Form(None),
    images: List[UploadFile] = File(default=[]),
    user: User = Depends(require_examiner_or_admin)
):
    case_images = []
    for file in images:
        if file.filename and file.filename.endswith('.zip'):
            temp_path = os.path.join(settings.upload_dir, f"temp_{uuid.uuid4().hex}.zip")
            os.makedirs(settings.upload_dir, exist_ok=True)
            content = await file.read()
            async with aiofiles.open(temp_path, 'wb') as f:
                await f.write(content)
            case_images.extend(await process_zip(temp_path))
        else:
            case_images.append(await save_upload(file))

    case = Case(
        title=title,
        clinicalHistory=clinicalHistory,
        findings=findings,
        diagnosis=diagnosis,
        discussionPoints=discussionPoints,
        images=case_images,
        createdBy=user.id
    )
    await case.insert()
    return case_to_response(case)

@router.put("/{case_id}")
async def update_case(
    case_id: str,
    title: Optional[str] = Form(None),
    clinicalHistory: Optional[str] = Form(None),
    findings: Optional[str] = Form(None),
    diagnosis: Optional[str] = Form(None),
    discussionPoints: Optional[str] = Form(None),
    images: List[UploadFile] = File(default=[]),
    user: User = Depends(require_examiner_or_admin)
):
    case = await Case.get(PydanticObjectId(case_id))
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")

    if title:
        case.title = title
    if clinicalHistory is not None:
        case.clinicalHistory = clinicalHistory
    if findings is not None:
        case.findings = findings
    if diagnosis is not None:
        case.diagnosis = diagnosis
    if discussionPoints is not None:
        case.discussionPoints = discussionPoints

    for file in images:
        if file.filename:
            case.images.append(await save_upload(file))

    case.updatedAt = datetime.utcnow()
    await case.save()
    return case_to_response(case)

@router.delete("/{case_id}")
async def delete_case(case_id: str, user: User = Depends(require_examiner_or_admin)):
    case = await Case.get(PydanticObjectId(case_id))
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")

    for img in case.images:
        filepath = os.path.join(settings.upload_dir, img.filename)
        if os.path.exists(filepath):
            os.remove(filepath)

    await case.delete()
    return {"message": "Case deleted"}

@router.delete("/{case_id}/images/{image_id}")
async def delete_image(case_id: str, image_id: str, user: User = Depends(require_examiner_or_admin)):
    case = await Case.get(PydanticObjectId(case_id))
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")

    img = next((i for i in case.images if i.id == image_id), None)
    if img:
        filepath = os.path.join(settings.upload_dir, img.filename)
        if os.path.exists(filepath):
            os.remove(filepath)
        case.images = [i for i in case.images if i.id != image_id]
        await case.save()

    return {"message": "Image deleted"}

@router.get("/{case_id}/annotations")
async def get_annotations(case_id: str, user: User = Depends(get_current_user)):
    case = await Case.get(PydanticObjectId(case_id))
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")
    return [{"id": a.id, "imageId": a.imageId, "toolType": a.toolType, "data": a.data,
             "createdBy": str(a.createdBy), "isVisible": a.isVisible} for a in case.annotations]

@router.post("/{case_id}/annotations")
async def create_annotation(case_id: str, body: dict, user: User = Depends(get_current_user)):
    case = await Case.get(PydanticObjectId(case_id))
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")

    annotation = Annotation(
        imageId=body.get("imageId"),
        toolType=body.get("toolType"),
        data=body.get("data", {}),
        createdBy=user.id,
        createdByName=f"{user.firstName} {user.lastName}"
    )
    case.annotations.append(annotation)
    await case.save()
    return {"id": annotation.id, "imageId": annotation.imageId, "toolType": annotation.toolType,
            "data": annotation.data, "createdBy": str(annotation.createdBy), "isVisible": annotation.isVisible}

@router.put("/{case_id}/annotations/{annotation_id}")
async def update_annotation(case_id: str, annotation_id: str, body: dict, user: User = Depends(get_current_user)):
    case = await Case.get(PydanticObjectId(case_id))
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")

    for ann in case.annotations:
        if ann.id == annotation_id:
            if "isVisible" in body:
                ann.isVisible = body["isVisible"]
            if "data" in body:
                ann.data = body["data"]
            await case.save()
            return {"id": ann.id, "isVisible": ann.isVisible}

    raise HTTPException(status_code=404, detail="Annotation not found")

@router.delete("/{case_id}/annotations/{annotation_id}")
async def delete_annotation(case_id: str, annotation_id: str, user: User = Depends(get_current_user)):
    case = await Case.get(PydanticObjectId(case_id))
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")

    case.annotations = [a for a in case.annotations if a.id != annotation_id]
    await case.save()
    return {"message": "Annotation deleted"}
