import {fail} from '../security.js';
export function eventStartsAt(event) {
 const raw=event?.date;
 if(!raw || !Number.isFinite(new Date(raw).getTime()) || typeof event?.time!=='string')fail(400,'Choose a valid event date and time');
 const m=event.time.trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?$/i);
 if(!m)fail(400,'Choose a valid event time');
 let h=Number(m[1]);const min=Number(m[2]);
 if(m[3]){if(h<1 || h>12)fail(400,'Choose a valid event time');h=h%12+(m[3].toUpperCase()==='PM'?12:0);}
 if(h>23 || min>59)fail(400,'Choose a valid event time');
 const day=typeof raw==='string' && /^\d{4}-\d{2}-\d{2}$/.test(raw)?raw:new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Kolkata',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(raw));
 const result=new Date(`${day}T${String(h).padStart(2,'0')}:${String(min).padStart(2,'0')}:00+05:30`);
 if(!Number.isFinite(result.getTime()))fail(400,'Choose a valid event date and time');
 return result;
}
