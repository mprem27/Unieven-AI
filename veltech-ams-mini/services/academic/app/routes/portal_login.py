"""Internal manual AMS sign-in. Passwords and challenge answers are never persisted."""
import hashlib
import secrets
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, ConfigDict, Field
from pymongo.errors import DuplicateKeyError
from app.config.database import get_db
from app.routes.campus_bridge import require_service
from app.services.ams.manual_session import prepare_challenge,take_challenge
from app.services.ams.ams_adapter import AmsAdapter,AmsAuthenticationError
from app.services.ams.login_admission import SourceLoginBusy,source_login_admission
from app.security.jwt import create_access_token
from app.security.password import hash_password
from app.utils.dates import utc_now
from app.services.ams.sync_status import begin_sync,fail_sync,read_sync_status
from app.services.ams.active_sessions import active_ams_sessions
from app.services.ams.sync_jobs import enqueue_sync
from app.college.parser import parse_ams_profile
from app.services.student_service import StudentService
from app.services.ams.sync_status import report_module

router=APIRouter(prefix='/campus/portal-login',tags=['internal-campus'],dependencies=[Depends(require_service)])
class ChallengeInput(BaseModel):
    model_config=ConfigDict(extra='forbid')
    owner:str=Field(min_length=32,max_length=128,pattern=r'^[A-Za-z0-9_-]+$')
class LoginInput(ChallengeInput):
    challengeId:str|None=Field(default=None,min_length=20,max_length=100)
    username:str=Field(min_length=1,max_length=100)
    password:str=Field(min_length=1,max_length=200)
    answer:str=Field(default='',max_length=30)

@router.post('/challenge')
async def challenge(body:ChallengeInput):
    try:return await prepare_challenge('browser:'+body.owner)
    except SourceLoginBusy:raise
    except Exception:raise HTTPException(502,'Could not load the official AMS challenge. Retry when the portal is available.')

def resolve_portal_student(db,principal,profile):
    users=db.users
    users.create_index('portalVerifiedPrincipal',unique=True,sparse=True)
    existing=users.find_one({'portalVerifiedPrincipal':principal})
    if existing:
        if existing.get('role')!='student' or not existing.get('active'):raise HTTPException(403,'An active student workspace is required.')
        return existing
    if users.find_one({'portalUsername':principal,'portalVerifiedPrincipal':{'$exists':False}}):raise HTTPException(409,'An existing workspace needs password-verified migration before AMS sign-in can use it.')
    alias='ams-'+hashlib.sha256(principal.encode()).hexdigest()+'@portal.invalid'
    now=utc_now()
    user={'email':alias,'emailIsInternalAlias':True,'name':str(profile.get('name') or 'Student')[:120],'role':'student','active':True,'portalUsername':principal,'portalVerifiedPrincipal':principal,'portalPrincipalVerifiedAt':now,'passwordHash':hash_password(secrets.token_urlsafe(40)),'source':'ams','createdAt':now,'updatedAt':now}
    try:user['_id']=users.insert_one(user).inserted_id
    except DuplicateKeyError:
        user=users.find_one({'portalVerifiedPrincipal':principal})
        if not user:raise HTTPException(409,'The portal workspace could not be linked safely.')
    return user

@router.post('/session')
async def session(body:LoginInput,db=Depends(get_db)):
    challenge_id=body.challengeId
    if not challenge_id:
        try:challenge=await prepare_challenge('browser:'+body.owner)
        except SourceLoginBusy:raise
        except Exception:raise HTTPException(502,'Could not prepare AMS sign-in. Retry when the portal is available.')
        # Only the browser answers an actual upstream challenge. Credentials are never retained.
        if challenge.get('requiresCaptcha'):
            return {'verificationRequired':True,'challenge':challenge}
        challenge_id=challenge['challengeId']
    adapter=None;prepared=None;portal=None;sid=None;retained=False
    try:
        async with source_login_admission.slot():
            try:prepared=await take_challenge('browser:'+body.owner,challenge_id)
            except ValueError as error:raise HTTPException(409,str(error))
            adapter=AmsAdapter()
            portal=await adapter.login(body.username.strip(),body.password,captcha=body.answer,prepared=prepared)
        profile=parse_ams_profile(portal.get('dashboard_html',''))
        if not profile.get('name'):profile=await adapter.get_student_profile(portal)
        if not profile or not profile.get('name'):raise HTTPException(502,'AMS did not return a supported student profile. No account was created.')
        principal=str(portal.get('portalUsername') or portal.get('username') or '').strip()
        if not principal:raise HTTPException(502,'AMS did not confirm the authenticated student identity.')
        student=resolve_portal_student(db,principal,profile);sid=str(student['_id'])
        StudentService(db)._save_ams_profile(sid,profile)
        retained=await active_ams_sessions.retain(sid,portal,adapter)
        if retained:
            await enqueue_sync(db,sid,initial=True)
            report_module(db,sid,'profile','available',record_count=1)
        else:
            begin_sync(db,sid)
            fail_sync(db,sid,'The AMS refresh service is busy. Your verified sign-in is complete; reconnect later to refresh records.')
        status=read_sync_status(db,sid)
        return {'token':create_access_token(sid,'student'),'user':{'id':sid,'email':student['email'],'name':profile['name'],'emailIsInternalAlias':bool(student.get('emailIsInternalAlias'))},'portalPrincipal':principal,'profile':{'name':profile['name']},'source':'ams-manual-login','partial':status['state']!='idle','syncPending':retained,'refreshAvailable':retained,'amsSessionExpiresIn':1800 if retained else 0,'notes':[] if retained else [status['message']],'syncStatus':status}

    except HTTPException:
        if sid:fail_sync(db,sid,'AMS sign-in sync could not complete. Previous records retained.')
        raise
    except AmsAuthenticationError:raise HTTPException(400,'AMS did not accept the login or CAPTCHA. Load a fresh challenge and retry.')
    except Exception:
        if sid:fail_sync(db,sid,'AMS sign-in sync could not complete. Previous records retained.')
        raise HTTPException(502,'AMS sign-in could not be completed. Existing records were retained.')
    finally:
        if portal and not retained:await adapter.logout(portal)
        elif not portal and prepared:await prepared['client'].aclose()
