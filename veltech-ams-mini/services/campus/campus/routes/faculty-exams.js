import {uniqueExaminationSessions} from '../../../../shared/examination-records.mjs';
import {assertNoPublishedExamCollision,withExamPublicationLock} from '../services/exam-collisions.js';
import {sameDepartment,departmentQuery} from '../../../../shared/publishing-directory.mjs';
import {studentExamAudience,matchesExamAudience} from '../services/exam-audience.js';
import {currentPublishedExams,examView} from '../services/exam-publications.js';
import {ExamPlan} from '../models/exam-plans.js';
import {requireAdminAction} from '../services/admin-access.js';
import {hasAdminPermission} from '../../../../shared/admin-access.mjs';
import {FacultyExam} from '../models/faculty-exams.js';
import {Audit} from '../models.js';
import {campusRole} from '../policy.js';
import {fail,httpUrl,validateId} from '../security.js';

export function canPublishExams(user){
 if(!user || user.isActive===false)return false;
 return (campusRole(user)==='admin' && hasAdminPermission(user,'examinations')) || (!!user.department?.trim() && (user.role==='faculty' || campusRole(user)==='department_coordinator'));
}
function staffScope(user){
 if(!canPublishExams(user))fail(403,'An active faculty or academic staff assignment is required.');
 if(campusRole(user)==='admin')return {};
 return {department:departmentQuery(user.department),...(user.role==='faculty' && campusRole(user)!=='department_coordinator'?{publishedBy:user._id}:{})};
}
export function examInput(body,user){
 const limits={title:160,courseCode:40,courseName:180,date:10,startTime:5,endTime:5,room:120,department:120,semester:30,section:30,notes:3000,url:1500};
 if(!body || typeof body!=='object' || Array.isArray(body) || Object.keys(body).some(key=>!(key in limits)))fail(400,'Use the supported examination fields.');
 const value={};
 for(const [key,limit] of Object.entries(limits)){
  const raw=body[key] ?? '';
  if(typeof raw!=='string' || raw.length>limit)fail(400,'An examination field is invalid or too long.');
  value[key]=raw.trim();
 }
 if(campusRole(user)!=='admin'){
  if(value.department && !sameDepartment(value.department,user.department))fail(403,'Publish examinations only for your assigned department.');
  value.department=user.department?.trim() || '';
 }
 if(!value.title || !value.courseName || !/^[A-Za-z0-9][A-Za-z0-9._/-]{1,39}$/.test(value.courseCode) || !value.department)fail(400,'Enter a title, course code, course name and assigned department.');
 const parsedDate=new Date(value.date+'T12:00:00Z');
 if(!/^\d{4}-\d{2}-\d{2}$/.test(value.date) || !Number.isFinite(parsedDate.getTime()) || parsedDate.toISOString().slice(0,10)!==value.date)fail(400,'Choose a valid examination date.');
 if(!/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value.startTime) || !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value.endTime) || value.endTime<=value.startTime)fail(400,'Examination end time must follow its start time.');
 value.url=httpUrl(value.url);
 if(value.url && !value.url.startsWith('https://'))fail(400,'Use a secure document link.');
 return value;
}
export function registerFacultyExams(router,config){
 router.get('/academics/faculty-exams',config.auth,async(req,res)=>{
  if(campusRole(req.user)==='admin')requireAdminAction(req.user,'examinations','view');
  const staff=canPublishExams(req.user),audience=staff?null:await studentExamAudience(req.user,config);
  if(!staff && (!audience.verified || !audience.courseCodes.length))return res.json({examinations:[],scheduleDocuments:[],source:'faculty-published',matchingStatus:audience.verified?'courses-unavailable':'identity-unavailable',message:audience.reason});
  const candidates=await FacultyExam.find({isPublished:true,...(staff?(campusRole(req.user)!=='admin'?{department:departmentQuery(req.user.department)}:{}):{$or:[{courseMatchKey:{$in:audience.courseCodes}},{courseMatchKey:{$exists:false}}]})}).sort({date:1,startTime:1}).lean();
  const matched=(await currentPublishedExams(candidates)).filter(row=>staff || matchesExamAudience(row,audience)),rows=staff?matched:uniqueExaminationSessions(matched),ids=[...new Set(rows.filter(row=>row.planId).map(row=>String(row.planId)))];
  const plans=ids.length?await ExamPlan.find({_id:{$in:ids},status:'published'}).lean():[];
  res.json({examinations:rows.map(examView),scheduleDocuments:plans.filter(p=>p.publishedDocument?.name).map(p=>({id:String(p._id),title:p.publishedTitle || p.title,name:p.publishedDocument.name,mime:p.publishedDocument.mime,url:`/api/campus/exam-plans/${p._id}/document`,publishedAt:p.publishedAt})),source:'faculty-published',department:audience?.department || req.user.department || '',matchingStatus:'matched'});
 });
 router.get('/faculty-exams',config.auth,async(req,res)=>{
  const scope=staffScope(req.user);
  const rows=await FacultyExam.find(scope).sort({date:-1,startTime:1}).limit(300).lean();
  res.json({examinations:rows.map(examView),department:req.user.department || '',canChooseDepartment:campusRole(req.user)==='admin'});
 });
 router.post('/faculty-exams',config.auth,async(req,res)=>{
  staffScope(req.user);
  const input=examInput(req.body,req.user);
  const row=await withExamPublicationLock(async checkpoint=>{await assertNoPublishedExamCollision([input]);await checkpoint();return FacultyExam.create({...input,publishedBy:req.user._id,publishedByName:req.user.name || 'Faculty',isPublished:true});});
  await Audit.create({actor:req.user._id,action:'examination.publish',target:row.id,details:input.department});
  res.status(201).json(examView(row));
 });
 router.put('/faculty-exams/:id',config.auth,async(req,res)=>{
  const scope=staffScope(req.user),id=validateId(req.params.id),input=examInput(req.body,req.user);
  if(await FacultyExam.exists({_id:id,planId:{$exists:true}}))fail(409,'Edit this examination through its schedule draft, then republish.');
  const row=await withExamPublicationLock(async checkpoint=>{if(!await FacultyExam.exists({_id:id,...scope}))fail(404,'Examination not found in your assigned scope.');await assertNoPublishedExamCollision([input],{excludeExam:id});await checkpoint();return FacultyExam.findOneAndUpdate({_id:id,...scope},{$set:{...input,courseMatchKey:input.courseCode.toUpperCase().replace(/[^A-Z0-9]/g,''),isPublished:true}},{returnDocument:'after',runValidators:true});});
  if(!row)fail(404,'Examination not found in your assigned scope.');
  await Audit.create({actor:req.user._id,action:'examination.update',target:row.id,details:input.department});
  res.json(examView(row));
 });
 router.delete('/faculty-exams/:id',config.auth,async(req,res)=>{
  const scope=staffScope(req.user),id=validateId(req.params.id);
  if(await FacultyExam.exists({_id:id,planId:{$exists:true}}))fail(409,'Withdraw this examination through its schedule.');
  const row=await FacultyExam.findOneAndUpdate({_id:id,...scope},{$set:{isPublished:false}},{returnDocument:'after'});
  if(!row)fail(404,'Examination not found in your assigned scope.');
  await Audit.create({actor:req.user._id,action:'examination.withdraw',target:row.id,details:row.department});
  res.json({id:row.id,isPublished:false});
 });
}
