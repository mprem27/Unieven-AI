import {departmentQuery} from '../../../../shared/publishing-directory.mjs';
import {assertNoPublishedExamCollision,withExamPublicationLock} from '../services/exam-collisions.js';
import multer from 'multer';
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import {ExamPlan} from '../models/exam-plans.js';
import {FacultyExam} from '../models/faculty-exams.js';
import {Audit} from '../models.js';
import {campusRole} from '../policy.js';
import {canPublishExams} from './faculty-exams.js';
import {requireAdminAction} from '../services/admin-access.js';
import {studentExamAudience,matchesExamAudience,courseKey,departmentKey,fieldKey} from '../services/exam-audience.js';
import {examView} from '../services/exam-publications.js';
import {fail,validateId} from '../security.js';
const metadata={title:160,examType:80,academicYear:40,term:80,department:120,regulation:40,batch:40,semester:30,section:30,instructions:3000};
const fields={key:80,courseCode:40,courseName:180,date:10,startTime:5,endTime:5,department:120,semester:30,section:30,regulation:40,batch:40,room:120,notes:3000};
function text(raw,max){if(typeof raw!=='string' || raw.length>max || /[\x00-\x08\x0b\x0c\x0e-\x1f]/.test(raw))fail(400,'A schedule field is invalid or too long.');return raw.trim();}
function validDate(value){const d=new Date(value+'T12:00:00Z');return /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(+d) && d.toISOString().slice(0,10)===value;}
function audienceOverlaps(a,b){return ['department','semester','section','regulation','batch'].every(k=>!a[k] || !b[k] || (k==='department'?departmentKey(a[k])===departmentKey(b[k]):fieldKey(a[k],k)===fieldKey(b[k],k)));}
export function scheduleInput(body,user,{strict=false}={}){
 if(!body || typeof body!=='object' || Array.isArray(body) || Object.keys(body).some(k=>!Object.hasOwn(metadata,k) && !['rows','revision'].includes(k)))fail(400,'Use the supported schedule fields.');
 const out=Object.fromEntries(Object.entries(metadata).map(([k,n])=>[k,text(body[k] ?? '',n)]));
 if(campusRole(user)!=='admin'){
  if(out.department && departmentKey(out.department)!==departmentKey(user.department))fail(403,'Publish schedules only for your assigned department.');
  out.department=user.department.trim();
 }
 if(!Array.isArray(body.rows ?? []) || (body.rows || []).length>500)fail(400,'Use at most 500 examination rows per schedule. Split larger publications by school or term.');
 out.rows=(body.rows || []).map((r,i)=>{
  if(!r || typeof r!=='object' || Array.isArray(r) || Object.keys(r).some(k=>!Object.hasOwn(fields,k)))fail(400,`Row ${i+1}: use supported examination fields.`);
  const v=Object.fromEntries(Object.entries(fields).map(([k,n])=>[k,text(r[k] ?? '',n)]));v.key=v.key || crypto.randomUUID();
  if(out.department && v.department && departmentKey(v.department)!==departmentKey(out.department))fail(400,`Row ${i+1}: department must match this schedule's audience.`);
  for(const k of ['semester','section','regulation','batch'])if(out[k] && v[k] && fieldKey(out[k],k)!==fieldKey(v[k],k))fail(400,`Row ${i+1}: ${k} must match this schedule's audience.`);
  if(strict){if(!/^[A-Za-z0-9][A-Za-z0-9._/-]{1,39}$/.test(v.courseCode) || !v.courseName || !validDate(v.date))fail(400,`Row ${i+1}: check the exact course code, name and calendar date.`);
   if(!/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(v.startTime) || !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(v.endTime) || v.endTime<=v.startTime)fail(400,`Row ${i+1}: enter a valid start and end time in IST.`);
  }return v;
 });
 if(strict){if(!out.title || !out.examType || !out.academicYear || !out.term || !out.rows.length)fail(400,'Enter a title, exam type, academic year, term and at least one examination.');
  for(let i=0;i<out.rows.length;i++)for(let j=0;j<i;j++){const a=out.rows[i],b=out.rows[j];if(courseKey(a.courseCode)===courseKey(b.courseCode) && a.date===b.date && a.startTime<b.endTime && a.endTime>b.startTime && audienceOverlaps(a,b))fail(400,`Rows ${j+1} and ${i+1}: overlapping sessions for the same course and audience.`);}
 }return out;
}
function staffScope(user,action='view'){
 if(!canPublishExams(user))fail(403,'An active academic staff assignment is required.');
 if(campusRole(user)==='admin'){requireAdminAction(user,'examinations',action);return {};}
 return {department:departmentQuery(user.department),...(user.role==='faculty' && campusRole(user)!=='department_coordinator'?{createdBy:user._id}:{})};
}
const docView=(doc,id)=>doc?.name?{name:doc.name,mime:doc.mime,size:doc.size,url:`/api/campus/exam-plans/${id}/document`}:null;
export function planView(plan,{detail=false,publishedExaminations=[]}={}){
 const id=String(plan._id),dates=(plan.rows || []).map(r=>r.date).filter(Boolean).sort();
 return {id,...Object.fromEntries(Object.keys(metadata).map(k=>[k,plan[k] || ''])),revision:plan.revision,publishedRevision:plan.publishedRevision,status:plan.status,rowCount:plan.rows?.length || 0,startDate:dates[0] || '',endDate:dates.at(-1) || '',document:docView(plan.document,id),warnings:plan.warnings || [],publishedAt:plan.publishedAt,updatedAt:plan.updatedAt,createdByName:plan.createdByName,deletedAt:plan.deletedAt,...(detail?{rows:plan.rows || [],publishedExaminations}: {})};
}
export function registerExamPlans(router,config){
 const directory=path.resolve(path.join(config.mediaDirectory || process.env.CAMPUS_MEDIA_DIR || '.campus-media','private-exam-schedules'));
 const parser=multer({storage:multer.memoryStorage(),limits:{fileSize:8*1024*1024,files:1,fields:1,parts:2}}).single('file');
 const upload=(req,res,next)=>parser(req,res,error=>{if(error){error.status=error.code==='LIMIT_FILE_SIZE'?413:400;error.message='Upload one PDF, XLSX or CSV up to 8 MB.';}next(error);});
 async function managed(req,action='view'){const row=await ExamPlan.findOne({_id:validateId(req.params.id),...staffScope(req.user,action)}).select('+document.key +publishedDocument.key +jobToken');if(!row)fail(404,'Schedule not found in your assigned scope.');if(row.deletedAt && action!=='view')fail(409,'This schedule was removed. Its history is read-only.');return row;}
 async function details(plan){const rows=plan.publishedRevision!=null && plan.status==='published'?await FacultyExam.find({planId:plan._id,planRevision:plan.publishedRevision,isPublished:true}).sort({date:1,startTime:1}).lean():[];return planView(plan,{detail:true,publishedExaminations:rows.map(examView)});}
 router.get('/exam-plans',config.auth,async(req,res)=>{const rows=await ExamPlan.find({...staffScope(req.user),...(req.query.history==='true'?{}:{deletedAt:null})}).sort({updatedAt:-1}).limit(200).lean();res.json({plans:rows.map(p=>planView(p)),department:req.user.department || '',canChooseDepartment:campusRole(req.user)==='admin'});});
 router.post('/exam-plans',config.auth,async(req,res)=>{staffScope(req.user,'create');const value=scheduleInput(req.body,req.user),row=await ExamPlan.create({...value,createdBy:req.user._id,createdByName:req.user.name});await Audit.create({actor:req.user._id,action:'examination.schedule.draft',target:row.id,details:value.department || 'University-wide'});res.status(201).json({plan:await details(row)});});
 router.get('/exam-plans/:id',config.auth,async(req,res)=>res.json({plan:await details(await managed(req))}));
 router.put('/exam-plans/:id',config.auth,async(req,res)=>{
  const old=await managed(req,'update'),revision=req.body.revision;if(!Number.isInteger(revision) || revision!==old.revision)fail(409,'This schedule changed. Reload it before saving.');
  const value=scheduleInput({...Object.fromEntries(Object.keys(metadata).map(k=>[k,old[k] || ''])),rows:old.rows,...req.body},req.user),row=await ExamPlan.findOneAndUpdate({_id:old._id,revision,$or:[{lockedUntil:null},{lockedUntil:{$lte:new Date()}}]},{$set:value,$inc:{revision:1}},{returnDocument:'after',runValidators:true});if(!row)fail(409,'A schedule update is in progress. Reload and retry.');await Audit.create({actor:req.user._id,action:'examination.schedule.edit',target:row.id});res.json({plan:await details(row)});
 });
 router.post('/exam-plans/:id/import',config.auth,async(req,res,next)=>{await managed(req,'update');next();},upload,async(req,res)=>{
  const old=await managed(req,'update');if(req.body.revision!==undefined && String(old.revision)!==req.body.revision)fail(409,'This schedule changed. Reload it before importing.');if(!req.file)fail(400,'Choose a schedule document.');const name=path.basename(req.file.originalname).slice(0,180),ext=name.split('.').at(-1).toLowerCase();if(!['pdf','xlsx','csv'].includes(ext))fail(400,'Choose a PDF, XLSX or CSV schedule.');
  const parsed=await config.academic.internal('/campus/bridge/exams/parse',{filename:name,contentBase64:req.file.buffer.toString('base64')});if(!Array.isArray(parsed?.rows) || parsed.rows.length>500)fail(502,'The schedule parser returned an invalid preview.');
  const value=scheduleInput({...Object.fromEntries(Object.keys(metadata).map(k=>[k,old[k] || ''])),rows:parsed.rows},req.user),key=crypto.randomBytes(24).toString('hex'),mime={pdf:'application/pdf',xlsx:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',csv:'text/csv'}[ext],warnings=(parsed.warnings || []).map(v=>String(v).slice(0,500)).slice(0,40);
  await fs.mkdir(directory,{recursive:true,mode:0o700});await fs.writeFile(path.join(directory,key),req.file.buffer,{mode:0o600,flag:'wx'});let row;
  try{row=await ExamPlan.findOneAndUpdate({_id:old._id,revision:old.revision,$or:[{lockedUntil:null},{lockedUntil:{$lte:new Date()}}]},{$set:{rows:value.rows,document:{name,key,mime,size:req.file.size},warnings},$inc:{revision:1}},{returnDocument:'after'});if(!row)fail(409,'This schedule changed during import. Reload and import again.');}catch(e){await fs.unlink(path.join(directory,key)).catch(()=>{});throw e;}
  await Audit.create({actor:req.user._id,action:'examination.schedule.import',target:row.id,details:JSON.stringify({format:ext,rows:value.rows.length})});res.json({plan:await details(row),warnings});
 });
 router.post('/exam-plans/:id/publish',config.auth,async(req,res)=>{const result=await withExamPublicationLock(async checkpoint=>{
  const plan=await managed(req,'update'),revision=req.body.revision;if(req.body.reviewed!==true)fail(400,'Review all rows and confirm the publication before releasing it.');if(!Number.isInteger(revision) || revision!==plan.revision)fail(409,'This schedule changed. Reload it before publishing.');
  const value=scheduleInput({...Object.fromEntries(Object.keys(metadata).map(k=>[k,plan[k] || ''])),rows:plan.rows},req.user,{strict:true});
  if(plan.status==='published' && plan.publishedRevision===revision)return {plan:await details(plan)};
  const token=crypto.randomUUID(),now=new Date(),locked=await ExamPlan.findOneAndUpdate({_id:plan._id,revision,$or:[{lockedUntil:null},{lockedUntil:{$lte:now}}]},{$set:{jobToken:token,lockedUntil:new Date(+now+120000)}},{returnDocument:'after'});if(!locked)fail(409,'Another publication is in progress. Retry shortly.');
  try{
   const publicationRows=value.rows.map(r=>({...r,department:r.department || value.department || '*',semester:r.semester || value.semester,section:r.section || value.section,regulation:r.regulation || value.regulation,batch:r.batch || value.batch,title:value.title,notes:[r.notes,value.instructions].filter(Boolean).join('\n').slice(0,3000),publishedBy:req.user._id,publishedByName:req.user.name || 'Academic office',isPublished:true,planId:plan._id,planRevision:revision}));
   await assertNoPublishedExamCollision(publicationRows,{excludePlan:plan._id});await checkpoint();
   await FacultyExam.deleteMany({planId:plan._id,planRevision:revision});
   await FacultyExam.insertMany(publicationRows);await checkpoint();
   const changed=await ExamPlan.findOneAndUpdate({_id:plan._id,revision,jobToken:token,lockedUntil:{$gt:new Date()}},{$set:{status:'published',publishedRevision:revision,publishedTitle:value.title,publishedAt:new Date(),publishedDocument:plan.document || null}},{returnDocument:'after'});if(!changed)fail(409,'This schedule changed while publishing. Reload it.');
   await Audit.create({actor:req.user._id,action:'examination.schedule.publish',target:plan.id,details:JSON.stringify({revision,rows:value.rows.length,department:value.department || 'University-wide'})});return {plan:await details(changed)};
  }finally{await ExamPlan.updateOne({_id:plan._id,jobToken:token},{$unset:{jobToken:'',lockedUntil:''}});}
 });res.json(result);});
 router.post('/exam-plans/:id/withdraw',config.auth,async(req,res)=>{const plan=await managed(req,'delete');if(!Number.isInteger(req.body.revision) || plan.revision!==req.body.revision)fail(409,'This schedule changed. Reload it before withdrawing.');const row=await ExamPlan.findOneAndUpdate({_id:plan._id,revision:plan.revision,$or:[{lockedUntil:null},{lockedUntil:{$lte:new Date()}}]},{$set:{status:'withdrawn'},$inc:{revision:1}},{returnDocument:'after'});if(!row)fail(409,'Another publication is in progress. Retry withdrawal shortly.');await Audit.create({actor:req.user._id,action:'examination.schedule.withdraw',target:row.id});res.json({plan:await details(row)});});
 router.delete('/exam-plans/:id',config.auth,async(req,res)=>{const plan=await managed(req,'delete');if(!Number.isInteger(req.body.revision) || plan.revision!==req.body.revision)fail(409,'This schedule changed. Reload it before removing.');const row=await ExamPlan.findOneAndUpdate({_id:plan._id,revision:plan.revision,deletedAt:null,$or:[{lockedUntil:null},{lockedUntil:{$lte:new Date()}}]},{$set:{status:'withdrawn',deletedAt:new Date()},$inc:{revision:1}},{returnDocument:'after'});if(!row)fail(409,'Another publication is in progress. Retry removal shortly.');await Audit.create({actor:req.user._id,action:'examination.schedule.remove',target:row.id});res.json({plan:await details(row)});});
 router.get('/exam-plans/:id/document',config.auth,async(req,res)=>{
  const id=validateId(req.params.id);let plan,document;
  if(canPublishExams(req.user)){plan=await managed(req);document=plan.document;}
  else{plan=await ExamPlan.findOne({_id:id,status:'published'}).select('+publishedDocument.key');if(!plan)fail(404,'Published schedule document not found.');const audience=await studentExamAudience(req.user,config),rows=await FacultyExam.find({planId:plan._id,planRevision:plan.publishedRevision,isPublished:true}).lean();if(!rows.some(row=>matchesExamAudience(row,audience)))fail(404,'Published schedule document not found.');document=plan.publishedDocument;}
  if(!document || !/^[a-f0-9]{48}$/.test(document.key || ''))fail(404,'Schedule document not found.');const file=path.join(directory,document.key);let stat;try{stat=await fs.stat(file);}catch{fail(404,'Schedule document not found.');}if(!stat.isFile() || stat.size!==document.size)fail(404,'Schedule document not found.');
  const name=document.name.replace(/[^a-zA-Z0-9_. -]/g,'_').slice(0,160);res.set({'Content-Type':document.mime,'Content-Disposition':`attachment; filename="${name}"`,'Cache-Control':'private, no-store','Content-Security-Policy':"default-src 'none'; sandbox"});res.sendFile(file,{dotfiles:'allow'});
 });
}
