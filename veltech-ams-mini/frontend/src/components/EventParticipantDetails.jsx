import {ArrowUpRight,Globe,Mail,Phone,ShieldCheck} from 'lucide-react';
import {isSocialLinkUrl} from '../lib/social-profile';
import '../event-participant-details.css';

export default function EventParticipantDetails({event}){
 const online=['online','hybrid'].includes(event.eventFormat),meetingUrl=typeof event.meetingUrl==='string' && /^https:\/\//i.test(event.meetingUrl) && isSocialLinkUrl(event.meetingUrl)?event.meetingUrl:'';
 const hasContact=event.contactName || event.contactEmail || event.contactPhone;
 return <div className="event-participant-details">
  {event.agenda?.length?<section><h3>Agenda & speakers</h3><ol className="event-participant-agenda">{event.agenda.map((session,index)=><li key={index}><time>{session.time} IST</time><div><strong>{session.title}</strong>{session.speaker?<span>{session.speaker}</span>:null}</div></li>)}</ol></section>:null}
  {online?<section className="event-joining-details"><h3><Globe size={17}/>Joining online</h3>{meetingUrl?<a className="button secondary" href={meetingUrl} target="_blank" rel="noopener noreferrer">Join online session<ArrowUpRight size={16}/></a>:<p><ShieldCheck size={15}/>The meeting link is available to confirmed participants after registration.</p>}</section>:null}
  {event.attendanceInstructions?<section><h3>Attendance & arrival</h3><p>{event.attendanceInstructions}</p></section>:null}
  {event.accessibilityNotes?<section><h3>Accessibility & support</h3><p>{event.accessibilityNotes}</p></section>:null}
  {hasContact?<section><h3>Contact the event team</h3>{event.contactName?<p>{event.contactName}</p>:null}<div className="event-participant-contact">{event.contactEmail?<a href={'mailto:'+event.contactEmail}><Mail size={16}/>{event.contactEmail}</a>:null}{event.contactPhone?<a href={'tel:'+event.contactPhone.replace(/[^+\d]/g,'')}><Phone size={16}/>{event.contactPhone}</a>:null}</div></section>:null}
 </div>;
}
