import {useState} from 'react';
import {ArrowUpRight,Armchair,CalendarDays,Clock3,GraduationCap,MapPin,Newspaper,Radio} from 'lucide-react';
import {useCampus} from '../context/CampusContext';
import {useLiveResource} from '../hooks/useLiveResource';
import {buildAcademicReminders} from '../lib/reminder-policy';
import {liveClassStatus} from '../lib/live-reminders';
import {calendarWeekday} from '../lib/academic-calendar';
import {minutesUntil} from '../lib/schedule';
import './LiveReminderHub.css';
const classSource=row=>row?.scheduleSource==='administrator' || row?.source==='administrator'?'Staff calendar':row?.source==='demo' || row?.source==='sample-preview'?'Fictional preview':row?.source==='ams'?'AMS timetable':'Source timetable';
const urgencyLabels={'in-progress':'In progress',today:'Today',tomorrow:'Tomorrow',new:'New publication',upcoming:'Upcoming'};
function reminderDetail(row){
 const {kind,item,seat}=row;
 if(kind==='exam')return [item.courseCode,item.startTime?`${item.startTime}${item.endTime?`–${item.endTime}`:''} IST`:'Time not provided',seat?`Room ${seat.ownSeat.room} · Seat ${seat.ownSeat.seat}`:item.room].filter(Boolean).join(' · ');
 if(kind==='calendar')return [item.mode==='holiday'?'Holiday · No classes':item.mode==='follow-day'?`${item.followDay} timetable`:'Special classes',item.reason].filter(Boolean).join(' · ');
 if(kind==='schedule')return `${item.validFrom} – ${item.validTo}`;
 return item.category || 'College noticeboard';
}
export default function LiveReminderHub({navigate,openNotice}){
 const [expanded,setExpanded]=useState(false);
 const {data,today,time,clock,mode}=useCampus(),connected=mode==='connected',student=connected && data.profile.accountRole==='student';
 const exams=useLiveResource('/academics/faculty-exams',student),seats=useLiveResource('/academics/exam-seating',student),schedules=useLiveResource('/schedules',connected);
 const status=liveClassStatus({clock,today,time,mode,classes:data.classes || [],timetable:data.timetable || [],policies:data.calendarPolicies || [],dayInfo:data.dayInfo});
 const {current,next,day}=status,item=current || next,sameDay=item?.date===status.today;
 const rows=buildAcademicReminders({examinations:exams.value?.examinations || [],seating:seats.value?.seating || [],schedules:schedules.value?.schedules || [],policies:data.calendarPolicies || [],notices:data.notices || [],ownerVtu:data.profile.officialProfile?.vtuNumber || '',now:`${status.today}T${status.time}:00+05:30`,limit:4});
 const minute=value=>{const m=String(value || '').match(/^(\d{1,2}):(\d{2})$/);return m?Number(m[1])*60+Number(m[2]):null;};
 const starts=minute(current?.startTime),ends=minute(current?.endTime),now=minute(status.time),duration=ends!==null && starts!==null?ends-starts:0,progress=current && duration>0 && now!==null?Math.max(0,Math.min(100,(now-starts)/duration*100)):null;
 const resources=[exams,seats,schedules],initial=resources.some(resource=>resource.loading && !resource.value),refreshing=resources.some(resource=>resource.refreshing),unavailable=resources.some(resource=>resource.error),stale=resources.some(resource=>resource.stale);
 const open=row=>{if(row.kind==='notice'){if(openNotice)openNotice(row.item);else navigate('notifications');}else if(row.kind==='exam')navigate('academics','examinations');else navigate(row.kind==='calendar'?'timetable':'schedules');};
 return <section className={`live-reminder-hub${current?' has-current-class':''}`} aria-label="Live campus reminders">
  <div className="live-hub-heading"><span><Radio size={15}/>Live reminders</span><time><Clock3 size={13}/>{status.time} IST</time></div>
  <div className="live-hub-class">
   <div className="live-hub-class-copy"><span className="live-hub-eyebrow">{current?'Your class now':item?'Your next class':'Your campus day'}{!current && ['holiday','weekend'].includes(day.kind)?` · ${day.label}`:''}</span>
    <h2>{item?.subjectName || item?.name || item?.subjectCode || (day.kind==='holiday' || day.kind==='weekend'?day.label:status.unknown.length?'Class time not provided':(data.classes || []).length?'Your scheduled day is complete':'Timetable not available')}</h2>
    {item?<><p className="live-hub-class-time">{!sameDay?`${calendarWeekday(item.date)}, ${item.date} · `:''}{item.startTime} – {item.endTime}<span>{current?'In progress':sameDay?`In ${minutesUntil(item.startTime,status.time)} min`:'Next scheduled day'}</span></p><p className="live-hub-class-place"><MapPin size={14}/>{item.room || 'Room not provided'}<span>·</span>{item.facultyName || item.faculty || 'Timetable'}<span>·</span>{classSource(item)}</p></>:<p className="live-hub-no-class">{day.reason || (status.unknown.length?'Some classes have no confirmed time. Open your timetable for details.':mode==='demo'?'Fictional preview timetable.':'Your available source timetable has no upcoming class. Check the timetable or sync your portal.')}</p>}
    {progress!==null?<div className="clarity-class-progress"><div role="progressbar" aria-label="Current class time" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progress)}><span style={{width:`${progress}%`}}/></div><small>{Math.max(0,ends-now)} min left</small></div>:null}
    {current && next?<p className="live-hub-following">Next: {next.subjectName || next.name || next.subjectCode} · {next.date!==status.today?`${next.date} · `:''}{next.startTime} – {next.endTime} · {next.room || 'Room not provided'}</p>:null}
   </div><button type="button" className="live-hub-schedule" onClick={()=>navigate('timetable')}>Timetable<ArrowUpRight size={17}/></button>
  </div>
  {rows.length || initial || unavailable?<div className="live-hub-publications"><div className="live-hub-list-heading"><h3>Coming up & published</h3><button type="button" onClick={()=>navigate('notifications')}>View inbox<ArrowUpRight size={14}/></button></div>
   {rows.length?<div className="live-hub-reminders">{(expanded?rows:rows.slice(0,1)).map(row=>{const Icon=row.kind==='exam'?row.seat?Armchair:GraduationCap:row.kind==='notice'?Newspaper:CalendarDays;return <button type="button" className={`live-hub-reminder reminder-${row.urgency}`} key={row.key} onClick={()=>open(row)}><span className={`live-hub-row-icon kind-${row.kind}`}><Icon size={18}/></span><span className="live-hub-row-copy"><small>{urgencyLabels[row.urgency]}{row.kind!=='notice'?` · ${calendarWeekday(row.date)}, ${row.date}`:' · Staff notice'}</small><strong>{row.item.title || row.item.name || row.item.label || row.item.courseName}</strong><span>{reminderDetail(row)}</span></span><ArrowUpRight size={16}/></button>;})}{rows.length>1?<button type="button" className="clarity-more-reminders" onClick={()=>setExpanded(value=>!value)} aria-expanded={expanded}>{expanded?'Show fewer reminders':`${rows.length-1} more reminders`}</button>:null}</div>:<p className="live-hub-empty">{initial?'Checking campus publications…':unavailable?'Some campus publications are unavailable. Your class schedule remains available above.':'No new or upcoming academic reminders. Published updates will appear here.'}</p>}
  </div>:null}
  {refreshing || stale || unavailable || initial || day.source==='administrator'?<div className="live-hub-source"><span>{mode==='demo'?'Fictional preview':stale?'Saved campus updates':day.source==='administrator'?'Staff calendar applied · AMS timetable':'AMS timetable · College publications'}</span><span role="status">{refreshing?'Updating…':unavailable?'Some updates unavailable':initial?'Checking updates…':'India standard time'}</span></div>:null}
 </section>;
}
