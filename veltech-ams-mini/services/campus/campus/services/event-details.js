import {fail} from '../security.js';
import {canManageEvent} from '../policy.js';

export function eventForViewer(event,user,ticketStatus){
 const out={...event};
 if(!canManageEvent(user,event) && !['registered','attended'].includes(ticketStatus))delete out.meetingUrl;
 return out;
}

export const editableEventFields=['title','description','date','time','endTime','eventFormat','meetingUrl','location','category','capacity','pricePaise','deadline','image','video','rules','registrationInstructions','eligibility','contactEmail','contactName','contactPhone','agenda','accessibilityNotes','attendanceInstructions','expiresAt','posterFit','posterPosition','posterTheme'];
export function validateEventKeys(body,{create=false}={}){
 const allowed=create?[...editableEventFields,'scope','department','club','publishPost']:editableEventFields;
 if(!body || typeof body!=='object' || Array.isArray(body) || Object.keys(body).some(key=>!allowed.includes(key)))fail(400,create?'Only supported event details can be published.':'Only event details can be edited; the event scope remains fixed');
}
const clock=/^(?:[01]\d|2[0-3]):[0-5]\d$/;
export function eventDetailsInput(body,{existing={}}={}){
 const out={};
 if(body.eventFormat!==undefined){if(!['on-campus','online','hybrid'].includes(body.eventFormat))fail(400,'Choose an on-campus, online or hybrid event.');out.eventFormat=body.eventFormat;}
 if(body.endTime!==undefined){if(typeof body.endTime!=='string' || body.endTime && !clock.test(body.endTime))fail(400,'Choose a valid end time.');out.endTime=body.endTime;}
 const time=body.time ?? existing.time,endTime=out.endTime ?? existing.endTime;
 if(endTime && clock.test(time) && endTime<=time)fail(400,'End time must be after the start time on the same day.');
 if(body.meetingUrl!==undefined){
  if(typeof body.meetingUrl!=='string' || body.meetingUrl.length>2000)fail(400,'Enter a valid HTTPS meeting link.');
  out.meetingUrl=body.meetingUrl.trim();
  if(out.meetingUrl){let url;try{url=new URL(out.meetingUrl);}catch{fail(400,'Enter a valid HTTPS meeting link.');}if(url.protocol!=='https:' || !url.hostname || url.username || url.password)fail(400,'Enter a valid HTTPS meeting link without credentials.');}
 }
 if(['online','hybrid'].includes(out.eventFormat ?? existing.eventFormat) && !(out.meetingUrl ?? existing.meetingUrl))fail(400,'Online and hybrid events need an HTTPS meeting link.');
 for(const [key,max] of Object.entries({contactName:120,contactPhone:40,accessibilityNotes:2000,attendanceInstructions:2000}))if(body[key]!==undefined){if(typeof body[key]!=='string' || body[key].length>max)fail(400,`Enter valid ${key==='contactName'?'contact name':key==='contactPhone'?'contact phone':'event instructions'}.`);out[key]=body[key].trim();}
 if(out.contactPhone && (!/^\+?[\d\s().-]+$/.test(out.contactPhone) || out.contactPhone.replace(/\D/g,'').length<7 || out.contactPhone.replace(/\D/g,'').length>15))fail(400,'Enter a valid contact phone number.');
 if(body.agenda!==undefined){
  if(!Array.isArray(body.agenda) || body.agenda.length>20)fail(400,'Add up to 20 agenda sessions.');
  out.agenda=body.agenda.map(session=>{
   if(!session || typeof session!=='object' || Array.isArray(session) || Object.keys(session).some(key=>!['time','title','speaker'].includes(key)) || typeof session.time!=='string' || !clock.test(session.time) || typeof session.title!=='string' || !session.title.trim() || session.title.length>160 || session.speaker!==undefined && (typeof session.speaker!=='string' || session.speaker.length>120))fail(400,'Each agenda session needs a valid time and title; keep titles under 160 characters.');
   return {time:session.time,title:session.title.trim(),speaker:(session.speaker || '').trim()};
  });
 }
 return out;
}
