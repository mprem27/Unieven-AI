"""Bounded, explicit student-owned imports. Imports never establish portal identity."""
import csv
import io
import json
import math
import re
from datetime import date
from bson import ObjectId
from fastapi import HTTPException
from app.services.ams.academic_pages import parse_academic_page
from app.utils.dates import utc_now

MAX_BYTES=5_000_000
MAX_ROWS=4000
PROFILE_FIELDS={'name','rollNumber','branch','degree','year','semester','section','batch','mentorName','phoneNumber','parentName','parentPhone','gender','dateOfBirth','fatherName','motherName','academicBankCreditsId'}
ROW_FIELDS={
 'summary':{'subjectCode','subjectName','totalCount','presentCount','percentage'},
 'records':{'subjectCode','subjectName','date','period','status','startTime','endTime'},
 'results':{'courseCode','courseName','grade','credits','semester','cgpa','gpa','status'},
 'courses':{'code','name','courseCode','courseName','subjectCode','subjectName','credits','faculty','facultyName','semester','type','prerequisites'},
 'timetable':{'day','startTime','endTime','subjectCode','subjectName','faculty','room','semester','section'},
 'fees':{'name','title','amount','status','date','reference'},
 'examinations':{'name','title','date','time','room','status'},
 'documents':{'name','title','type','reference'},
}

def _clean(row,fields):
    if not isinstance(row,dict):raise HTTPException(400,'Each imported row must be an object.')
    clean={}
    for key,value in row.items():
        if key not in fields or value is None:continue
        if isinstance(value,bool) or not isinstance(value,(str,int,float)):raise HTTPException(400,'Imported fields must contain plain text or numbers.')
        if isinstance(value,float) and not math.isfinite(value):raise HTTPException(400,'Imported numbers must be finite.')
        text=str(value).strip()
        if len(text)>500:raise HTTPException(400,'An imported field exceeds 500 characters.')
        if text:clean[key]=value if isinstance(value,(int,float)) else text
    return clean

def _validate(kind,row):
    row=_clean(row,ROW_FIELDS[kind])
    if kind in {'summary','records'} and not row.get('subjectCode'):raise HTTPException(400,'Attendance rows need subjectCode.')
    if kind=='summary':
        try:
            total,present=int(row['totalCount']),int(row['presentCount']);percentage=float(row['percentage'])
            if total<0 or present<0 or present>total or not 0<=percentage<=100 or abs((100*present/total if total else 0)-percentage)>0.51:raise ValueError()
            row.update(totalCount=total,presentCount=present,percentage=percentage)
        except (KeyError,TypeError,ValueError):raise HTTPException(400,'Attendance totals and percentage must agree.')
    if kind=='records':
        try:date.fromisoformat(str(row['date']))
        except (KeyError,ValueError):raise HTTPException(400,'Attendance dates must use YYYY-MM-DD.')
        if not row.get('period') or row.get('status') not in {'present','absent','on-duty','unknown'}:raise HTTPException(400,'Attendance needs a period and supported status.')
    if kind=='timetable':
        if str(row.get('day','')).lower() not in {'monday','tuesday','wednesday','thursday','friday','saturday','sunday'}:raise HTTPException(400,'Timetable rows need a day of the week.')
        for key in ('startTime','endTime'):
            if row.get(key) and not re.fullmatch(r'(?:[01]\d|2[0-3]):[0-5]\d',str(row[key])):raise HTTPException(400,'Class times must use 24-hour HH:MM.')
        if row.get('startTime') and row.get('endTime') and row['endTime']<=row['startTime']:raise HTTPException(400,'Class end must follow class start.')
    if kind=='fees' and row.get('amount') is not None:
        try:
            amount=float(row['amount'])
            if not math.isfinite(amount) or amount<0:raise ValueError()
            row['amount']=amount
        except (TypeError,ValueError):raise HTTPException(400,'Fee amounts must be positive numbers.')
    return row

def parse_student_import(format,content):
    if not isinstance(content,str) or len(content.encode('utf-8'))>MAX_BYTES:raise HTTPException(413,'Import limit is 5 MB.')
    empty={key:[] for key in ROW_FIELDS};empty['profile']={}
    try:
        if format=='json':
            raw=json.loads(content)
            if not isinstance(raw,dict):raise ValueError()
        elif format=='csv':
            reader=csv.DictReader(io.StringIO(content))
            if 'kind' not in (reader.fieldnames or []):raise HTTPException(400,'CSV requires a kind column: records, summary, courses, timetable, results or fees.')
            raw={key:[] for key in ROW_FIELDS}
            for i,row in enumerate(reader):
                if i>=MAX_ROWS:raise HTTPException(413,'Import limit is 4000 rows.')
                kind=row.pop('kind','').strip()
                if kind not in ROW_FIELDS:raise HTTPException(400,'CSV contains an unsupported kind.')
                raw[kind].append(row)
        elif format=='html':raw=parse_academic_page(content)
        else:raise HTTPException(400,'Choose json, csv or html.')
    except (ValueError,csv.Error):raise HTTPException(400,'The import could not be parsed. Use the documented export format.')
    profile=raw.get('profile',{})
    empty['profile']=_clean(profile,PROFILE_FIELDS)
    count=0
    for kind in ROW_FIELDS:
        rows=raw.get(kind,[])
        if not isinstance(rows,list):raise HTTPException(400,'Each import section must contain an array of rows.')
        count+=len(rows)
        if count>MAX_ROWS:raise HTTPException(413,'Import limit is 4000 rows.')
        empty[kind]=[_validate(kind,row) for row in rows]
    return empty

def store_student_import(db,student_id,data):
    owner={'_id':ObjectId(student_id),'role':'student','active':True}
    user=db.users.find_one(owner)
    if not user:raise HTTPException(403,'An active student workspace is required.')
    if user.get('portalVerifiedPrincipal') or user.get('portalPrincipalVerifiedAt'):
        raise HTTPException(403,'Verified AMS records cannot be replaced by an import. Refresh AMS to update your academic records.')
    now=utc_now();updates={**_clean(data['profile'],PROFILE_FIELDS),'source':'student-import','updatedAt':now}
    for kind,field in [('summary','amsAttendanceSummary'),('records','amsClassRecords'),('results','results'),('fees','fees'),('examinations','examinations'),('documents','documents')]:
        if data[kind]:updates[field]=[{**row,'source':'student-import','sourceUpdatedAt':now.isoformat()} for row in data[kind]]
    # Re-check verification in the write predicate so a concurrent AMS login
    # cannot turn this import into an overwrite of a verified workspace.
    unverified={**owner,'portalVerifiedPrincipal':{'$in':[None,'']},'portalPrincipalVerifiedAt':{'$in':[None,'']}}
    if not db.users.update_one(unverified,{'$set':updates}).matched_count:
        raise HTTPException(403,'Verified AMS records cannot be replaced by an import. Refresh AMS to update your academic records.')
    if data['courses']:db.timetable_metadata.update_one({'studentId':student_id},{'$set':{'courses':data['courses'],'source':'student-import','updatedAt':now}},upsert=True)
    if data['timetable']:
        # Replaces only this student's previously imported schedule; live rows remain.
        db.timetable.delete_many({'studentId':student_id,'source':'student-import'})
        db.timetable.insert_many([{**row,'studentId':student_id,'source':'student-import','active':True,'updatedAt':now} for row in data['timetable']])
    return {'success':True,'source':'student-import','liveVerified':False,'updated':{key:len(value) for key,value in data.items() if key!='profile'},'message':'Your imported records were saved. They are labeled as imports, not a verified live portal sync.'}
