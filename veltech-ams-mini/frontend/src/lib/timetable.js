const days=['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];
const clean=value=>typeof value==='string'?value.trim():'';
const validTime=value=>typeof value==='string' && /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value);
const canonicalDay=value=>days.find(day=>day.toLowerCase()===clean(value).toLowerCase()) || '';
export const timetableSlotKey=row=>`${row.startTime}|${row.endTime}`;

// A source interval is never stretched into invented college periods. Dated and
// unmapped rows stay visible separately from the recurring matrix.
export function buildFullTimetable(classes=[]){
 const rows=[],dated=[],unmapped=[];
 for(const row of classes){
  if(row.date){dated.push(row);continue;}
  const day=canonicalDay(row.day);
  if(!day || !validTime(row.startTime) || !validTime(row.endTime) || row.endTime<=row.startTime){unmapped.push(row);continue;}
  rows.push({...row,day});
 }
 const slots=[...new Map(rows.map(row=>[timetableSlotKey(row),{key:timetableSlotKey(row),startTime:row.startTime,endTime:row.endTime}])).values()].sort((a,b)=>a.startTime.localeCompare(b.startTime) || a.endTime.localeCompare(b.endTime));
 return {days:days.filter(day=>rows.some(row=>row.day===day)),slots,rows,dated:dated.toSorted((a,b)=>String(a.date).localeCompare(String(b.date)) || String(a.startTime || '').localeCompare(String(b.startTime || ''))),unmapped};
}
function sourceSelector(row,department){
 const courseCode=clean(row.subjectCode),courseName=clean(row.subjectName || row.name),day=canonicalDay(row.day);
 if(!clean(department) || !['ams','demo','sample-preview'].includes(row.source) || !courseCode || !courseName || !day || !validTime(row.startTime) || !validTime(row.endTime) || row.endTime<=row.startTime)return null;
 return {department:clean(department),courseCode,courseName,day,startTime:row.startTime,endTime:row.endTime,date:clean(row.date),sourceRoom:clean(row.amsRoom ?? row.room),faculty:clean(row.faculty || row.facultyName)};
}
const selectorKeys=['department','courseCode','courseName','day','startTime','endTime','date','sourceRoom','faculty'];
const matches=(a,b)=>selectorKeys.every(key=>a[key]===clean(b[key]));
export function roomSelector(row,sourceRows,department){
 const selector=sourceSelector(row,department);
 if(!selector)return null;
 return sourceRows.filter(value=>{const candidate=sourceSelector(value,department);return candidate && matches(selector,candidate);}).length===1?selector:null;
}
// Apply before calendar resolution so follow-day entries use their original
// source weekday, while special calendar classes retain their targeted rooms.
export function applyRoomOverrides(classes=[],overrides=[],department=''){
 return classes.map(row=>{
  const selector=roomSelector(row,classes,department);
  if(!selector || row.source!=='ams' && !['demo','sample-preview'].includes(row.source))return row;
  const candidates=overrides.filter(override=>override.source==='administrator' && matches(selector,override) && clean(override.room));
  if(candidates.length!==1)return row;
  const override=candidates[0];
  return {...row,amsRoom:selector.sourceRoom,room:override.room,roomSource:'administrator',roomOverrideId:override.id};
 });
}
