import secrets
from fastapi import APIRouter, Depends, Header, HTTPException
from pydantic import BaseModel, ConfigDict, Field
from app.config.database import get_db
from app.config.settings import settings
from app.services.campus_bridge import campus_session, bind_verified_account

router = APIRouter(prefix='/campus/bridge', tags=['internal-campus'])

def require_service(x_campus_service_key: str = Header(default='')):
    configured = settings.campus_service_key
    if len(configured) < 64 or not secrets.compare_digest(x_campus_service_key.encode('utf-8'), configured.encode('utf-8')):
        raise HTTPException(403, 'Internal campus service authentication required.')

class CampusIdentity(BaseModel):
    model_config = ConfigDict(extra='forbid')
    campusId: str = Field(pattern=r'^[a-f0-9]{24}$')
    email: str = Field(min_length=3, max_length=200, pattern=r'^[^\s@]+@[^\s@]+\.[^\s@]+$')
    name: str = Field(min_length=1, max_length=120)
    department: str = Field(default='', max_length=120)

class VerifiedBinding(CampusIdentity):
    academicId: str = Field(pattern=r'^[a-f0-9]{24}$')

@router.post('/session', dependencies=[Depends(require_service)])
def session(body: CampusIdentity, db=Depends(get_db)):
    return campus_session(db, body.model_dump())

@router.post('/bind', dependencies=[Depends(require_service)])
def bind(body: VerifiedBinding, db=Depends(get_db)):
    return bind_verified_account(db, body.model_dump())

class AdminIdentity(BaseModel):
    model_config=ConfigDict(extra='forbid')
    campusAdminId:str=Field(pattern=r'^[a-f0-9]{24}$')
    name:str=Field(min_length=1,max_length=120)

@router.post('/admin-session',dependencies=[Depends(require_service)])
def admin_session(body:AdminIdentity,db=Depends(get_db)):
    from app.security.jwt import create_access_token
    from app.security.password import hash_password
    from app.utils.dates import utc_now
    import hashlib
    from pymongo.errors import DuplicateKeyError
    db.users.create_index('campusAdminId',unique=True,sparse=True)
    user=db.users.find_one({'campusAdminId':body.campusAdminId})
    if not user:
        now=utc_now();user={'campusAdminId':body.campusAdminId,'email':'admin-'+hashlib.sha256(body.campusAdminId.encode()).hexdigest()+'@campus.invalid','name':body.name,'role':'admin','active':True,'passwordHash':hash_password(secrets.token_urlsafe(40)),'createdAt':now,'updatedAt':now}
        try:user['_id']=db.users.insert_one(user).inserted_id
        except DuplicateKeyError:user=db.users.find_one({'campusAdminId':body.campusAdminId})
    if not user or user.get('role')!='admin' or not user.get('active'):raise HTTPException(403,'The internal academic administration workspace is disabled.')
    return {'token':create_access_token(str(user['_id']),'admin'),'user':{'id':str(user['_id']),'name':user.get('name'),'role':'admin'}}
