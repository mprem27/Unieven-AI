"""Authenticated read orchestration shared by login and manual refresh."""
from bson import ObjectId
from app.services.student_service import StudentService
from app.services.timetable_service import TimetableService
from app.services.ams.academic_pages import collect_academic_pages, fetch_session_view, merge_diagnostics
from app.services.ams.storage import store_academic_rows
from app.services.ams.source_modules import collect_source_modules,store_source_modules
from app.services.ams.sync_status import report_module,report_discovered_modules,finish_sync,read_sync_status


async def sync_authenticated_records(db,sid,session,adapter,profile=None):
    if profile is None:
        # Refresh uses the retained client, never retained credentials or an old
        # HTML cache. A redirect/authentication page must be rejected.
        session.pop('_ams_view_cache', None)
        url = getattr(adapter, 'DEFAULT_URL', adapter.BASE_URL + '/Default.aspx')
        response = await fetch_session_view(session, url, adapter)
        checker = getattr(adapter, '_looks_like_student_page', None)
        if checker and not checker(response.text):
            raise ValueError('AMS did not return a supported student dashboard.')
        session.update(dashboard_html=response.text, url=str(response.url))
        profile = await adapter.get_student_profile(session)
    profile = profile if isinstance(profile, dict) else {}
    official_fields = {'name', 'rollNumber', 'branch', 'degree', 'semester', 'gender', 'mentorName', 'batch',
                       'phoneNumber', 'fatherName', 'motherName', 'dateOfBirth', 'photoDataUri', 'vtuNumber', 'studentId', 'department', 'year', 'section', 'mentor', 'photo'}
    field_count = sum(1 for key in official_fields if profile.get(key) not in (None, ''))
    if field_count:
        StudentService(db)._save_ams_profile(sid,profile)
    report_module(db,sid,'profile','available' if field_count else 'unsupported',record_count=1 if field_count else None,
                  error='Data not available: AMS returned no supported official profile fields.',
                  diagnostics={'fieldCount':field_count,'acceptedRowCount':1 if field_count else 0})
    notes=[];course_count=0
    try:
        timetable=await TimetableService(db,ams_adapter=adapter).sync_timetable(sid,session,profile=profile)
        count=timetable.get('inserted',0)
        course_count=timetable.get('sourceCoursesCount',0)
        report_module(db,sid,'timetable','available' if count else 'unsupported',record_count=count if count else None,
                      error='Data not available: no supported current AMS timetable rows.')
    except Exception:
        report_module(db,sid,'timetable','error',error='AMS timetable could not be updated; previous records retained.')
        notes.append('AMS timetable could not be updated; previous records retained.')
    previous=db.users.find_one({'_id':ObjectId(sid)}) or {}
    def save_academic_progress(value):
        accepted=store_academic_rows(db,sid,value,previous=previous)
        kinds={key:key for key in ('attendance','results') if any(module.get('kind')==key and module.get('status')!='not-loaded' for module in value['modules'])}
        report_discovered_modules(db,sid,value['modules'],kinds)
        return accepted
    rows=await collect_academic_pages(session,adapter,on_progress=save_academic_progress)
    accepted=save_academic_progress(rows);notes.extend(rows['notes'])
    if rows.get('gradeScale'):
        db.timetable_metadata.update_one({'studentId':sid},{'$set':{'gradeScale':[{**row,'source':'ams'} for row in rows['gradeScale']]}},upsert=True)
    if rows['results'] and not accepted['results']:
        for module in rows.get('modules',[]):
            if module.get('kind')=='results' and module.get('status')=='available':
                module.update(status='unsupported',layoutSupported=False,rowCount=0,error='Conflicting AMS grades were discarded; previous grades retained.')
        notes.append('Conflicting AMS grades were discarded; previous grades retained.')
    def save_source_progress(value):
        store_source_modules(db,sid,value)
        kinds={key:key for key in ('credits','fees','examinations','documents') if any(module.get('kind')==key and module.get('status')!='not-loaded' for module in value['modules'])}
        report_discovered_modules(db,sid,value['modules'],kinds)
        if value.get('registeredCourses'):
            report_module(db,sid,'courses','available',record_count=len(value['registeredCourses']))
    modules=await collect_source_modules(session,adapter,on_progress=save_source_progress)
    # Attendance/results are read by their dedicated conservative table reader.
    discovered={(module['url'],module['kind']):module for module in modules['modules']}
    discovered.update({(module['url'],module['kind']):module for module in rows.get('modules',[])})
    modules['modules']=list(discovered.values())
    store_source_modules(db,sid,modules);notes.extend(modules.get('notes',[]))
    report_discovered_modules(db,sid,modules['modules'],{
        'attendance':'attendance','results':'results','credits':'credits','fees':'fees','examinations':'examinations','documents':'documents'})
    registered=modules.get('registeredCourses',[])
    registration=[module for module in modules['modules'] if module.get('kind')=='course-registration']
    course_diagnostics=None
    for module in registration:
        if module.get('diagnostics'):
            course_diagnostics=merge_diagnostics(course_diagnostics,module['diagnostics'])
    if registered or course_count:
        report_module(db,sid,'courses','available',record_count=len(registered) or course_count,diagnostics=course_diagnostics)
    else:
        report_module(db,sid,'courses','unsupported' if any(module.get('status') in {'available','unsupported'} for module in registration) else 'unavailable',
                      error='Data not available: no supported registered course rows were returned.',diagnostics=course_diagnostics)
    finish_sync(db,sid)
    status=read_sync_status(db,sid)
    return {'notes':[status['message']] if status['state']!='idle' else [],
            'moduleNotes':{module['id']:module['error'] for module in status['modules'] if module.get('error')},
            'updated':{**accepted,
                                   **{kind:len(modules.get(kind,[])) for kind in ('fees','examinations','documents')}}}
