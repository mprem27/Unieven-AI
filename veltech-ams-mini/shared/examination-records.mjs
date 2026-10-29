// Shared physical-session identity. Official audience filtering happens first.
export const canonicalCourse=value=>String(value || '').toUpperCase().replace(/[^A-Z0-9]/g,'');
export const examSessionKey=row=>[canonicalCourse(row.courseCode),row.date || '',row.startTime || '',row.endTime || ''].join('|');
export function examinationUpdatedAt(row){return Math.max(0,...['publishedAt','sourceUpdatedAt','updatedAt','createdAt'].map(key=>Date.parse(row?.[key] || '')).filter(Number.isFinite));}
export function uniqueExaminationSessions(rows=[]){
 const slots=new Map();
 for(const row of rows){const key=examSessionKey(row),old=slots.get(key);if(!old || examinationUpdatedAt(row)>examinationUpdatedAt(old) || examinationUpdatedAt(row)===examinationUpdatedAt(old) && String(row.id || row._id || '').localeCompare(String(old.id || old._id || ''))>0)slots.set(key,row);}
 return [...slots.values()].sort((a,b)=>`${a.date}${a.startTime}${canonicalCourse(a.courseCode)}`.localeCompare(`${b.date}${b.startTime}${canonicalCourse(b.courseCode)}`));
}
