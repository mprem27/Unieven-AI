import {hasAdminAction} from '../../../shared/admin-access.mjs';
import {zipSync,strToU8} from 'fflate';

export const FORM_FIELD_TYPES=[['text','Short answer'],['textarea','Paragraph'],['email','Email'],['number','Number'],['date','Date'],['select','Dropdown'],['radio','Multiple choice'],['checkbox','Checkboxes']];
export const canFormAction=(profile,form,action)=>{
 const role=profile?.accountRole ?? profile?.role;
 return (role==='faculty' || role==='admin' && hasAdminAction(profile,'forms',action)) && (action==='create' || form?.canManage===true);
};
export const canAuthorForms=profile=>canFormAction(profile,null,'create');
export const choiceType=type=>['select','radio','checkbox'].includes(type);
export function parseTicketPayload(raw,eventId) {
 if(typeof raw!=='string' || raw.length>4096)throw new Error('Paste the secure QR ticket payload.');
 let value;try{value=JSON.parse(raw);}catch{throw new Error('Use the JSON payload from the student’s event ticket.');}
 if(!value || typeof value!=='object' || Array.isArray(value) || !/^[a-f0-9]{24}$/i.test(value.registrationId || '') || typeof value.qrToken!=='string' || !value.qrToken || value.qrToken.length>128 || value.demo || value.eventId!==eventId)throw new Error('This is not a valid ticket for this event.');
 return {eventId,registrationId:value.registrationId,qrToken:value.qrToken};
}
export const locationReading=position=>({latitude:position.coords.latitude,longitude:position.coords.longitude,accuracy:position.coords.accuracy,capturedAt:position.timestamp});
export function currentLocation() {
 return new Promise((resolve,reject)=>{if(!navigator.geolocation)return reject(new Error('Location is unavailable in this browser.'));navigator.geolocation.getCurrentPosition(p=>resolve(locationReading(p)),e=>reject(new Error(e.code===1?'Location permission was denied. Enable it in browser settings and retry.':'A precise location could not be obtained. Move near the venue and retry.')),{enableHighAccuracy:true,timeout:20000,maximumAge:0});});
}
export function formShareUrl(id,base=window.location.href){const url=new URL(base);url.search='';url.hash=`/forms/${encodeURIComponent(String(id))}`;return url.href;}
export function captureCameraFrame(video,createCanvas=()=>document.createElement('canvas')) {
 return new Promise((resolve,reject)=>{
  if(!video || video.readyState<2 || !video.videoWidth || !video.videoHeight)return reject(new Error('Wait for the live camera preview before taking a photo.'));
  const canvas=createCanvas(),scale=Math.min(1,1600/Math.max(video.videoWidth,video.videoHeight));canvas.width=Math.round(video.videoWidth*scale);canvas.height=Math.round(video.videoHeight*scale);
  const context=canvas.getContext('2d');if(!context)return reject(new Error('Camera capture is unavailable in this browser.'));
  context.drawImage(video,0,0,canvas.width,canvas.height);canvas.toBlob(blob=>blob && blob.size<=8*1024*1024?resolve(blob):reject(new Error('The camera photo could not be captured. Retake it.')),'image/jpeg',0.88);
 });
}
const xml=value=>String(value ?? '').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g,'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&apos;');
export function formResponsesXlsx(report) {
 if(!Array.isArray(report?.columns) || !Array.isArray(report?.rows) || report.rows.length>10000 || report.columns.length>50)throw new Error('This response export exceeds the supported size.');
 const rows=[['UniEve form responses',report.title || ''],['Exported (UTC)',report.exportedAt || ''],[],report.columns,...report.rows];
 const letters=index=>{let value=index+1,result='';while(value){result=String.fromCharCode(65+(value-1)%26)+result;value=Math.floor((value-1)/26);}return result;};
 // All text uses inline strings: student answers cannot become Excel formulas.
 const sheet=`<?xml version="1.0" encoding="UTF-8"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><cols><col min="1" max="50" width="25" customWidth="1"/></cols><sheetData>${rows.map((row,index)=>`<row r="${index+1}">${row.map((value,column)=>{const address=letters(column)+(index+1);return typeof value==='number' && Number.isFinite(value)?`<c r="${address}"><v>${value}</v></c>`:`<c r="${address}" t="inlineStr"><is><t xml:space="preserve">${xml(value)}</t></is></c>`;}).join('')}</row>`).join('')}</sheetData></worksheet>`;
 const files={
  '[Content_Types].xml':'<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>',
  '_rels/.rels':'<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>',
  'xl/workbook.xml':'<?xml version="1.0" encoding="UTF-8"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Form responses" sheetId="1" r:id="rId1"/></sheets></workbook>',
  'xl/_rels/workbook.xml.rels':'<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>',
  'xl/worksheets/sheet1.xml':sheet,
 };
 return zipSync(Object.fromEntries(Object.entries(files).map(([path,content])=>[path,strToU8(content)])),{level:6});
}
export function buildFormPayload(draft) {
 return {title:draft.title,description:draft.description,scope:draft.scope,department:draft.department,club:draft.club,state:draft.state,fields:draft.fields.map(f=>({id:f.id,label:f.label,type:f.type,required:!!f.required,choices:choiceType(f.type)?String(f.options ?? '').split('\n').map(x=>x.trim()).filter(Boolean):[]})),eventId:draft.eventId || null,opensAt:draft.opensAt?new Date(draft.opensAt).toISOString():null,closesAt:draft.closesAt?new Date(draft.closesAt).toISOString():null,requireProof:!!draft.requireProof,requireRegistration:!!draft.requireRegistration || !!draft.checkIn,checkIn:!!draft.checkIn,geofence:draft.locationEnabled?{latitude:Number(draft.latitude),longitude:Number(draft.longitude),radiusMeters:Number(draft.radiusMeters)}:null};
}
const localFormDate=value=>{if(!value)return '';const date=new Date(value);return Number.isFinite(+date)?new Date(+date-date.getTimezoneOffset()*60000).toISOString().slice(0,16):'';};
export function formEditorDraft(form){
 return {...form,fields:form.fields.map(field=>({...field,options:(field.choices || []).join('\n')})),eventId:String(form.eventId?.id || form.eventId?._id || form.eventId || ''),opensAt:localFormDate(form.opensAt),closesAt:localFormDate(form.closesAt),locationEnabled:!!form.geofence,latitude:form.geofence?.latitude ?? '',longitude:form.geofence?.longitude ?? '',radiusMeters:form.geofence?.radiusMeters ?? 100};
}
export function buildFormChanges(draft,original){
 if(original.responseCount>0)return {state:draft.state};
 const {scope,department,club,eventId,...changes}=buildFormPayload(draft);
 for(const key of ['opensAt','closesAt'])if(draft[key]===localFormDate(original[key]))changes[key]=original[key]?new Date(original[key]).toISOString():null;
 return changes;
}
export function createSampleForms() {
 return [{id:'demo-feedback',demo:true,title:'A little feedback. A better next event.',description:'Help the campus team shape the next workshop. This fictional form demonstrates typed questions, private proof and faculty review.',scope:'college',department:'',club:'',state:'published',canManage:true,responseCount:0,requireProof:false,requireRegistration:false,checkIn:false,geofence:null,opensAt:null,closesAt:null,fields:[{id:'experience',label:'How was the workshop?',type:'radio',required:true,choices:['Loved it','Good','Room to improve']},{id:'takeaway',label:'What is one thing you will take with you?',type:'textarea',required:true,choices:[]},{id:'next',label:'What would you like to explore next?',type:'checkbox',required:false,choices:['Creative coding','Design systems','Building with AI']}]},{id:'demo-info',demo:true,title:'Find your project team.',description:'Tell the student innovation team what you are interested in. Sample answers stay in this browser.',scope:'college',department:'',club:'',state:'published',canManage:true,responseCount:0,requireProof:false,fields:[{id:'name',label:'Your display name',type:'text',required:true,choices:[]},{id:'interest',label:'Your area of interest',type:'select',required:true,choices:['Software','Robotics','Design','Research']},{id:'note',label:'What would you like to build?',type:'textarea',required:false,choices:[]}]}];
}
const DEMO_KEY='veltech-ams-mini:forms:demo:v14';
export function readSampleForms() {try{const value=JSON.parse(localStorage.getItem(DEMO_KEY));if(value?.version===1 && Array.isArray(value.forms) && value.forms.length<=50)return value.forms;}catch{}return createSampleForms();}
export function saveSampleForms(forms){localStorage.setItem(DEMO_KEY,JSON.stringify({version:1,forms:forms.slice(0,50)}));window.dispatchEvent(new Event('campus-demo-forms'));}
