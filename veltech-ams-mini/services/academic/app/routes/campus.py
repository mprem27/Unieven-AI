"""Private, read-only campus overview of existing per-student source records."""
from fastapi import APIRouter, Depends, HTTPException, Response
from pymongo.database import Database
from app.config.database import get_db
from app.security.permissions import get_current_user
from app.services.base import serialize_document
from pydantic import BaseModel, Field
from app.security.permissions import require_student
from app.security.portal_credentials import decrypt_portal_password
from app.services.ams.ams_adapter import AmsAdapter, AmsAuthenticationError
from app.services.ams.login_admission import SourceLoginBusy, source_login_admission
from app.services.ams.manual_session import prepare_challenge, take_challenge
from app.services.university_sources import source_status, public_news
from app.services.ams.sync_status import begin_sync,fail_sync,read_sync_status
from app.services.ams.sync_service import sync_authenticated_records
from app.services.ams.active_sessions import active_ams_sessions
from app.services.ams.metadata import owned_metadata
from starlette.concurrency import run_in_threadpool

router = APIRouter(prefix="/campus", tags=["campus"])

PROFILE_FIELDS = (
    "name", "email", "portalUsername", "photoDataUri", "vtuNumber", "rollNumber", "phoneNumber", "branch",
    "degree", "year", "semester", "section", "batch", "regulation", "mentorName", "photoUrl",
    "gender", "dateOfBirth", "fatherName", "motherName", "parentName", "parentPhone",
    "academicBankCreditsId", "portalSynced", "lastSyncedAt", "source",
    "community", "religion", "nationality", "aadhaarNumber", "registrationStatus", "amsEmail", "academicYear",
    "notificationsEnabled", "absentAlertsEnabled",
)

@router.get('/sources')
async def sources():
    return await source_status()

@router.get('/news')
async def news():
    try:
        return await public_news()
    except Exception:
        raise HTTPException(502, 'The official university website could not be fetched. Please retry.')

@router.post('/ams/challenge')
async def ams_challenge(current_user: dict = Depends(require_student)):
    try:
        return await prepare_challenge(str(current_user['id']))
    except SourceLoginBusy:
        raise
    except Exception:
        raise HTTPException(502, 'Could not load the official AMS challenge. Check the portal connection and retry.')

class AmsSyncInput(BaseModel):
    challengeId: str = Field(min_length=20,max_length=100)
    answer: str = Field(min_length=1,max_length=30)

@router.post('/ams/sync')
async def ams_sync(body: AmsSyncInput, current_user: dict = Depends(require_student), db: Database = Depends(get_db)):
    if not current_user.get('portalPasswordEncrypted') or not current_user.get('portalUsername'):
        raise HTTPException(409,'Save your own portal connection before syncing AMS.')
    # Admission precedes taking the one-time challenge. A busy response leaves
    # it usable and shares the exact report semaphore used by queued refreshes.
    async with active_ams_sessions.record_sync_slot(wait_timeout=3.0):
        return await _ams_sync_admitted(body,current_user,db)

async def _ams_sync_admitted(body,current_user,db):
    sid=str(current_user['id']);prepared=None;adapter=None;session=None
    try:
        async with source_login_admission.slot():
            begin_sync(db,sid)
            try:
                prepared=await take_challenge(str(current_user['id']),body.challengeId)
            except ValueError as error:
                fail_sync(db,sid,'The AMS challenge is unavailable or expired. Load a fresh challenge.')
                raise HTTPException(409,str(error))
            adapter=AmsAdapter()
            password=decrypt_portal_password(current_user['portalPasswordEncrypted'])
            session=await adapter.login(current_user['portalUsername'],password,captcha=body.answer,prepared=prepared)
        profile=await adapter.get_student_profile(session)
        if not profile:raise ValueError('No student profile was returned.')
        # Authentication just proved this exact AMS principal. Bind only the signed-in
        # student's own workspace; never claim an existing owner by email.
        principal=str(session.get('portalUsername') or session.get('username') or '').strip()
        if not principal:raise HTTPException(502,'AMS did not confirm the student identity.')
        db.users.create_index('portalVerifiedPrincipal',unique=True,sparse=True)
        conflict=db.users.find_one({'portalVerifiedPrincipal':principal})
        if conflict and str(conflict['_id'])!=str(current_user['id']):raise HTTPException(409,'This verified portal identity already belongs to another academic workspace. Contact the administrator for a verified migration.')
        from app.utils.dates import utc_now
        from bson import ObjectId
        db.users.update_one({'_id':ObjectId(current_user['id'])},{'$set':{'portalVerifiedPrincipal':principal,'portalPrincipalVerifiedAt':utc_now()}})
        result=await sync_authenticated_records(db,sid,session,adapter,profile)
        status=read_sync_status(db,sid)
        return {'success':True,'source':'ams','partial':status['state']!='idle','errors':result['notes'],'portalPrincipal':principal,'academicId':sid,
                'updated':result['updated'],'syncStatus':status}
    except SourceLoginBusy:
        raise
    except HTTPException:
        if prepared:fail_sync(db,sid,'AMS sync could not complete. Previous records were retained.')
        raise
    except AmsAuthenticationError:
        fail_sync(db,sid,'AMS did not accept the login or CAPTCHA. Load a fresh challenge.')
        raise HTTPException(400,'AMS did not accept the login or CAPTCHA. Load a fresh challenge and check your credentials.')
    except Exception:
        fail_sync(db,sid,'AMS data could not be fetched completely. Previous records were retained.')
        raise HTTPException(502,'AMS data could not be fetched completely. Existing records were preserved; check the source and retry.')
    finally:
        if session:
            await adapter.logout(session)
        elif prepared:
            await prepared['client'].aclose()

