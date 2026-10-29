import {sameDepartment} from '../../../../shared/publishing-directory.mjs';
import {campusRole,canCreateEvent} from '../policy.js';
import {canCreateForm} from '../services/form-policy.js';
import {PublishingDirectory} from '../models/publishing-directory.js';
import {Audit} from '../models.js';
import {publishingOptions,canManagePublishingDirectory,validatePublishingCatalog,normalizePublishingScope,loadPublishingAliases} from '../services/publishing-directory.js';
import {fail} from '../security.js';
// This runs after sessionMiddleware; it deliberately excludes AMS identity,
// credentials, response answers, registration details and source import routes.
export async function publishingScopeGuard(req,_res,next){
 if(req.user)await loadPublishingAliases();
 if(!req.user || !['POST','PATCH','PUT'].includes(req.method) || !req.body || typeof req.body!=='object' || Array.isArray(req.body))return next();
 const path=req.path.replace(/\/+$/,'');
 if(!/^(?:\/events(?:\/[a-f0-9]{24})?|\/forms(?:\/[a-f0-9]{24})?|\/notices(?:\/[a-f0-9]{24})?|\/schedules(?:\/[a-f0-9]{24})?|\/faculty-exams(?:\/[a-f0-9]{24})?|\/exam-plans(?:\/[a-f0-9]{24})?|\/academic-calendar(?:\/[a-f0-9]{24})?|\/management\/users(?:\/[a-f0-9]{24})?|\/campus-documents(?:\/[a-f0-9]{24})?)$/i.test(path))return next();
 const user=req.user,body=req.body,role=campusRole(user);
 if(role!=='admin'){
  if(path.startsWith('/management/users'))fail(403,'Administrator access required.');
  if(/^\/(?:schedules|faculty-exams|exam-plans|campus-documents)(?:\/|$)/.test(path)){
   if(!user.department?.trim() || user.role!=='faculty' && role!=='department_coordinator')fail(403,'An assigned academic staff role is required.');
   if(body.department && !sameDepartment(body.department,user.department) || Array.isArray(body.rows) && body.rows.some(row=>row?.department && !sameDepartment(row.department,user.department)))fail(403,'Publish only for your assigned department.');
  }
  if(path.startsWith('/academic-calendar')){
   if(role!=='department_coordinator' || !user.department?.trim() || body.scope==='college' || body.department && !sameDepartment(body.department,user.department))fail(403,'Use your assigned academic department.');
  }
  if(path.startsWith('/events') && body.scope && !canCreateEvent(user,body))fail(403,'Your role cannot publish in this event scope.');
  if(path.startsWith('/forms') && body.scope && !canCreateForm(user,body))fail(403,'Faculty access to this form scope is required.');
  if(path.startsWith('/notices') && (!['department_coordinator','college_event_manager','placement_officer'].includes(role) || role==='department_coordinator' && !sameDepartment(body.department,user.department)))fail(403,'Staff access to this notice scope is required.');
 }
 if(Object.hasOwn(body,'department') || Object.hasOwn(body,'club') || Array.isArray(body.rows))req.body=await normalizePublishingScope(body,user);
 next();
}
export function registerPublishingOptions(router,config){
 router.get('/publishing-options',config.auth,async(req,res)=>res.json(await publishingOptions(req.user)));
 router.post('/publishing-options',config.auth,async(req,res)=>{
  if(!canManagePublishingDirectory(req.user))fail(403,'Account update permission is required to manage publishing choices.');
  const fields=validatePublishingCatalog(req.body);
  await PublishingDirectory.findOneAndUpdate({key:'campus'},{$set:{...fields,updatedBy:req.user._id}},{upsert:true,returnDocument:'after',runValidators:true});
  await Audit.create({actor:req.user._id,action:'publishing-directory.update',target:'campus',details:`${fields.departments.length} departments; ${fields.clubs.length} clubs`});
  res.json(await publishingOptions(req.user));
 });
}
