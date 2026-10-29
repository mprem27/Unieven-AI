import {AcademicLink} from '../models.js';
import {decryptToken} from '../security.js';
import {academicLinks} from './academic-links.js';
export const courseKey=value=>String(value || '').toUpperCase().replace(/[^A-Z0-9]/g,'');
export {departmentKey} from '../../../../shared/publishing-directory.mjs';
import {departmentKey} from '../../../../shared/publishing-directory.mjs';
function semesterKey(value){const s=String(value || '').toUpperCase().replace(/SEMESTER|SEM|\s|[.:-]/g,'');return ({I:'1',II:'2',III:'3',IV:'4',V:'5',VI:'6',VII:'7',VIII:'8',IX:'9',X:'10'})[s] || s.replace(/^0+(?=\d)/,'');}
export const fieldKey=(value,key)=>key==='semester'?semesterKey(value):String(value || '').toUpperCase().replace(key==='section'?/SECTION|\s|[.:-]/g:/\s/g,'');
const inFlight=new WeakMap();
export async function studentExamAudience(user,config){
 if(user?.role!=='student')return {verified:false,department:user?.department || '',courseCodes:[],reason:'Student academic records are required.'};
 let pending=inFlight.get(config);if(!pending){pending=new Map();inFlight.set(config,pending);}const id=String(user._id);
 if(pending.has(id))return pending.get(id);
 const task=(async()=>{
  const empty={verified:false,department:'',courseCodes:[],reason:'Connect your own AMS account to load registered courses.'};
  try{
   const link=await AcademicLink.findOne({user:user._id}).select('+sealedToken');if(!link)return empty;
   const snapshot=!link.managed && !link.email?await config.academic.request(decryptToken(link.sealedToken,config.linkKey),'/campus/snapshot'):await academicLinks(config).read(user,'/campus/snapshot');
   const principal=snapshot?.identity?.verifiedAt && /^VTU\d{3,12}$/i.test(snapshot.identity.verifiedPrincipal || '')?snapshot.identity.verifiedPrincipal.toUpperCase():'';
   if(!principal || user.portalPrincipalVerifiedAt && principal!==String(user.portalPrincipal || '').toUpperCase())return empty;
   const official=snapshot.officialAcademic?.source==='ams'?snapshot.officialAcademic:null,profile=official?.profile || {},courses=Array.isArray(official?.courses)?official.courses:[];
   const codes=[...new Set(courses.filter(row=>!/(?:withdraw|cancel|dropped|not registered|rejected)/i.test(row.status || '')).map(row=>courseKey(row.courseCode || row.code || row.subjectCode)).filter(Boolean))];
   return {verified:true,vtuNumber:principal,officialName:typeof profile.name==='string'?profile.name:'',department:profile.branch || profile.department || '',semester:profile.semester || '',section:profile.section || '',batch:profile.batch || profile.admissionBatch || '',regulation:profile.regulation || '',courseCodes:codes,reason:codes.length?'':'Registered courses are not available. Sync your academic records to match examinations.'};
  }catch{return empty;}
 })();pending.set(id,task);try{return await task;}finally{if(pending.get(id)===task)pending.delete(id);}
}
export function matchesPublicationAudience(exam,audience){
 if(!audience?.verified && ['department','semester','section','batch','regulation'].some(k=>exam[k] && exam[k]!=='*'))return false;
 if(exam.department && exam.department!=='*' && (!audience.department || departmentKey(exam.department)!==departmentKey(audience.department)))return false;
 for(const key of ['semester','section','batch','regulation'])if(exam[key] && (!audience[key] || fieldKey(exam[key],key)!==fieldKey(audience[key],key)))return false;
 return true;
}
export function matchesExamAudience(exam,audience){return !!audience?.verified && audience.courseCodes?.includes(courseKey(exam.courseCode)) && matchesPublicationAudience(exam,audience);}