@router.post('/ams/refresh')
async def ams_refresh(current_user:dict=Depends(require_student),db:Database=Depends(get_db)):
    from app.services.ams.sync_jobs import enqueue_sync
    sid=str(current_user['id'])
    try:
        queued=await enqueue_sync(db,sid)
        return {'success':True,'source':'ams','queued':True,'alreadyRunning':not queued,'partial':False,'errors':[],'updated':{},'syncStatus':read_sync_status(db,sid)}
    except ValueError as error:
        await active_ams_sessions.revoke(sid)
        fail_sync(db,sid,'AMS sign-in expired. Sign in again to refresh your records.')
        raise HTTPException(409,str(error))

@router.post('/ams/logout')
async def ams_logout(current_user:dict=Depends(require_student)):
    await active_ams_sessions.revoke(str(current_user['id']))
    return {'success':True}

@router.get("/snapshot")
def snapshot(current_user: dict = Depends(get_current_user), db: Database = Depends(get_db)):
    student_id = str(current_user["id"])
    # Authentication already resolves this student's own document; caller supplies no ID.
    profile = {field: current_user.get(field) for field in PROFILE_FIELDS if current_user.get(field) is not None}
    metadata = owned_metadata(db,student_id)
    source_profile = metadata.get("profile", {})
    if isinstance(source_profile, dict):
        for key in PROFILE_FIELDS:
            if not profile.get(key) and source_profile.get(key):
                profile[key] = source_profile[key]
    # College email follows the institution format supplied for this project.
    # It is display metadata, never an automatically verified recovery identity.
    import re
    principal = str(current_user.get('portalVerifiedPrincipal') or profile.get('portalUsername') or '')
    if re.fullmatch(r'vtu[0-9]+',principal,re.I):
        profile['institutionalEmail'] = principal.lower() + '@veltech.edu.in'
        profile['email'] = profile.get('amsEmail') or profile['institutionalEmail']
    academic = {"bucket": metadata.get("bucket"), "courses": metadata.get("courses", []),
                "updatedAt": metadata.get("updatedAt"), "source": metadata.get("source")}
    # Only display additional academic modules when present in the source database.
    for field in ("results", "examinations", "fees", "documents", "requests", "credits", "creditSummary", "resultSummary"):
        if current_user.get(field) is not None:
            academic[field] = current_user[field]
    academic['sourceModules']=metadata.get('sourceModules',[])
    academic['gradeScale']=metadata.get('gradeScale',[])
    academic['coverage']={key:('available' if academic.get(key) else 'unavailable') for key in ('courses','results','credits','examinations','fees','documents','requests')}
    academic['sectionSources']={key:section_source(academic.get(key,[]),metadata,key) for key in ('courses','results','credits','examinations','fees','documents')}
    if academic.get('resultSummary'):
        academic['coverage']['results']='available'
        academic['sectionSources']['results']=section_source([*academic.get('results',[]),*academic['resultSummary']],metadata,'results')
    if academic.get('creditSummary'):
        credit_records=[*academic.get('credits',[]),*academic['creditSummary']]
        academic['coverage']['credits']='available'
        academic['sectionSources']['credits']=section_source(credit_records,metadata,'credits')
    academic['syncStatus']=read_sync_status(db,student_id)
    academic['liveVerified']=bool(current_user.get('portalPrincipalVerifiedAt'))
    official_profile = current_user.get('amsOfficialProfile')
    official_courses = metadata.get('amsRegisteredCourses')
    result={"profile": profile, "academic": academic,
            "officialAcademic": {"profile": official_profile if isinstance(official_profile, dict) else {},
                                 "courses": official_courses if isinstance(official_courses, list) else [],
                                 "source": "ams"},
            "identity": {"verifiedPrincipal": current_user.get('portalVerifiedPrincipal') if current_user.get('portalPrincipalVerifiedAt') else None,
                         "verifiedAt": current_user.get('portalPrincipalVerifiedAt')}}
    if current_user.get('amsAttendanceSummary') is not None:
        result['attendanceSummary']=current_user['amsAttendanceSummary']
    if current_user.get('amsClassRecords') is not None:
        result['attendanceRecords']=current_user['amsClassRecords']
    return serialize_document(result)

