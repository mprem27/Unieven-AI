"""Read one owner's metadata, including rows split by earlier releases."""
from datetime import datetime, timezone

def owned_metadata(db,student_id):
    first=db.timetable_metadata.find_one({'studentId':student_id})
    if not isinstance(first,dict):return {}
    rows=list(db.timetable_metadata.find({'studentId':student_id}))
    def stamp(row):
        values=[]
        for value in (row.get('updatedAt'),row.get('sourceModulesCheckedAt'),row.get('amsSync',{}).get('lastAttemptAt')):
            if isinstance(value,str):
                try:value=datetime.fromisoformat(value.replace('Z','+00:00'))
                except ValueError:continue
            if isinstance(value,datetime):values.append(value.replace(tzinfo=timezone.utc).timestamp())
        return max(values,default=0)
    merged={}
    for row in sorted([first,*[r for r in rows if isinstance(r,dict)]],key=stamp):
        for key,value in row.items():
            if key in {'_id','studentId'} or value in (None,'',[],{}):continue
            if key=='profile' and isinstance(value,dict):
                merged[key]={**merged.get(key,{}),**{k:v for k,v in value.items() if v not in (None,'')}}
            else:merged[key]=value
    return {**merged,'_id':first.get('_id'),'studentId':student_id}
