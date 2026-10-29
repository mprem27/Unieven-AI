import {uniqueExaminationSessions,examinationUpdatedAt,examSessionKey,canonicalCourse} from '../../../shared/examination-records.mjs';
const DAY=86400000;
const istDate=stamp=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Kolkata',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(stamp));
function dateStamp(date,time='00:00'){
 if(!/^\d{4}-\d{2}-\d{2}$/.test(date || '') || !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(time || ''))return NaN;
 const value=Date.parse(`${date}T${time}:00+05:30`);
 return Number.isFinite(value) && istDate(value)===date?value:NaN;
}
const recentlyUpdated=(row,now)=>{const updated=examinationUpdatedAt(row);return updated>0 && updated<=now && now-updated<DAY;};
const identity=value=>String(value || '').toUpperCase().replace(/[^A-Z0-9]/g,'');
function validOwnSeat(row,ownerVtu){
 const own=row?.ownSeat;
 return own && own.room && own.seat && (!row.state || row.state==='published') && (!ownerVtu || identity(own.vtuNumber)===identity(ownerVtu));
}
function seatMatches(seat,exam){
 const source=seat.exam;
 if(!source)return false;
 if(source.courseCode && source.date)return canonicalCourse(source.courseCode)===canonicalCourse(exam.courseCode) && examSessionKey(source)===examSessionKey(exam);
 return Boolean(source.id && exam.id && source.id===exam.id);
}
// All inputs come from owner/audience-filtered campus endpoints. Never use full
// seating rosters or raw AMS exam announcements here; ownSeat is the only seat.
export function buildAcademicReminders({examinations=[],seating=[],policies=[],schedules=[],notices=[],ownerVtu='',now=Date.now(),limit=5}={}){
 const stamp=now instanceof Date?+now:typeof now==='string'?Date.parse(now):now;if(!Number.isFinite(stamp))return [];
 const today=istDate(stamp),tomorrow=istDate(stamp+DAY),rows=[];
 const ownSeats=seating.filter(row=>validOwnSeat(row,ownerVtu));
 const sessions=uniqueExaminationSessions([...examinations,...ownSeats.filter(row=>recentlyUpdated(row,stamp)).map(row=>row.exam).filter(row=>row?.date && row.courseCode)]);
 for(const item of sessions){
  const date=item.date,start=dateStamp(date,item.startTime || '00:00'),end=dateStamp(date,item.endTime || '23:59');if(!Number.isFinite(start) || !Number.isFinite(end) || end<=stamp)continue;
  const seat=ownSeats.filter(row=>seatMatches(row,item)).sort((a,b)=>examinationUpdatedAt(b)-examinationUpdatedAt(a) || String(b.id || '').localeCompare(String(a.id || '')))[0];
  if(start-stamp>3*DAY && !recentlyUpdated(item,stamp) && !recentlyUpdated(seat,stamp))continue;
  const urgency=start<=stamp && item.startTime?'in-progress':date===today?'today':date===tomorrow?'tomorrow':start-stamp<=3*DAY?'upcoming':'new';
  rows.push({kind:'exam',key:'exam:'+examSessionKey(item),date,sortTime:start,item,seat,urgency});
 }
 for(const item of policies){const day=dateStamp(item.date);if(!Number.isFinite(day) || item.date<today || day-stamp>7*DAY || !['holiday','follow-day','special'].includes(item.mode))continue;rows.push({kind:'calendar',key:'calendar:'+(item.id || item.date),date:item.date,sortTime:day,item,urgency:item.date===today?'today':'upcoming'});}
 for(const item of schedules){const first=dateStamp(item.validFrom),last=dateStamp(item.validTo,'23:59');if(!Number.isFinite(first) || !Number.isFinite(last) || last<stamp)continue;const near=first>=dateStamp(today) && first-stamp<=3*DAY;if(!near && !recentlyUpdated(item,stamp))continue;rows.push({kind:'schedule',key:'schedule:'+item.id,date:item.validFrom<today?today:item.validFrom,sortTime:Math.max(dateStamp(today),first),item,urgency:recentlyUpdated(item,stamp)?'new':'upcoming'});}
 for(const item of notices){
  const published=examinationUpdatedAt(item),expires=Date.parse(item.expiresAt || '');
  if(!recentlyUpdated(item,stamp) || Number.isFinite(expires) && expires<=stamp || ['draft','withdrawn'].includes(item.state))continue;
  rows.push({kind:'notice',key:'notice:'+(item.id || item._id || `${published}:${item.title}`),date:today,sortTime:published,item,urgency:'new'});
 }
 const unique=new Map(rows.map(row=>[row.key,row]));
 return [...unique.values()].sort((a,b)=>Number(a.kind==='notice')-Number(b.kind==='notice') || a.date.localeCompare(b.date) || a.sortTime-b.sortTime || a.key.localeCompare(b.key)).slice(0,Math.max(0,Math.min(10,limit)));
}
