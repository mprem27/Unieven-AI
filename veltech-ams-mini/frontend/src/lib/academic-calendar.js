import {normalizeScheduleRow} from './schedule.js';
export const WEEK_DAYS=Object.freeze(['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday']);
const ranks={college:1,department:2,students:3};
function parsedDate(date){
 const parsed=new Date(`${date}T12:00:00Z`);
 if(typeof date!=='string' || !/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(+parsed) || parsed.toISOString().slice(0,10)!==date)throw new Error('Choose a valid calendar date.');
 return parsed;
}
export function calendarWeekday(date){return WEEK_DAYS[parsedDate(date).getUTCDay()];}
export function calendarDateRange(date,{before=31,after=93}={}){
 const parsed=parsedDate(date);
 if(!Number.isInteger(before) || !Number.isInteger(after) || before<0 || after<0 || before+after>365)throw new Error('Choose a calendar range of at most 366 days.');
 return {from:new Date(+parsed-before*86400000).toISOString().slice(0,10),to:new Date(+parsed+after*86400000).toISOString().slice(0,10)};
}
const comparePolicies=(a,b)=>(ranks[b.scope] || 0)-(ranks[a.scope] || 0) || String(b.updatedAt || '').localeCompare(String(a.updatedAt || '')) || String(b.id || '').localeCompare(String(a.id || ''));
const sameDay=(row,day)=>typeof row.day==='string' && row.day.trim().toLowerCase()===day.toLowerCase();
function scheduledRow(row,date,administrator=false){
 const {status,attendanceStatus,present,absent,...schedule}=row;
 return {...normalizeScheduleRow(schedule),date,...(administrator?{scheduleSource:'administrator'}:{})};
}

// Policies must already be owner-filtered by the campus API. This function never
// applies attendance: source marks are matched separately against the actual date.
export function resolveAcademicDay({date,classes=[],policies=[]}){
 const weekday=calendarWeekday(date),rows=Array.isArray(classes)?classes:[];
 const policy=(Array.isArray(policies)?policies:[]).filter(p=>p.date===date && ['holiday','follow-day','special'].includes(p.mode)).toSorted(comparePolicies)[0] || null;
 const sourceDay=policy?.mode==='follow-day' && WEEK_DAYS.includes(policy.followDay)?policy.followDay:weekday;
 let effective;
 if(policy?.mode==='holiday')effective=[];
 else if(policy?.mode==='special')effective=(policy.classes || []).map((row,index)=>scheduledRow({...row,id:row.id || `calendar:${policy.id || date}:${index}`,subjectCode:row.courseCode || row.subjectCode || '',subjectName:row.courseName || row.subjectName || '',day:weekday,source:'administrator'},date,true));
 else if(policy?.mode==='follow-day')effective=rows.filter(row=>!row.date && sameDay(row,sourceDay)).map(row=>scheduledRow(row,date,true));
 else{
  const dated=rows.filter(row=>row.date===date);
  effective=(dated.length?dated:rows.filter(row=>!row.date && sameDay(row,weekday))).map(row=>scheduledRow(row,date));
 }
 effective=effective.toSorted((a,b)=>String(a.startTime || '99:99').localeCompare(String(b.startTime || '99:99')));
 const weekend=!effective.length && ['Saturday','Sunday'].includes(weekday);
 const kind=policy?.mode || (weekend?'weekend':'working');
 const label=policy?.label || (kind==='holiday'?'Holiday':kind==='follow-day'?`${sourceDay} timetable`:kind==='special'?'Special classes':weekend?`${weekday} · Weekend`:`${weekday} · Working day`);
 return {date,weekday,sourceDay,kind,label,reason:policy?.reason || '',source:policy?'administrator':effective.length?'source-timetable':'calendar',policy,classes:effective};
}
