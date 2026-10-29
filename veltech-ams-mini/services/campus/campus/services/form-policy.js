import {sameDepartment,sameClub} from '../../../../shared/publishing-directory.mjs';
import {hasAdminPermission} from '../../../../shared/admin-access.mjs';
import {fail} from '../security.js';

export const FORM_TYPES=['text','textarea','email','number','date','select','radio','checkbox'];
const object=value=>value && typeof value==='object' && !Array.isArray(value);
const text=(value,max,required=false)=>typeof value==='string' && value.length<=max && (!required || !!value.trim());
// Account roles come from the persisted session user. Organizer permissions and
// historical ownership never grant access to official answers or evidence.
const accountRole=user=>user?.role ?? user?.accountRole;
export const canCreateForm=(user,form)=>!!user && !!form && ((accountRole(user)==='admin' && hasAdminPermission(user,'forms')) || (accountRole(user)==='faculty' && ['department','club'].includes(form.scope) && !!user.department && sameDepartment(user.department,form.department) && (form.scope!=='club' || (!!user.club && sameClub(user.club,form.club,user.department)))));
export const canManageForm=canCreateForm;
export function canViewForm(user,form) {
 if(!user || !form)return false;
 if(canManageForm(user,form))return true;
 if(form.archivedAt || form.state==='draft')return false;
 return form.scope==='college' || (!!user.department && sameDepartment(user.department,form.department) && (form.scope!=='club' || sameClub(user.club,form.club,user.department)));
}
export const canSubmitForm=user=>accountRole(user)==='student';

export function validateForm(input) {
 if(!object(input) || !text(input.title,150,true) || !text(input.description ?? '',5000) || !['department','club','college'].includes(input.scope) || !text(input.department ?? '',120) || !text(input.club ?? '',120) || (input.scope!=='college' && !input.department?.trim()) || (input.scope==='club' && !input.club?.trim()))fail(400,'Enter a title and valid form scope.');
 if(!['draft','published','closed'].includes(input.state ?? 'published'))fail(400,'Choose a valid form state.');
 if(!Array.isArray(input.fields) || input.fields.length<1 || input.fields.length>30)fail(400,'Add between 1 and 30 questions.');
 const seen=new Set(),fields=input.fields.map(field=>{
  if(!object(field) || !/^[a-zA-Z][a-zA-Z0-9_-]{0,39}$/.test(field.id) || seen.has(field.id) || !text(field.label,200,true) || !FORM_TYPES.includes(field.type) || (field.required!==undefined && typeof field.required!=='boolean'))fail(400,'Each question needs a unique identifier, label and supported type.');
  seen.add(field.id);
  const choices=['select','radio','checkbox'].includes(field.type)?field.choices:[];
  if(!Array.isArray(choices) || (['select','radio','checkbox'].includes(field.type) && (choices.length<2 || choices.length>20)) || choices.some(c=>!text(c,200,true)) || new Set(choices.map(c=>c.trim())).size!==choices.length)fail(400,'Choice questions need 2 to 20 unique options.');
  return {id:field.id,label:field.label.trim(),type:field.type,required:!!field.required,choices:choices.map(c=>c.trim())};
 });
 const dates={};
 for(const key of ['opensAt','closesAt']) {
  const value=input[key];if(value===undefined || value===null || value===''){dates[key]=null;continue;}
  if(!(typeof value==='string' || value instanceof Date) || !Number.isFinite(new Date(value).getTime()))fail(400,'Choose valid opening and closing times.');
  dates[key]=new Date(value);
 }
 if(dates.opensAt && dates.closesAt && dates.opensAt>=dates.closesAt)fail(400,'The form must close after it opens.');
 for(const key of ['requireProof','requireRegistration','checkIn'])if(input[key]!==undefined && typeof input[key]!=='boolean')fail(400,'Choose valid form conditions.');
 let geofence=null;
 if(input.geofence!==undefined && input.geofence!==null) {
  const g=input.geofence;
  if(!object(g) || !Number.isFinite(g.latitude) || Math.abs(g.latitude)>90 || !Number.isFinite(g.longitude) || Math.abs(g.longitude)>180 || !Number.isInteger(g.radiusMeters) || g.radiusMeters<25 || g.radiusMeters>2000)fail(400,'Use valid venue coordinates and a radius from 25 to 2,000 metres.');
  geofence={latitude:g.latitude,longitude:g.longitude,radiusMeters:g.radiusMeters};
 }
 if(input.eventId!==undefined && input.eventId!==null && input.eventId!=='' && !/^[a-f0-9]{24}$/i.test(String(input.eventId)))fail(400,'Choose a valid linked event.');
 const eventId=input.eventId || null;
 if((geofence || input.requireRegistration || input.checkIn) && !eventId)fail(400,'Link an event before adding venue or ticket conditions.');
 if(input.checkIn && (!geofence || !dates.opensAt || !dates.closesAt))fail(400,'Event check-in needs a venue radius and opening and closing times.');
 return {title:input.title.trim(),description:input.description ?? '',scope:input.scope,department:input.scope==='college'?'':input.department.trim(),club:input.scope==='club'?input.club.trim():'',state:input.state ?? 'published',fields,...dates,eventId,geofence,requireProof:!!input.requireProof,requireRegistration:!!input.requireRegistration || !!input.checkIn,checkIn:!!input.checkIn};
}

