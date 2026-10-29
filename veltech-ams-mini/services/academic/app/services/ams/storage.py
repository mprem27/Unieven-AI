"""Persist source rows in the authenticated student's document, retaining partial data."""
from datetime import datetime, timezone
import logging
from bson import ObjectId


def store_academic_rows(db, student_id, data, *, previous=None):
    own={'_id':ObjectId(student_id)}
    persisted=db.users.find_one(own) or {}
    # Incremental checkpoints always merge against the job's original records.
    # A later contradictory view must restore those records, rather than keep
    # the provisional first value written by an earlier checkpoint.
    existing=persisted if previous is None else previous
    persisted_keys={(row.get('subjectCode',''),row.get('date',''),row.get('period',''))
                    for row in persisted.get('amsClassRecords',[]) if isinstance(row,dict)}
    new_absences=[]
    now=datetime.now(timezone.utc).isoformat()
    updates={};accepted={'summary':0,'records':0,'results':0}
    specs=(('summary','amsAttendanceSummary',('subjectCode',)),
           ('records','amsClassRecords',('subjectCode','date','period')),
           ('results','results',('courseCode','semester','resultType','examinationSession')))
    for kind, field, keys in specs:
        incoming=data.get(kind) or []
        if not incoming:
            continue
        merged={tuple(row.get(k,'') for k in keys):row for row in existing.get(field,[]) if isinstance(row,dict)}
        grouped={}
        for row in incoming:
            key=tuple(row.get(k,'') for k in keys)
            grouped.setdefault(key,[]).append(row)
        for key, rows in grouped.items():
            unique={tuple(sorted(row.items())) for row in rows}
            if len(unique)>1:
                if kind!='records':
                    continue  # Contradictory totals/grades cannot replace confirmed source data.
                value={**rows[0],'status':'unknown'}
            else:
                value=rows[0]
            merged[key]={**value,'source':'ams','sourceUpdatedAt':now}
            if kind=='records' and key not in persisted_keys and str(value.get('status','')).lower()=='absent':
                new_absences.append(merged[key])
            accepted[kind]+=1
        updates[field]=list(merged.values())[-4000:]
    if data.get('resultSummary'):
        summaries=[row for row in existing.get('resultSummary',[]) if isinstance(row,dict)]
        incoming={}
        for row in data['resultSummary']:
            key=(row.get('label'),row.get('semester'),row.get('examinationSession'))
            group=incoming.setdefault(key,[])
            if row not in group:group.append(row)
        for key,rows in incoming.items():
            summaries=[old for old in summaries if (old.get('label'),old.get('semester'),old.get('examinationSession'))!=key]
            summaries.extend({**row,'source':'ams','sourceUpdatedAt':now} for row in rows)
        updates['resultSummary']=summaries[-200:]
    if updates:
        saved=db.users.update_one(own,{'$set':updates})
        if saved.matched_count and new_absences:
            # Repeated incremental checkpoints must not replay old records.
            # The notification service also validates date, preferences and a
            # deterministic owner/class identity before delivery.
            try:
                from app.services.notification_service import NotificationService
                NotificationService(db).notify_new_absences(student_id,new_absences)
            except Exception:
                logging.getLogger(__name__).warning('New attendance notification could not be prepared.')
    return accepted
