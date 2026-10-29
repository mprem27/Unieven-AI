import base64,binascii
from fastapi import APIRouter,Depends,HTTPException
from pydantic import BaseModel,Field,ConfigDict
from app.routes.campus_bridge import require_service
from app.services.exam_seating import parse_seating_file,parse_seating_roster
router=APIRouter(prefix='/campus/bridge/seating',tags=['internal-seating'])
class SeatingUpload(BaseModel):
    model_config=ConfigDict(extra='forbid')
    filename:str=Field(min_length=1,max_length=180)
    contentBase64:str=Field(min_length=1,max_length=12_000_000)
    courseCode:str|None=Field(default=None,min_length=1,max_length=40)
@router.post('/parse',dependencies=[Depends(require_service)])
def parse_upload(body:SeatingUpload):
    try:content=base64.b64decode(body.contentBase64,validate=True)
    except (ValueError,binascii.Error):raise HTTPException(400,'Invalid document encoding.')
    try:return parse_seating_file(body.filename,content,course_code=body.courseCode)
    except ValueError as exc:raise HTTPException(400,str(exc))

class SeatingRosterUpload(SeatingUpload):
    courseCode:str|None=Field(default=None,min_length=1,max_length=40)

@router.post('/roster',dependencies=[Depends(require_service)])
def parse_roster_upload(body:SeatingRosterUpload):
    try:content=base64.b64decode(body.contentBase64,validate=True)
    except (ValueError,binascii.Error):raise HTTPException(400,'Invalid document encoding.')
    try:return parse_seating_roster(body.filename,content,course_code=body.courseCode)
    except ValueError as exc:raise HTTPException(400,str(exc))
