import base64
import binascii

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, ConfigDict, Field

from app.routes.campus_bridge import require_service
from app.services.exam_schedule import parse_exam_schedule_file

router = APIRouter(prefix='/campus/bridge/exams', tags=['internal-exams'])


class ExamScheduleUpload(BaseModel):
    model_config = ConfigDict(extra='forbid')
    filename: str = Field(min_length=1, max_length=180)
    contentBase64: str = Field(min_length=1, max_length=11_184_812)


@router.post('/parse', dependencies=[Depends(require_service)])
def parse_upload(body: ExamScheduleUpload):
    try:
        content = base64.b64decode(body.contentBase64, validate=True)
    except (ValueError, binascii.Error):
        raise HTTPException(400, 'Invalid document encoding.')
    try:
        return parse_exam_schedule_file(body.filename, content)
    except ValueError as exc:
        raise HTTPException(400, str(exc))
