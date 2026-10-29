import {visibleAcademicRows} from './academic-source.js';
const encoder=new TextEncoder(),decoder=new TextDecoder(),STORE='snapshots',DB='unievecampus:private:v1';
const text=value=>typeof value==='string'?value.slice(0,180):typeof value==='number' && Number.isFinite(value)?value:null;
const select=(item,keys)=>Object.fromEntries(keys.filter(key=>text(item?.[key])!==null).map(key=>[key,text(item[key])]));
export const offlineSections={
 subjects:{label:'Attendance totals',fields:{code:'Course code',name:'Subject',present:'Present',total:'Recorded classes',percentage:'Attendance %'}},
 records:{label:'Daily attendance',fields:{subjectCode:'Course code',subjectName:'Subject',date:'Date',period:'Period',startTime:'Start',endTime:'End',status:'Attendance'}},
 timetable:{label:'Timetable',fields:{subjectCode:'Course code',subjectName:'Subject',day:'Day',period:'Period',startTime:'Start',endTime:'End',room:'Room',faculty:'Faculty'}},
 courses:{label:'Registered courses',fields:{code:'Course code',name:'Course',credits:'Credits',category:'Category',faculty:'Faculty',slot:'Slot',room:'Room'}},
 results:{label:'Results & grades',fields:{courseCode:'Course code',courseName:'Course',semester:'Semester',grade:'Grade',credits:'Credits',gradePoints:'Grade points',gpa:'Reported GPA',cgpa:'Reported CGPA',status:'Status'}},
 examinations:{label:'Examinations',fields:{name:'Examination',courseCode:'Course code',courseName:'Course',date:'Date',time:'Time',room:'Room'}}
};
export const defaultOfflineSections=Object.keys(offlineSections);
export function createDeviceSnapshot(data,mode,selectedSections=defaultOfflineSections) {
 const selected=defaultOfflineSections.filter(key=>Array.isArray(selectedSections) && selectedSections.includes(key));
 const lists=(items,keys,limit)=>Array.isArray(items)?items.slice(0,limit).map(item=>select(item,keys)).filter(item=>Object.keys(item).length):[];
 const sourceKeys=['source','sourceUpdatedAt'];
 const snapshot={version:3,source:mode==='demo'?'Fictional demo':'Saved connected academic data',selectedSections:selected,academic:{},lastSyncedAt:data.lastSyncedAt || null};
 for(const key of selected){
  const fields=Object.keys(offlineSections[key].fields),items=['courses','results','examinations'].includes(key)?visibleAcademicRows(data.academic,key,mode):key==='timetable'?(data.timetable?.length?data.timetable:data.classes):data[key];
  const rows=lists(items,[...fields,...sourceKeys,...(key==='subjects'?['percent']:[]),...(key==='results'?['gradePoint']:[])],key==='records'?20000:2000).map(item=>{
   if(key==='subjects'){const reported=item.percent ?? item.percentage,percentage=reported ?? (item.total>0 && item.present>=0 && item.present<=item.total?Math.round(item.present/item.total*1000)/10:null);delete item.percent;return {...item,...(percentage!==null?{percentage}:{})};}
   if(key==='results' && item.gradePoints===undefined && item.gradePoint!==undefined){item.gradePoints=item.gradePoint;delete item.gradePoint;}
   return item;
  });
  if(['courses','results','examinations'].includes(key))snapshot.academic[key]=rows;else snapshot[key]=rows;
 }
 return snapshot;
}

const encode=bytes=>btoa(Array.from(new Uint8Array(bytes),byte=>String.fromCharCode(byte)).join(''));
const decode=value=>Uint8Array.from(atob(value),char=>char.charCodeAt(0));
const aad=envelope=>encoder.encode(JSON.stringify({version:1,createdAt:envelope.createdAt,expiresAt:envelope.expiresAt}));
async function keyFor(passphrase,salt) {
 if(typeof passphrase!=='string' || passphrase.length<10 || passphrase.length>200)throw new Error('Use a device passphrase with 10–200 characters.');
 const material=await crypto.subtle.importKey('raw',encoder.encode(passphrase),'PBKDF2',false,['deriveKey']);
 return crypto.subtle.deriveKey({name:'PBKDF2',salt,iterations:210000,hash:'SHA-256'},material,{name:'AES-GCM',length:256},false,['encrypt','decrypt']);
}
export async function sealSnapshot(snapshot,passphrase,days=1,now=Date.now()) {
 if(!crypto?.subtle)throw new Error('Encrypted device storage requires HTTPS or localhost.');
 const salt=crypto.getRandomValues(new Uint8Array(16)),iv=crypto.getRandomValues(new Uint8Array(12));
 const envelope={version:1,createdAt:now,expiresAt:now+([1,7].includes(days)?days:1)*86400000,salt:encode(salt),iv:encode(iv)};
 const ciphertext=await crypto.subtle.encrypt({name:'AES-GCM',iv,additionalData:aad(envelope)},await keyFor(passphrase,salt),encoder.encode(JSON.stringify(snapshot)));
 return {...envelope,ciphertext:encode(ciphertext)};
}
export async function openSnapshot(envelope,passphrase,now=Date.now()) {
 if(envelope?.version!==1 || !Number.isFinite(envelope.expiresAt) || now>=envelope.expiresAt)throw new Error('This device snapshot has expired. Remove it and save a fresh snapshot.');
 try {return JSON.parse(decoder.decode(await crypto.subtle.decrypt({name:'AES-GCM',iv:decode(envelope.iv),additionalData:aad(envelope)},await keyFor(passphrase,decode(envelope.salt)),decode(envelope.ciphertext))));}
 catch {throw new Error('Could not unlock the snapshot. Check your passphrase; altered data cannot be unlocked.');}
}
async function database() {return new Promise((resolve,reject)=>{const request=indexedDB.open(DB,1);request.onupgradeneeded=()=>request.result.createObjectStore(STORE);request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(new Error('This browser could not open encrypted device storage.'));});}
async function transact(action,value) {
 const db=await database();return new Promise((resolve,reject)=>{const transaction=db.transaction(STORE,action==='get'?'readonly':'readwrite'),store=transaction.objectStore(STORE);const request=action==='get'?store.get('current'):action==='put'?store.put(value,'current'):store.delete('current');let result;request.onsuccess=()=>{result=request.result;};transaction.oncomplete=()=>{db.close();resolve(result);};transaction.onerror=()=>{db.close();reject(new Error(transaction.error?.name==='QuotaExceededError'?'Device storage is full. Remove an older snapshot or free browser space, then retry.':'Device storage failed. Check browser storage permissions and free space.'));};});
}
export const readDeviceSnapshot=()=>transact('get');
export const saveDeviceSnapshot=envelope=>transact('put',envelope);
export const clearDeviceSnapshot=()=>transact('delete');