@router.get('/sync-status')
async def sync_status(current_user:dict=Depends(require_student),db:Database=Depends(get_db)):
    sid=str(current_user['id'])
    status=await run_in_threadpool(read_sync_status,db,sid)
    return {**status,'sourceSession':await active_ams_sessions.capability(sid)}


@router.get('/workspace')
def workspace(response:Response,current_user:dict=Depends(require_student),db:Database=Depends(get_db)):
    """One authenticated read of this owner's saved records, with no AMS request."""
    from app.schemas.user import UserPublic
    from app.schemas.attendance import AttendanceRecordPublic,AttendanceSummaryItem
    from app.schemas.notification import NotificationPublic
    from app.routes.timetable import get_timetable
    from app.routes.subjects import list_subjects
    from app.services.attendance_service import AttendanceService
    from app.services.notification_service import NotificationService
    response.headers['Cache-Control']='private, no-store'
    profile=UserPublic.model_validate(current_user).model_dump(mode='json')
    data={'workspaceVersion':1,'profile':profile,'academic':{},'errors':{}}
    try:
        saved=snapshot(current_user=current_user,db=db)
        data['profile']={**profile,**saved['profile']}
        data['academic']=saved['academic']
    except Exception:
        saved={};data['errors']['snapshot']='Academic records could not be read. Please retry.'
    attendance=AttendanceService(db)
    readers={
        'summary':lambda:[AttendanceSummaryItem.model_validate(row).model_dump(mode='json') for row in attendance.summary(str(current_user['id']))],
        'records':lambda:[AttendanceRecordPublic.model_validate(row).model_dump(mode='json') for row in attendance.list_records(str(current_user['id']))],
        'timetable':lambda:get_timetable(current_user=current_user,db=db),
        'subjects':lambda:list_subjects(_current_user=current_user,db=db),
        'notifications':lambda:[NotificationPublic.model_validate(row).model_dump(mode='json') for row in NotificationService(db).list_notifications(current_user['id'])],
    }
    # Accepted AMS marks already belong to this authenticated owner. Avoid
    # scanning legacy attendance collections when those source rows are present.
    source_keys={'summary':'attendanceSummary','records':'attendanceRecords'}
    for key,reader in readers.items():
        source=source_keys.get(key)
        if source and source in saved:
            data[key]=saved[source];continue
        try:data[key]=reader()
        except Exception:
            data[key]=[];data['errors'][key]=f'{key.capitalize()} could not be read. Please retry.'
    data['syncStatus']=data['academic'].get('syncStatus')
    data['lastSyncedAt']=data['profile'].get('lastSyncedAt')
    data['source']=data['profile'].get('source') or 'academic-service'
    return serialize_document(data)

@router.get('/documents/{document_id}')
def academic_document(document_id:str,current_user:dict=Depends(require_student),db:Database=Depends(get_db)):
    """Read only a bounded file cached from this owner's authenticated AMS sync."""
    from bson import ObjectId
    import base64
    from app.services.ams.source_modules import MAX_FILE_BYTES
    if not ObjectId.is_valid(document_id):raise HTTPException(404,'AMS file not available. Sync the source and retry.')
    file=db.ams_documents.find_one({'_id':ObjectId(document_id),'studentId':str(current_user['id'])})
    if not file or not isinstance(file.get('content'),bytes) or len(file['content'])>MAX_FILE_BYTES:
        raise HTTPException(404,'AMS file not available. Sync the source and retry.')
    return {'name':file['name'],'contentType':file['contentType'],'base64':base64.b64encode(file['content']).decode('ascii')}

