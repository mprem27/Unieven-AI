import '../event-editor.css';
import '../reminder-policy.css';
import {GraduationCap,CalendarDays,ChevronRight} from 'lucide-react';
import {useCampus} from '../context/CampusContext';
import {useLiveResource} from '../hooks/useLiveResource';
import {Button} from './UI';
import {calendarWeekday} from '../lib/academic-calendar';
import {buildAcademicReminders} from '../lib/reminder-policy';
const labels={'in-progress':'IN PROGRESS',today:'TODAY',tomorrow:'TOMORROW',new:'NEW PUBLICATION',upcoming:'UPCOMING EXAM'};
export default function CampusReminders({navigate}){
 const {data,today,clock,mode}=useCampus(),exams=useLiveResource('/academics/faculty-exams',mode==='connected'),seats=useLiveResource('/academics/exam-seating',mode==='connected'),schedules=useLiveResource('/schedules',mode==='connected');
 const rows=buildAcademicReminders({examinations:exams.value?.examinations || [],seating:seats.value?.seating || [],policies:data.calendarPolicies || [],schedules:schedules.value?.schedules || [],now:clock || `${today}T12:00:00+05:30`});
 if(!rows.length)return null;
 return <section className="campus-reminders panel" aria-label="Upcoming academic reminders">{rows.map((row,index)=>{
  const {item,date,kind,seat,urgency}=row,divider=index>0 && rows[index-1].date!==date;
  return <div className={`campus-reminder reminder-${urgency}${divider?' reminder-day-divider':''}`} key={row.key}>{kind==='exam'?<GraduationCap size={23}/>:<CalendarDays size={23}/>}<div><small>{kind==='exam'?labels[urgency]:date===today?'TODAY':kind==='calendar'?'UPCOMING CALENDAR':urgency==='new'?'NEW SCHEDULE':'UPCOMING SCHEDULE'} · {calendarWeekday(date)} · {date}</small><strong>{item.title || item.name || item.label || item.courseName}</strong><span>{kind==='exam'?<>{item.courseCode} · {item.startTime || item.time || 'Time not provided'}{item.endTime?`–${item.endTime}`:''}{seat?` · Room ${seat.ownSeat.room} · Seat ${seat.ownSeat.seat}`:item.room?' · '+item.room:''}</>:kind==='calendar'?<>{item.mode==='holiday'?'Holiday · No classes':item.mode==='follow-day'?`${item.followDay} timetable`:'Special classes'}{item.reason?' · '+item.reason:''}</>:<>{item.validFrom} – {item.validTo}</>}</span></div><Button variant="ghost" onClick={()=>kind==='exam'?navigate('academics','examinations'):navigate(kind==='calendar'?'timetable':'schedules')}>View<ChevronRight size={16}/></Button></div>;
 })}</section>;
}
