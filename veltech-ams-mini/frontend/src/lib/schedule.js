const validTime=t=>typeof t==='string' && /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(t);
// AMS supplies explicit clock values such as "8:45 AM" and "1:45 PM".
// Convert only complete, unambiguous clock values; never infer missing periods.
export function normalizeScheduleTime(value){
 if(typeof value!=='string')return '';
 const match=/^(\d{1,2}):([0-5]\d)\s*(AM|PM)?$/i.exec(value.trim());
 if(!match)return '';
 let hour=Number(match[1]);const meridiem=match[3]?.toUpperCase();
 if(meridiem){if(hour<1 || hour>12)return '';hour=hour%12+(meridiem==='PM'?12:0);}
 else if(hour>23)return '';
 return `${String(hour).padStart(2,'0')}:${match[2]}`;
}
export function normalizeScheduleRow(row){
 return {...row,startTime:normalizeScheduleTime(row.startTime),endTime:normalizeScheduleTime(row.endTime)};
}
export function scheduleAt(rows,today,time){
 const todayRows=rows.filter(row=>!row.date || row.date===today).map(normalizeScheduleRow),known=todayRows.filter(row=>validTime(row.startTime)&&validTime(row.endTime)&&row.endTime>row.startTime).toSorted((a,b)=>a.startTime.localeCompare(b.startTime));
 return {current:known.find(row=>row.startTime<=time&&time<row.endTime)||null,next:known.find(row=>row.startTime>time)||null,ended:known.filter(row=>row.endTime<=time),unknown:todayRows.filter(row=>!known.includes(row))};
}
export function homeFacts(p){return [['Name',p.name],['AMS ID',p.amsUsername || p.portalPrincipal || p.portalUsername],['Roll number',p.rollNumber || p.studentId],['Department',p.department],['Degree',p.degree],['Semester',p.semester],['Year',p.year],['Batch',p.batch],['Section',p.section],['Mentor',p.mentor || p.mentorName]];}
export function minutesUntil(time,now){if(!validTime(time)||!validTime(now))return null;const minutes=t=>Number(t.slice(0,2))*60+Number(t.slice(3));return Math.max(0,minutes(time)-minutes(now));}
