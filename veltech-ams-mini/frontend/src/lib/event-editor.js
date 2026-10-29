import {eventStart} from './calendar.js';

const indiaDate=value=>!value?'':/^\d{4}-\d{2}-\d{2}$/.test(value)?value:new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Kolkata',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(value));
const indiaDateTime=value=>value?new Date(new Date(value).getTime()+19800000).toISOString().slice(0,16):'';
export const eventFormatLabel=value=>({'on-campus':'On campus',online:'Online',hybrid:'Hybrid'}[value] || 'On campus');
export function eventScopeChoices(profile,existing){
 if(existing?.scope)return [existing.scope];
 if(profile?.accountRole==='admin' || profile?.role==='admin' || profile?.campusRole==='admin')return ['college','department','club'];
 return ({club_organizer:['club'],department_coordinator:['department'],college_event_manager:['college']}[profile?.campusRole] || []);
}
export function createEventDraft(profile={},now=new Date()){
 return {title:'',description:'',date:indiaDate(new Date(+now+7*86400000)),time:'10:00',endTime:'11:00',eventFormat:'on-campus',meetingUrl:'',location:'',category:'Workshop',scope:eventScopeChoices(profile)[0] || '',department:profile.campusDepartment || profile.department || '',club:profile.club || '',capacity:100,price:0,paid:false,deadline:'',image:'/assets/veltech-campus.jpg',video:'',rulesText:'Carry your college ID.\nFollow the organizer’s check-in instructions.',eligibility:'',contactEmail:'',contactName:'',contactPhone:'',registrationInstructions:'',agenda:[],accessibilityNotes:'',attendanceInstructions:'',expiry:'default',expiresAt:'',posterFit:'cover',posterPosition:50,posterTheme:'navy'};
}
export function eventEditorDraft(event,profile){
 return {...createEventDraft(profile),...event,date:indiaDate(event.date),eventFormat:event.eventFormat || 'on-campus',endTime:event.endTime || '',agenda:(event.agenda || []).map(({time,title,speaker})=>({time,title,speaker:speaker || ''})),price:(event.pricePaise || 0)/100,paid:!!event.pricePaise,rulesText:(event.rules || []).join('\n'),deadline:indiaDateTime(event.deadline),expiry:event.expiresAt?'custom':'never',expiresAt:indiaDate(event.expiresAt),originalDeadline:event.deadline || null,originalExpiresAt:event.expiresAt || null};
}
export function eventEditorPayload(draft,{editing=false,publishPost=false}={}){
 const keys=['title','description','time','endTime','eventFormat','meetingUrl','location','category','image','video','registrationInstructions','eligibility','contactEmail','contactName','contactPhone','agenda','accessibilityNotes','attendanceInstructions','posterFit','posterTheme'];
 const body=Object.fromEntries(keys.map(key=>[key,draft[key]]));
 Object.assign(body,{capacity:Number(draft.capacity),pricePaise:draft.paid?Math.round(Number(draft.price)*100):0,date:`${draft.date}T${draft.time}:00+05:30`,deadline:draft.deadline?(draft.deadline===indiaDateTime(draft.originalDeadline)?draft.originalDeadline:`${draft.deadline}:00+05:30`):null,rules:String(draft.rulesText || '').split('\n').map(value=>value.trim()).filter(Boolean),posterPosition:Number(draft.posterPosition)});
 if(draft.expiry!=='default')body.expiresAt=draft.expiry==='never'?null:draft.expiresAt===indiaDate(draft.originalExpiresAt)?draft.originalExpiresAt:`${draft.expiresAt}T23:59:59+05:30`;
 if(!editing)Object.assign(body,{scope:draft.scope,department:draft.department,club:draft.club,publishPost});
 return body;
}
export function validateEventDraft(draft,{isNew=true,now=new Date()}={}){
 const errors=[],add=(step,field,message)=>errors.push({step,field,message}),clock=/^(?:[01]\d|2[0-3]):[0-5]\d$/;
 if(!draft.title?.trim())add(0,'title','Enter an event title.');
 if(!draft.category?.trim())add(0,'category','Choose an event category.');
 let start;try{start=eventStart(draft);if(start<=now)add(1,'date','Choose a future date and start time.');}catch{add(1,'date','Choose a valid date and start time.');}
 if(!clock.test(draft.time || ''))add(1,'time','Choose a valid start time.');
 if((isNew || draft.endTime) && (!clock.test(draft.endTime || '') || draft.endTime<=draft.time))add(1,'endTime','Choose an end time after the start time on the same day.');
 if(!draft.location?.trim())add(1,'location',draft.eventFormat==='online'?'Enter the online platform name.':'Enter the event venue.');
 if(['online','hybrid'].includes(draft.eventFormat)){
  let url;try{url=new URL(draft.meetingUrl);}catch{}if(!url || url.protocol!=='https:' || !url.hostname || url.username || url.password)add(1,'meetingUrl','Add an HTTPS meeting link without credentials.');
 }
 if(!draft.scope)add(2,'scope','Choose an audience permitted by your event role.');
 if(['department','club'].includes(draft.scope) && !draft.department?.trim())add(2,'department','Choose a department.');
 if(draft.scope==='club' && !draft.club?.trim())add(2,'club','Choose a club.');
 if(!Number.isInteger(Number(draft.capacity)) || Number(draft.capacity)<1 || Number(draft.capacity)>100000)add(3,'capacity','Choose a capacity from 1 to 100,000.');
 if(draft.paid && (!Number.isFinite(Number(draft.price)) || Number(draft.price)<=0 || Number(draft.price)>100000))add(3,'price','Enter a registration fee up to ₹100,000.');
 if(draft.deadline && (!Number.isFinite(+new Date(`${draft.deadline}:00+05:30`)) || start && new Date(`${draft.deadline}:00+05:30`)>start))add(3,'deadline','Registration must close by the event start.');
 for(const [index,session] of (draft.agenda || []).entries())if(!clock.test(session.time || '') || !session.title?.trim())add(0,'agenda',`Agenda session ${index+1} needs a time and title.`);
 if(draft.expiry==='custom' && (!draft.expiresAt || start && new Date(`${draft.expiresAt}T23:59:59+05:30`)<=start))add(4,'expiresAt','Choose a listing expiry after the event.');
 return errors;
}