@router.post("/sync")
async def sync(current_user: dict = Depends(get_current_user), db: Database = Depends(get_db)):
    if current_user.get("role") != "student":
        raise HTTPException(status_code=403, detail="Student account required for portal sync")
    raise HTTPException(status_code=410, detail='The parent-portal sync is retired. Use the manual AMS connection for your own records.')

class StudentImportInput(BaseModel):
    format: str = Field(pattern=r'^(json|csv|html)$')
    content: str = Field(max_length=5_000_000)

@router.post('/import')
def import_records(body: StudentImportInput, current_user: dict = Depends(require_student), db: Database = Depends(get_db)):
    from app.services.student_import import parse_student_import,store_student_import
    return store_student_import(db,str(current_user['id']),parse_student_import(body.format,body.content))

@router.get('/course-registration')
def course_registration(current_user: dict = Depends(require_student), db: Database = Depends(get_db)):
    from app.services.ams.academic_pages import _same_origin
    metadata=owned_metadata(db,str(current_user['id']))
    modules=metadata.get('sourceModules',[])
    modules=modules if isinstance(modules,list) else []
    official=next((item.get('url') for item in modules if isinstance(item,dict) and item.get('kind')=='course-registration' and _same_origin(str(item.get('url','')))),None)
    def rows(key):
        value=metadata.get(key,[])
        return [row for row in value if isinstance(row,dict)] if isinstance(value,list) else []
    registered=rows('courses')
    offerings=rows('offerings')
    warnings=metadata.get('registrationWarnings',[])
    warnings=[warning for warning in warnings if isinstance(warning,str) and warning.strip()] if isinstance(warnings,list) else []
    window=metadata.get('registrationWindow')
    if not isinstance(window,dict) or any(window.get(key) is not None and not isinstance(window.get(key),str) for key in ('start','end')):
        window=None
    return serialize_document({'registeredCourses':registered,'offerings':offerings,'warnings':warnings,'registrationWindow':window,'officialUrl':official,'submissionSupported':False,'source':metadata.get('source') or ('ams' if any(row.get('source')=='ams' for row in registered) else 'unavailable'),'layoutSupported':bool(registered or offerings),'updatedAt':metadata.get('registrationSourceUpdatedAt') or metadata.get('updatedAt'),'sections':{'registered':section_source(registered,metadata,'courses'),'offered':section_source(offerings,metadata,'offerings')},'message':'Review the registered and offered courses returned by your source. Complete registration in the official AMS portal; no supported submission API has been verified.'})


def section_source(rows,metadata,key):
    """Presence, provenance and discovery are separate facts."""
    rows=rows if isinstance(rows,list) else []
    sources={row.get('source') or (metadata.get('source') if key=='courses' else None) for row in rows if isinstance(row,dict)}
    sources.discard(None)
    sources.discard('')
    kind='course-registration' if key in {'courses','offerings'} else key
    modules=metadata.get('sourceModules',[])
    modules=[item for item in modules if isinstance(item,dict) and item.get('kind')==kind] if isinstance(modules,list) else []
    timestamps=[str(row['sourceUpdatedAt']) for row in rows if isinstance(row,dict) and row.get('sourceUpdatedAt')]
    stored=metadata.get('amsSync')
    states=stored.get('modules') if isinstance(stored,dict) else None
    sync=states.get(key) if isinstance(states,dict) else None
    sync=sync if isinstance(sync,dict) else {}
    return {'status':'available' if rows else ('unsupported' if any(item.get('status')=='unsupported' for item in modules) else 'unavailable'),
            'recordCount':len(rows),'source':next(iter(sources)) if len(sources)==1 else ('mixed' if sources else 'unavailable'),
            'updatedAt':max(timestamps) if timestamps else (metadata.get('updatedAt') if key=='courses' else None),
            'discovered':bool(modules),'layoutSupported':any(item.get('layoutSupported') for item in modules),
            'syncState':sync.get('state'),'lastAttemptAt':sync.get('lastAttemptAt'),'lastSuccessAt':sync.get('lastSuccessAt'),
            'error':sync.get('error'),'retained':sync.get('retained',False)}
