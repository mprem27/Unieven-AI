export const TIME_ZONE='Asia/Kolkata';
export function sortClasses(classes) { return classes.toSorted((a,b)=>(String(a.startTime || '99:99')).localeCompare(String(b.startTime || '99:99'))); }
export function normalizeCourse(course) {return {...course,name:course.name || course.subjectName || course.courseName || 'Registered course',code:course.code || course.subjectCode || course.courseCode || '',credits:course.credits ?? course.credit ?? null};}
export function matchesSubject(a,b) {
 const meaningful=value=>typeof value==='string' && value.trim().length>0;
 return (meaningful(a.subjectId) && meaningful(b.subjectId) && a.subjectId===b.subjectId) || (meaningful(a.subjectCode) && meaningful(b.subjectCode) && a.subjectCode===b.subjectCode);
}
export function recordForClass(entry,records,classes,today) {
 const matches=records.filter(r=>r.date===today && matchesSubject(r,entry));
 const explicit=matches.filter(r=>(entry.period!=null && r.period!=null && String(entry.period)===String(r.period)) || (entry.startTime && r.startTime && entry.startTime===r.startTime));
 if(explicit.length===1)return explicit[0];
 if(explicit.length>1)return null;
 // A daily course mark cannot identify two separate periods of that course.
 const periods=classes.filter(c=>matchesSubject(c,entry));
 return periods.length===1 && matches.length===1 && matches[0].period==null && !matches[0].startTime?matches[0]:null;
}
export function campusDate(now=new Date()) { return new Intl.DateTimeFormat('en-CA',{timeZone:TIME_ZONE,year:'numeric',month:'2-digit',day:'2-digit'}).format(now); }
export function campusTime(now=new Date()) { return new Intl.DateTimeFormat('en-GB',{timeZone:TIME_ZONE,hour:'2-digit',minute:'2-digit',hour12:false}).format(now); }
export function displayDate(value,options={}) { if(!value) return 'Not provided';return new Intl.DateTimeFormat('en-IN',{timeZone:TIME_ZONE,day:'numeric',month:'short',year:'numeric',...options}).format(new Date(value.length===10?value+'T12:00:00+05:30':value)); }
export function attendanceStatus(entry,today=campusDate(),now=campusTime()) {
  if(entry.date>today || (entry.date===today && entry.startTime>now)) return 'upcoming';
  const status=String(entry.status || '').toLowerCase();
  if(['present','p'].includes(status)) return 'present';
  if(['absent','a'].includes(status)) return 'absent';
  if(['on-duty','od'].includes(status)) return 'on-duty';
  if(entry.date===today && entry.startTime<=now && entry.endTime>now) return 'in-progress';
  return 'unknown';
}
export function attendancePercent(present,total) {
  if(!Number.isFinite(Number(present)) || !Number.isFinite(Number(total)) || total<=0 || present<0 || present>total) return null;
  return Math.round(present/total*1000)/10;
}
export function classesNeeded(present,total,target=75) {
  if(total<0 || present<0 || present>total || target<=0 || target>100) return null;
  if(present>=total*target/100) return 0;
  if(target===100) return Infinity;
  return Math.max(0,Math.ceil((target/100*total-present)/(1-target/100)-1e-9));
}
export function normalizeAcademic(data={}) {
  const profile=data.profile || {},subjects=data.subjects || [];
  const summaries=(Array.isArray(data.summary)?data.summary:[]).map(s=>{
    const subject=subjects.find(x=>(s.subjectId && x.id===s.subjectId) || (s.subjectCode && x.code===s.subjectCode)) || {};
    const present=Number(s.presentCount ?? s.present ?? s.attended ?? 0),total=Number(s.totalCount ?? s.total ?? s.totalClasses ?? 0);
    return {id:s.subjectId || s.id || s.subjectCode,code:s.subjectCode || subject.code || '',name:s.subjectName || subject.name || 'Subject',present,total,percent:attendancePercent(present,total) ?? (s.percentage!=null && Number.isFinite(Number(s.percentage)) && Number(s.percentage)>=0 && Number(s.percentage)<=100?Number(s.percentage):null),source:s.source || data.source,sourceUpdatedAt:s.sourceUpdatedAt};
  });
  return {profile:{...profile,name:profile.name || '',studentId:profile.studentId || profile.vtuNumber || profile.rollNumber,department:profile.department || profile.branch,mentor:profile.mentor || profile.mentorName,photo:profile.photo || profile.photoDataURI || profile.photoDataUri || profile.photoUrl},subjects:summaries,records:Array.isArray(data.records)?data.records.map(r=>({...r,id:r.id || [r.subjectCode,r.date,r.period || r.startTime || 'day'].join(':')})):[],timetable:Array.isArray(data.timetable)?data.timetable:[],academic:data.academic || {},notifications:Array.isArray(data.notifications)?data.notifications:[],lastSyncedAt:data.lastSyncedAt,errors:data.errors || {}};
}
