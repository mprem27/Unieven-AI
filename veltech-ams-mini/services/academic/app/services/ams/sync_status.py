"""Owner-scoped sync telemetry. A saved login never implies a live AMS session."""
from datetime import datetime, timezone, timedelta
from app.utils.dates import utc_now
from app.services.base import serialize_document
from app.services.ams.academic_pages import merge_diagnostics, _HEADERS
from app.services.ams.metadata import owned_metadata

MODULES = {'profile':'Profile','timetable':'Timetable','attendance':'Attendance','courses':'Courses',
           'results':'Results & grades','credits':'Credit Earned Details','examinations':'Examinations','fees':'Fees & receipts','documents':'Documents'}


def _stored(db, sid):
    return owned_metadata(db,sid).get('amsSync',{})


def _cache_stats(db,sid):
    from app.services.ams.source_modules import MAX_CACHED_FILES,MAX_FILE_BYTES
    rows=list(db.ams_documents.find({'studentId':sid},{'byteLength':1}))
    return {'storage':'mongodb','fileCount':len(rows),'totalBytes':sum(row.get('byteLength',0) for row in rows),
            'maxFiles':MAX_CACHED_FILES,'maxBytes':MAX_CACHED_FILES*MAX_FILE_BYTES}


def begin_sync(db,sid):
    now=utc_now().isoformat();previous=_stored(db,sid)
    modules={}
    for key,label in MODULES.items():
        old=previous.get('modules',{}).get(key,{})
        modules[key]={'id':key,'label':label,'state':'unavailable','lastAttemptAt':now,
                      'lastSuccessAt':old.get('lastSuccessAt'),'error':'Sync in progress.',
                      'recordCount':old.get('recordCount',0),'source':old.get('source','unavailable'),
                      'retained':bool(old.get('lastSuccessAt'))}
    value={'state':'syncing','source':'ams','lastAttemptAt':now,'lastSuccessAt':previous.get('lastSuccessAt'),
           'message':'Reading your authenticated AMS records.','modules':modules}
    db.timetable_metadata.update_one({'studentId':sid},{'$set':{'amsSync':value}},upsert=True)


def report_module(db,sid,key,state,record_count=None,error=None,diagnostics=None):
    if key not in MODULES or state not in {'available','unavailable','unsupported','error'}:
        raise ValueError('Unknown source module state')
    now=utc_now().isoformat();stored=_stored(db,sid);old=stored.get('modules',{}).get(key,{})
    safe_diagnostics = None
    if isinstance(diagnostics, dict):
        safe_diagnostics = {name: value for name, value in diagnostics.items()
                            if name in {'viewCount', 'tableCount', 'headerRowCount', 'frameCount', 'acceptedRowCount', 'fieldCount'}
                            and type(value) is int and 0 <= value <= 100000}
        safe_diagnostics['recognizedHeaderFields'] = sorted({field for field in diagnostics.get('recognizedHeaderFields', [])
                                                            if isinstance(field, str) and field in _HEADERS})
    value={'id':key,'label':MODULES[key],'state':state,'lastAttemptAt':stored.get('lastAttemptAt') or now,
           'lastSuccessAt':now if state=='available' else old.get('lastSuccessAt'),
           'error':None if state=='available' else error or 'Data not available from the supported AMS pages.',
           'recordCount':record_count if record_count is not None else old.get('recordCount',0),
           'source':'ams' if state=='available' or old.get('lastSuccessAt') else 'unavailable',
           'retained':state!='available' and bool(old.get('lastSuccessAt')),
           'diagnostics':safe_diagnostics}
    db.timetable_metadata.update_one({'studentId':sid},{'$set':{f'amsSync.modules.{key}':value}},upsert=True)


def report_discovered_modules(db,sid,modules,kinds):
    for key,kind in kinds.items():
        rows=[row for row in modules if row.get('kind')==kind]
        available=[row for row in rows if row.get('status')=='available']
        state='available' if available else ('error' if any(row.get('status')=='error' for row in rows) else 'unsupported' if any(row.get('status')=='unsupported' for row in rows) else 'unavailable')
        error=None if available else ('Data not available: AMS page has no supported labeled rows.' if state=='unsupported'
                                     else 'Data not available: no supported AMS page was discovered.' if not rows
                                     else 'Data not available: AMS page could not be loaded.')
        if not available and len(rows)==1 and rows[0].get('error'):
            error=rows[0]['error']
        diagnostics = None
        for row in rows:
            if row.get('diagnostics'):
                diagnostics = merge_diagnostics(diagnostics, row['diagnostics'])
        report_module(db,sid,key,state,record_count=sum(row.get('rowCount',0) for row in available) if available else None,error=error,diagnostics=diagnostics)


def finish_sync(db,sid):
    stored=_stored(db,sid)
    for key in MODULES:
        module=stored.get('modules',{}).get(key,{})
        if module.get('error')=='Sync in progress.':
            report_module(db,sid,key,'unavailable',error='Data not available: no supported AMS page was returned.')
    stored=_stored(db,sid);values=list(stored.get('modules',{}).values())
    complete=all(row.get('state')=='available' for row in values) and len(values)==len(MODULES)
    success=any(row.get('state')=='available' for row in values)
    db.timetable_metadata.update_one({'studentId':sid},{'$set':{
        'amsSync.state':'idle' if complete else 'partial',
        'amsSync.lastSuccessAt':utc_now().isoformat() if success else stored.get('lastSuccessAt'),
        'amsSync.message':'AMS records updated.' if complete else 'Some AMS sections are unavailable. Previous records are retained.'}})


def fail_sync(db,sid,message):
    stored=_stored(db,sid)
    for key,module in stored.get('modules',{}).items():
        if module.get('error')=='Sync in progress.':report_module(db,sid,key,'error',error=message)
    db.timetable_metadata.update_one({'studentId':sid},{'$set':{'amsSync.state':'failed','amsSync.message':message}},upsert=True)


def read_sync_status(db,sid):
    stored=_stored(db,sid)
    if not stored:
        return {'state':'not_connected','source':'ams','lastAttemptAt':None,'lastSuccessAt':None,'documentCache':_cache_stats(db,sid),
                'message':'Sign in to AMS to sync your records.',
                'modules':[{'id':key,'label':label,'state':'unavailable','lastAttemptAt':None,'lastSuccessAt':None,
                            'error':None,'recordCount':0,'source':'unavailable','retained':False} for key,label in MODULES.items()]}
    result={key:stored.get(key) for key in ('state','source','lastAttemptAt','lastSuccessAt','message')}
    result['documentCache']=_cache_stats(db,sid)
    result['modules']=[stored.get('modules',{}).get(key,{'id':key,'label':label,'state':'unavailable','lastAttemptAt':None,
        'lastSuccessAt':None,'error':None,'recordCount':0,'source':'unavailable','retained':False}) for key,label in MODULES.items()]
    if result['state']=='syncing':
        try:
            started=datetime.fromisoformat(result['lastAttemptAt'])
            if started.tzinfo is None:started=started.replace(tzinfo=timezone.utc)
            if utc_now()-started>timedelta(minutes=5):
                result.update(state='failed',message='The last AMS sync did not complete. Sign in to AMS again to retry.')
        except (ValueError,TypeError):result.update(state='failed',message='AMS sync status unavailable. Sign in to AMS again to retry.')
        if result['state']=='failed':
            result['modules']=[{**module,'state':'error','error':result['message']} if module.get('error')=='Sync in progress.' else module for module in result['modules']]
    return serialize_document(result)
