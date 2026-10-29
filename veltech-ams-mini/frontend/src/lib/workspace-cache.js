// Convenience encryption protects browser storage at rest. Same-origin scripts
// can use this device key; it is deliberately not a replacement for sign-in.
const DB='veltech-ams-mini:workspace:v1',STORE='private',LOGOUT='veltech-ams-mini:local-logout:v1';
const MAX_AGE=86400000,MAX_BYTES=4*1024*1024,encoder=new TextEncoder(),decoder=new TextDecoder();
let generation=0,verifiedOwner='',queue=Promise.resolve();
const profileFields=new Set('id name email studentId vtuNumber rollNumber degree branch department campusDepartment semester section batch programme program course regulation academicYear amsEmail institutionalEmail'.split(' '));
const fields=new Set(('id _id name title label value code kind type status source sourceUpdatedAt updatedAt createdAt publishedAt validFrom validTo date dateText day period time startTime endTime room hall seat reportingTime instructions notes vtuNumber courseCode courseName subjectCode subjectName faculty facultyName facultyId slot category credits earnedCredits registeredCredits totalCredits grade gradePoint gradePoints gpa cgpa semester section department batch regulation resultType attempt examType academicYear examName examDate academicTerm examination examinationType present total percentage percent start end location reason mode scope followDay studentIds classes exam ownSeat document documents examinations scheduleDocuments schedules seating entries identityAvailable message url fileUrl downloadUrl downloadPath fileId filename fileName mime mimeType size reference amount sourceFile fileName contentType sourceLabel sourceName description departmentLabel semesterLabel testMark1 testMark2 testMark3 midTestMark1 midTestMark2 labMark assignmentMark internalMark externalMark totalMark maximumMark marks maxMarks creditsEarned creditsRequired creditType creditCategory categoryCode categoryName bucket resultSummary creditSummary gradeScale courses results fees sourceModules sourceDetails modules retained lastSuccessAt lastAttemptAt recordCount discovered available supported overall totalEarned totalRequired cumulative semesterGpa cumulativeGpa').split(' '));
const resourcePaths=new Set(['/academics/faculty-exams','/academics/exam-seating','/academics/campus-documents','/schedules','/timetable-rooms']);
for(const field of 'sourceReport examinationSession sgpa overallPercentage totalGrade totalGradePoints totalCreditPoints totalMarks division year credit points requiredCredits creditPoints rowType sourceColumns downloadId sourceRoom amsRoom roomSource roomOverrideId sectionSources syncStatus state publishedBy sourceUrl retainedAt file'.split(' '))fields.add(field);
const assessmentFields=new Set('testMark1 testMark2 testMark3 midTestMark1 midTestMark2 labMark assignmentMark internalMark'.split(' '));
const assessmentMaxima=new Set([...assessmentFields].flatMap(field=>[`${field}Max`,`${field}Maximum`]));
for(const field of assessmentMaxima)fields.add(field);
fields.add('markMaximums');
// Source maxima accept a bounded scalar vocabulary. Never copy arbitrary
// nested data or URL/token text through a newly supported metadata field.
function cleanMaximum(value){
 if(value===null || value===undefined)return null;
 if(typeof value==='number')return Number.isFinite(value) && value>=0?value:'Unavailable';
 if(typeof value!=='string' || value.length>64)return 'Unavailable';
 const text=value.trim();return /^(?:\d+(?:\.\d+)?|[-–—]|N\/?A|Not (?:published|provided|updated)|Unavailable|Unknown|Absent|AB)$/i.test(text)?text:'Unavailable';
}
function cleanMaximumMap(value){
 if(!value || typeof value!=='object' || Array.isArray(value))return null;
 return Object.fromEntries([...assessmentFields].filter(field=>Object.hasOwn(value,field)).map(field=>[field,cleanMaximum(value[field])]));
}
export const isWorkspaceResource=path=>typeof path==='string' && (resourcePaths.has(path) || /^\/academic-calendar\?from=\d{4}-\d{2}-\d{2}&to=\d{4}-\d{2}-\d{2}$/.test(path));
function clean(value,allowed=fields,depth=0){
 if(depth>9 || value===null)return null;
 if(typeof value==='string')return value.slice(0,4000);
 if(typeof value==='boolean' || typeof value==='number' && Number.isFinite(value))return value;
 if(Array.isArray(value))return value.slice(0,20000).map(item=>clean(item,allowed,depth+1));
 if(!value || typeof value!=='object')return null;
 return Object.fromEntries(Object.entries(value).filter(([key])=>allowed.has(key)).map(([key,item])=>[key,assessmentMaxima.has(key)?cleanMaximum(item):key==='markMaximums'?cleanMaximumMap(item):(/url|path/i.test(key) && typeof item==='string' && /[?&](?:token|key|auth|session|password|csrf)[^=]*=/i.test(item))?null:clean(item,fields,depth+1)]));
}
export function workspaceSnapshot(data,owner){
 const profile=clean(data.profile,profileFields);
 return {profile:{...profile,officialProfile:clean(data.profile?.officialProfile || data.profile,profileFields),id:owner,accountRole:'student',campusRole:'student'},subjects:clean(data.subjects || []),records:clean(data.records || []),timetable:clean(data.timetable || []),academic:clean(data.academic || {}),calendarPolicies:clean(data.calendarPolicies || []),roomOverrides:clean(data.roomOverrides || []),lastSyncedAt:typeof data.lastSyncedAt==='string'?data.lastSyncedAt:null,academicReady:true};
}
function database(){
 if(!globalThis.indexedDB || !globalThis.crypto?.subtle)return Promise.resolve(null);
 return new Promise((resolve,reject)=>{const request=indexedDB.open(DB,1);request.onupgradeneeded=()=>request.result.createObjectStore(STORE);request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);});
}
async function transaction(action,key,value){
 const db=await database();if(!db)return null;
 return new Promise((resolve,reject)=>{const tx=db.transaction(STORE,action==='get'?'readonly':'readwrite'),store=tx.objectStore(STORE),request=action==='get'?store.get(key):action==='put'?store.put(value,key):store.clear();let result;
  request.onsuccess=()=>{result=request.result;};tx.oncomplete=()=>{db.close();resolve(result);};tx.onerror=()=>{db.close();reject(tx.error);};tx.onabort=tx.onerror;
 });
}
const enqueue=operation=>{const result=queue.then(operation);queue=result.catch(()=>{});return result;};
const aad=entry=>encoder.encode(JSON.stringify([1,entry.owner,entry.path,entry.expiresAt]));
async function deviceKey(){let key=await transaction('get','key');if(!key){key=await crypto.subtle.generateKey({name:'AES-GCM',length:256},false,['encrypt','decrypt']);await transaction('put','key',key);}return key;}
async function seal(owner,path,value,expiresAt){
 const bytes=encoder.encode(JSON.stringify(value));if(bytes.length>MAX_BYTES)throw new Error('Workspace exceeds the device cache limit.');
 const entry={version:1,owner,path,expiresAt,iv:crypto.getRandomValues(new Uint8Array(12))};
 entry.ciphertext=await crypto.subtle.encrypt({name:'AES-GCM',iv:entry.iv,additionalData:aad(entry)},await deviceKey(),bytes);return entry;
}
async function open(entry,owner,path,now){
 if(!entry || entry.version!==1 || entry.owner!==owner || entry.path!==path || !Number.isFinite(entry.expiresAt) || entry.expiresAt<=now || entry.expiresAt>now+MAX_AGE)return null;
 const key=await transaction('get','key');if(!key)return null;
 try{return JSON.parse(decoder.decode(await crypto.subtle.decrypt({name:'AES-GCM',iv:entry.iv,additionalData:aad(entry)},key,entry.ciphertext)));}catch{return null;}
}
export function hasLocalLogout(){try{return ['1','done'].includes(localStorage.getItem(LOGOUT));}catch{return false;}}
export function hasPendingServerLogout(){try{return localStorage.getItem(LOGOUT)==='1';}catch{return false;}}
export function finishLocalLogout(){try{localStorage.setItem(LOGOUT,'done');}catch{}}
export function clearLocalLogout(){try{localStorage.removeItem(LOGOUT);}catch{}}
export function clearWorkspaceCache(){generation++;verifiedOwner='';return enqueue(()=>transaction('clear'));}
export function markLocalLogout(){try{localStorage.setItem(LOGOUT,'1');}catch{}return clearWorkspaceCache();}
export function rememberVerifiedWorkspace(owner,data,now=Date.now()){
 const started=generation;
 return enqueue(async()=>{
  if(started!==generation || hasLocalLogout() || !owner || data.profile?.id!==owner || (data.profile.accountRole || 'student')!=='student' || !globalThis.indexedDB || !globalThis.crypto?.subtle)return false;
  const previous=await transaction('get','remembered');if(previous?.owner!==owner)await transaction('clear');
  const expiresAt=now+MAX_AGE,entry=await seal(owner,'workspace',workspaceSnapshot(data,owner),expiresAt);
  if(started!==generation || hasLocalLogout())return false;
  await transaction('put','workspace',entry);await transaction('put','remembered',{owner,expiresAt});verifiedOwner=owner;return true;
 });
}
export function saveWorkspaceSnapshot(owner,data){
 const started=generation;
 return enqueue(async()=>{
  if(started!==generation || hasLocalLogout() || verifiedOwner!==owner)return false;
  const remembered=await transaction('get','remembered');if(remembered?.owner!==owner || remembered.expiresAt<=Date.now())return false;
  const entry=await seal(owner,'workspace',workspaceSnapshot(data,owner),remembered.expiresAt);
  if(started!==generation || hasLocalLogout())return false;
  await transaction('put','workspace',entry);return true;
 });
}
export async function readRememberedWorkspace(now=Date.now()){
 const started=generation;await queue;if(hasLocalLogout())return null;
 try{
  const remembered=await transaction('get','remembered');if(!remembered || remembered.expiresAt<=now){if(remembered)await clearWorkspaceCache();return null;}
  const data=await open(await transaction('get','workspace'),remembered.owner,'workspace',now);
  return started===generation && !hasLocalLogout() && data?{owner:remembered.owner,data,expiresAt:remembered.expiresAt}:null;
 }catch{return null;}
}
export function saveWorkspaceResource(owner,path,value){
 const started=generation;
 return enqueue(async()=>{
  if(!isWorkspaceResource(path) || started!==generation || hasLocalLogout() || verifiedOwner!==owner)return false;
  const remembered=await transaction('get','remembered');if(remembered?.owner!==owner || remembered.expiresAt<=Date.now())return false;
  const entry=await seal(owner,path,clean(value),remembered.expiresAt);if(started!==generation || hasLocalLogout())return false;
  await transaction('put','resource:'+path,entry);return true;
 });
}
export async function readWorkspaceResource(owner,path,now=Date.now()){
 const started=generation;await queue;if(!isWorkspaceResource(path) || hasLocalLogout())return null;
 try{
  const remembered=await transaction('get','remembered');if(remembered?.owner!==owner || remembered.expiresAt<=now)return null;
  const value=await open(await transaction('get','resource:'+path),owner,path,now);return started===generation && !hasLocalLogout()?value:null;
 }catch{return null;}
}
