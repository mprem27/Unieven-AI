export function eventStart(event) {
 const date=new Date(event.date);
 if(!Number.isFinite(date.getTime()) || typeof event.time!=='string')throw new Error('The event date or time is not available for a calendar entry.');
 const match=event.time.trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?$/i);
 if(!match)throw new Error('The event date or time is not available for a calendar entry.');
 let hour=Number(match[1]);const minute=Number(match[2]);
 if(match[3]){if(hour<1 || hour>12)throw new Error('The event time is not available.');hour=hour%12+(match[3].toUpperCase()==='PM'?12:0);}
 if(hour>23 || minute>59)throw new Error('The event time is not available.');
 const day=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Kolkata',year:'numeric',month:'2-digit',day:'2-digit'}).format(date);
 return new Date(`${day}T${String(hour).padStart(2,'0')}:${String(minute).padStart(2,'0')}:00+05:30`);
}
