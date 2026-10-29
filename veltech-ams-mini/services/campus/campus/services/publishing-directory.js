import User from '../../models/User.js';
import Event from '../../models/Event.js';
import {Notice} from '../models.js';
import {CampusForm} from '../form-models.js';
import {Schedule} from '../models/schedules.js';
import {FacultyExam} from '../models/faculty-exams.js';
import {ExamPlan} from '../models/exam-plans.js';
import {AcademicCalendarEntry} from '../models/academic-calendar.js';
import {PublishingDirectory} from '../models/publishing-directory.js';
import {departmentKey,baseDepartmentKey,sameDepartment,scopeKey,configurePublishingAliases,configurePublishingClubs,clubKey,knownDepartmentOptions,resolveScope} from '../../../../shared/publishing-directory.mjs';
import {hasAdminAction} from '../../../../shared/admin-access.mjs';
import {fail} from '../security.js';
export const canManagePublishingDirectory=user=>user?.role==='admin' && hasAdminAction(user,'accounts','update');
const safeText=value=>typeof value==='string' && value.trim() && value.length<=120 && !/[\u0000-\u001f\u007f]/.test(value);
export async function publishingOptions(user){
 const saved=await PublishingDirectory.findOne({key:'campus'}).lean();
 configurePublishingAliases(saved?.departments || []);configurePublishingClubs(saved?.clubs || []);
 const [departmentLists,clubLists]=await Promise.all([
  Promise.all([User,Event,Notice,CampusForm,Schedule,FacultyExam,ExamPlan,AcademicCalendarEntry].map(model=>model.distinct('department',{department:{$type:'string',$nin:['','*']}}))),
  Promise.all([User,Event,CampusForm].map(model=>model.aggregate([{$match:{club:{$type:'string',$nin:['']},department:{$type:'string',$nin:['']}}},{$group:{_id:{club:'$club',department:'$department'}}},{$limit:500}]))),
 ]);
 const departments=new Map(knownDepartmentOptions().map(row=>[row.value,row]));
 for(const row of saved?.departments || [])departments.set(departmentKey(row.value),{value:row.value,label:row.label,aliases:[...row.aliases]});
 for(const name of departmentLists.flat().filter(safeText).slice(0,2000)){
  const key=departmentKey(name),existing=departments.get(key);
  if(existing){if(!existing.aliases.includes(name) && existing.value!==name)existing.aliases.push(name);}
  else{const value=['CSE','ECE','EEE','MECH','CIVIL','IT'].includes(key)?key:name.trim();departments.set(key,{value,label:value,aliases:[name]});}
 }
 const values=[...departments.values()].sort((a,b)=>a.label.localeCompare(b.label));configurePublishingAliases(values);
 const clubs=new Map();
 for(const row of [...(saved?.clubs || []),...clubLists.flat().map(r=>({value:r._id.club,label:r._id.club,department:r._id.department}))]){
  if(!safeText(row.value) || !safeText(row.department))continue;
  const department=values.find(d=>sameDepartment(d.value,row.department))?.value || row.department,key=departmentKey(department)+':'+clubKey(row.value,department);
  if(!clubs.has(key))clubs.set(key,{value:row.value,label:row.label || row.value,department});
 }
 configurePublishingClubs([...clubs.values()]);
 return {departments:values,clubs:[...clubs.values()].sort((a,b)=>a.label.localeCompare(b.label)),canManage:canManagePublishingDirectory(user)};
}
export function validatePublishingCatalog(body){
 if(!body || typeof body!=='object' || Array.isArray(body) || Object.keys(body).some(k=>!['departments','clubs'].includes(k)) || !Array.isArray(body.departments) || body.departments.length>200 || !Array.isArray(body.clubs) || body.clubs.length>500)fail(400,'Provide up to 200 departments and 500 clubs.');
 const departments=body.departments.map(row=>{
  if(!row || Object.keys(row).some(k=>!['value','label','aliases'].includes(k)) || !safeText(row.value) || !safeText(row.label) || !Array.isArray(row.aliases) || row.aliases.length>30 || row.aliases.some(a=>!safeText(a)))fail(400,'Each department needs a value, label and up to 30 short aliases.');
  return {value:row.value.trim(),label:row.label.trim(),aliases:[...new Set(row.aliases.map(a=>a.trim()))]};
 });
 const claimed=new Map();
 for(const row of departments){const key=baseDepartmentKey(row.value);for(const alias of [row.value,row.label,...row.aliases]){const normalized=baseDepartmentKey(alias);if(claimed.has(normalized) && claimed.get(normalized)!==key || ['CSE','ECE','EEE','MECH','CIVIL','IT'].includes(normalized) && normalized!==key)fail(400,'Department aliases cannot overlap distinct departments.');claimed.set(normalized,key);}}
 const keys=departments.map(r=>baseDepartmentKey(r.value));if(new Set(keys).size!==keys.length)fail(400,'Choose one entry for each department alias group.');
 const clubs=body.clubs.map(row=>{
  if(!row || Object.keys(row).some(k=>!['value','label','department'].includes(k)) || !safeText(row.value) || !safeText(row.label) || !safeText(row.department))fail(400,'Each club needs a value, label and department.');
  const matches=departments.filter(d=>[d.value,d.label,...d.aliases].some(name=>baseDepartmentKey(name)===baseDepartmentKey(row.department)));if(matches.length!==1)fail(400,'Every club must belong to one known department.');
  return {value:row.value.trim(),label:row.label.trim(),department:matches[0].value};
 });
 if(new Set(clubs.map(r=>departmentKey(r.department)+':'+scopeKey(r.value))).size!==clubs.length)fail(400,'Choose one entry for each club within its department.');
 return {departments,clubs};
}
export async function normalizePublishingScope(body,user,{allowBlank=true}={}){
 const options=await publishingOptions(user);
 return normalizeWithOptions(body,user,options,{allowBlank});
}
function normalizeWithOptions(body,user,options,{allowBlank=true}={}){
 const out={...body};
 if(Object.hasOwn(out,'department')){
  if(typeof out.department!=='string' || out.department.length>120)fail(400,'Choose a valid known department.');
  if(!out.department.trim()){if(!allowBlank)fail(400,'Choose a known department.');out.department='';}
  else{
   const result=resolveScope(out.department,options.departments);if(result.status!=='resolved')fail(400,`Choose a known department${result.suggestions.length?`: ${result.suggestions.map(r=>r.label).join(', ')}`:'. Ask an account administrator to add it.'}`);
   out.department=user?.role!=='admin' && sameDepartment(result.value,user?.department)?user.department.trim():result.value;
  }
 }
 if(out.scope==='club' || Object.hasOwn(out,'club') && out.club){
  if(typeof out.club!=='string' || out.club.length>120 || !out.department)fail(400,'Choose a known club and its department.');
  const result=resolveScope(out.club,options.clubs,{kind:'club',department:out.department});if(result.status!=='resolved')fail(400,'Choose a known club in the selected department.');out.club=result.value;
 }
 if(Array.isArray(out.rows))out.rows=out.rows.map(row=>row && Object.hasOwn(row,'department') && row.department?{...row,...normalizeWithOptions({department:row.department},user,options,{allowBlank})}:row);
 return out;
}
export async function resolvePublishingValue(kind,value,{user,department,allowBlank=true}={}){const out=await normalizePublishingScope(kind==='club'?{department,club:value}:{department:value},user,{allowBlank});return kind==='club'?out.club:out.department;}

let aliasLoadedAt=0,aliasLoading=null;
export async function loadPublishingAliases(){if(Date.now()-aliasLoadedAt<15000)return;if(!aliasLoading)aliasLoading=PublishingDirectory.findOne({key:'campus'}).lean().then(row=>{configurePublishingAliases(row?.departments || []);configurePublishingClubs(row?.clubs || []);aliasLoadedAt=Date.now();}).finally(()=>{aliasLoading=null;});await aliasLoading;}
