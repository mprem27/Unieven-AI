import {resolveAcademicDay,calendarWeekday} from './academic-calendar.js';
import {scheduleAt} from './schedule.js';
import {campusDate,campusTime} from './attendance.js';
export function liveClassStatus({clock=new Date(),today,time,mode='connected',classes=[],timetable=[],policies=[],dayInfo}={}){
 const instant=new Date(clock),validClock=Number.isFinite(+instant);
 const date=mode==='demo' && today?today:validClock?campusDate(instant):today;
 const localTime=mode==='demo' && time?time:validClock?campusTime(instant):time || '00:00';
 if(!date)return {today:'',time:localTime,current:null,next:null,unknown:[],day:{}};
 const source=timetable.length?timetable:classes.map(row=>row.date || row.day?row:{...row,day:calendarWeekday(date)});
 const day=resolveAcademicDay({date,classes:source,policies});
 // Resolve against the current source and policy list; a retained dayInfo can
 // describe a removed holiday or an older special-class publication.
 const effectiveDay=day;
 const rows=effectiveDay.kind==='holiday'?[]:effectiveDay.classes || [];
 const status=scheduleAt(rows,date,localTime);
 let next=status.next;
 if(!next && (source.length || policies.length)){
  for(let offset=1;offset<=7;offset++){
   const nextDate=new Date(Date.parse(`${date}T12:00:00Z`)+offset*86400000).toISOString().slice(0,10);
   const nextDay=resolveAcademicDay({date:nextDate,classes:source,policies});
   const upcoming=scheduleAt(nextDay.classes,nextDate,'00:00');
   next=upcoming.current || upcoming.next;if(next)break;
  }
 }
 return {...status,next,today:date,time:localTime,day:effectiveDay};
}