export function validateAnswers(fields,input) {
 if(!object(input) || Object.keys(input).length>30 || JSON.stringify(input).length>50000)fail(400,'Enter valid answers within the form limits.');
 const known=new Set(fields.map(f=>f.id));if(Object.keys(input).some(key=>!known.has(key)))fail(400,'An answer does not belong to this form.');
 const answers={};
 for(const field of fields) {
  const value=input[field.id],empty=value===undefined || value===null || value==='' || (Array.isArray(value) && value.length===0);
  if(empty){if(field.required)fail(400,`${field.label} is required.`);continue;}
  if(field.type==='checkbox') {
   if(!Array.isArray(value) || value.length>20 || new Set(value).size!==value.length || value.some(v=>!field.choices.includes(v)))fail(400,`Choose valid options for ${field.label}.`);
   answers[field.id]=value;continue;
  }
  if(field.type==='number') {if(typeof value!=='number' || !Number.isFinite(value) || Math.abs(value)>1e12)fail(400,`Enter a valid number for ${field.label}.`);answers[field.id]=value;continue;}
  if(!text(value,field.type==='textarea'?5000:1000,true))fail(400,`Enter a valid answer for ${field.label}.`);
  if(['select','radio'].includes(field.type) && !field.choices.includes(value))fail(400,`Choose an option for ${field.label}.`);
  if(field.type==='email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value))fail(400,`Enter a valid email for ${field.label}.`);
  if(field.type==='date' && (!/^\d{4}-\d{2}-\d{2}$/.test(value) || !Number.isFinite(new Date(value).getTime()) || new Date(value).toISOString().slice(0,10)!==value))fail(400,`Enter a valid date for ${field.label}.`);
  answers[field.id]=value.trim();
 }
 return answers;
}

export function assertFormOpen(form,now=new Date()) {
 if(form.state!=='published' || (form.opensAt && new Date(form.opensAt)>now) || (form.closesAt && new Date(form.closesAt)<=now))fail(409,'This form is outside its submission window.');
}
export function verifyLocation(fence,reading,now=Date.now()) {
 if(!object(reading) || !Number.isFinite(reading.latitude) || Math.abs(reading.latitude)>90 || !Number.isFinite(reading.longitude) || Math.abs(reading.longitude)>180 || !Number.isFinite(reading.accuracy) || reading.accuracy<0 || reading.accuracy>Math.min(fence.radiusMeters,100) || !Number.isFinite(reading.capturedAt) || now-reading.capturedAt>120000 || reading.capturedAt-now>10000)fail(400,'Get a fresh, accurate location at the venue and retry.');
 const rad=n=>n*Math.PI/180,lat=rad(reading.latitude-fence.latitude),lng=rad(reading.longitude-fence.longitude),a=Math.sin(lat/2)**2+Math.cos(rad(fence.latitude))*Math.cos(rad(reading.latitude))*Math.sin(lng/2)**2;
 const distance=6371000*2*Math.atan2(Math.sqrt(Math.min(1,a)),Math.sqrt(Math.max(0,1-a)));
 if(distance>fence.radiusMeters)fail(400,'You are outside the event check-in radius.');
 return {latitude:reading.latitude,longitude:reading.longitude,accuracy:reading.accuracy,capturedAt:new Date(reading.capturedAt),distanceMeters:Math.round(distance),verifiedAt:new Date(now)};
}
