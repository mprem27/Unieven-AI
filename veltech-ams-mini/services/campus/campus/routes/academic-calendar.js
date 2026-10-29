import {sameDepartment,departmentQuery} from '../../../../shared/publishing-directory.mjs';
import {hasAdminPermission} from '../../../../shared/admin-access.mjs';
import User from '../../models/User.js';
import {AcademicCalendarEntry} from '../models/academic-calendar.js';
import {Audit} from '../models.js';
import {campusRole} from '../policy.js';
import {fail,validateId} from '../security.js';
import {studentExamAudience,departmentKey} from '../services/exam-audience.js';

const days=['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];
const ranks={college:1,department:2,students:3};
const validTime=value=>typeof value==='string' && /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value);
function dateInput(value){
 const date=new Date(`${value}T12:00:00Z`);
 if(typeof value!=='string' || !/^\d{4}-\d{2}-\d{2}$/.test(value) || !Number.isFinite(+date) || date.toISOString().slice(0,10)!==value)fail(400,'Choose a valid calendar date (YYYY-MM-DD).');
 return value;
}
function rangeInput(query){
 if(Object.keys(query).some(key=>!['from','to'].includes(key)))fail(400,'Use only the from and to calendar filters.');
 const from=dateInput(query.from),to=dateInput(query.to);
 if(to<from || (Date.parse(to)-Date.parse(from))/86400000>365)fail(400,'Choose an ordered calendar range of at most 366 days.');
 return {date:{$gte:from,$lte:to}};
}
function text(value,key,max,required=false){
 if(value===undefined)value='';
 if(typeof value!=='string' || value.length>max || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(value) || (required && !value.trim()))fail(400,`Enter a valid ${key} (up to ${max} characters).`);
 return value.trim();
}
export function canManageAcademicCalendar(user){return !!user && user.isActive!==false && ((campusRole(user)==='admin' && hasAdminPermission(user,'calendar')) || (campusRole(user)==='department_coordinator' && !!user.department?.trim()));}
function requireStaff(user){if(!canManageAcademicCalendar(user))fail(403,'An active administrator or assigned department coordinator is required.');}
async function managementScope(user){
 requireStaff(user);
 if(campusRole(user)==='admin')return {};
 const department=user.department.trim(),students=await User.find({role:'student',isActive:{$ne:false},department:departmentQuery(department)}).select('_id').lean();
 return {department:departmentQuery(department),$or:[{scope:'department'},{scope:'students',studentIds:{$not:{$elemMatch:{$nin:students.map(s=>s._id)}}}}]};
}
function present(row,manage=false){
 return {id:String(row._id),date:row.date,mode:row.mode,label:row.label,reason:row.reason || '',scope:row.scope,department:row.department || '',followDay:row.followDay || '',classes:(row.classes || []).map(c=>({courseCode:c.courseCode,courseName:c.courseName,startTime:c.startTime,endTime:c.endTime,room:c.room || '',faculty:c.faculty || ''})),source:'administrator',updatedAt:row.updatedAt,createdAt:row.createdAt,...(manage?{studentIds:(row.studentIds || []).map(String),targetCount:row.studentIds?.length || 0}:{})};
}
async function input(body,user){
 const fields=['date','mode','label','reason','scope','department','studentIds','followDay','classes'];
 if(!body || typeof body!=='object' || Array.isArray(body) || Object.keys(body).some(key=>!fields.includes(key)))fail(400,'Use the supported academic calendar fields. Target verified students individually when a section is needed.');
 const date=dateInput(body.date),label=text(body.label,'label',160,true),reason=text(body.reason,'reason',1000),scope=body.scope,mode=body.mode;
 if(!['college','department','students'].includes(scope) || !['holiday','follow-day','special'].includes(mode))fail(400,'Choose a supported calendar mode and scope.');
 const admin=campusRole(user)==='admin';
 let department=text(body.department,'department',120),studentIds=[];
 if(scope==='college'){
  if(!admin)fail(403,'Only an administrator can change the college calendar.');
  if(department || body.studentIds?.length)fail(400,'A college entry cannot target a department or students.');
 }else if(scope==='department'){
  if(body.studentIds?.length)fail(400,'A department entry cannot target individual students.');
  if(!admin && department && !sameDepartment(department,user.department))fail(403,'Use your assigned academic department.');
  if(!admin)department=user.department.trim();
  if(!department || !await User.exists({department:departmentQuery(department),isActive:{$ne:false}}))fail(400,'Choose an existing assigned academic department.');
 }else{
  if(!Array.isArray(body.studentIds) || !body.studentIds.length || body.studentIds.length>100 || body.studentIds.some(id=>typeof id!=='string' || !/^[a-f0-9]{24}$/i.test(id)) || new Set(body.studentIds.map(id=>id.toLowerCase())).size!==body.studentIds.length)fail(400,'Choose 1–100 distinct persisted campus student accounts.');
  studentIds=body.studentIds.map(id=>id.toLowerCase()).sort();
  const students=await User.find({_id:{$in:studentIds},role:'student',isActive:{$ne:false}}).select('_id department').lean();
  if(students.length!==studentIds.length)fail(400,'Every target must be an active persisted campus student account.');
  if(!admin && students.some(s=>!sameDepartment(s.department,user.department)))fail(403,'Target only students in your assigned academic department.');
  if(department && students.some(s=>!sameDepartment(s.department,department)))fail(400,'Selected students do not all belong to that academic department.');
  if(!admin)department=user.department.trim();
  else department=students.every(s=>sameDepartment(s.department,students[0].department))?students[0].department || '':'';
 }
 if(body.studentIds!==undefined && !Array.isArray(body.studentIds))fail(400,'Student targets must be a list.');
 const followDay=text(body.followDay,'source weekday',12);
 if(mode==='follow-day'?!days.includes(followDay):!!followDay)fail(400,'Choose a source weekday only for a follow-day entry.');
 if(body.classes!==undefined && !Array.isArray(body.classes))fail(400,'Special classes must be a list.');
 const classes=body.classes || [];
 if(mode==='special'){
  if(scope!=='students' || classes.length<1 || classes.length>16)fail(400,'Special classes require selected students and 1–16 explicit class periods.');
 }else if(classes.length)fail(400,'Add custom class periods only for a special-classes entry.');
 const normalized=classes.map(row=>{
  const keys=['courseCode','courseName','startTime','endTime','room','faculty'];
  if(!row || typeof row!=='object' || Array.isArray(row) || Object.keys(row).some(k=>!keys.includes(k)))fail(400,'Use the supported special class fields.');
  const courseCode=text(row.courseCode,'course code',40,true),courseName=text(row.courseName,'course name',180,true),room=text(row.room,'room',120),faculty=text(row.faculty,'faculty',160);
  if(!/^[A-Za-z0-9][A-Za-z0-9._/-]*$/.test(courseCode) || !validTime(row.startTime) || !validTime(row.endTime) || row.endTime<=row.startTime)fail(400,'Enter a course code and explicit HH:mm start/end times, with end after start.');
  return {courseCode,courseName,startTime:row.startTime,endTime:row.endTime,room,faculty};
 }).sort((a,b)=>a.startTime.localeCompare(b.startTime));
 if(normalized.some((row,index)=>index>0 && normalized[index-1].endTime>row.startTime))fail(400,'Special class periods cannot overlap for the same students.');
 const scopeKeys=scope==='college'?['college']:scope==='department'?[`department:${department}`]:studentIds.map(id=>`student:${id}`);
 return {date,label,reason,mode,scope,department,studentIds,followDay,classes:normalized,scopeKeys};
}

export function registerAcademicCalendar(router,config){
 router.get('/academic-calendar/manage',config.auth,async(req,res)=>{
  const scope=await managementScope(req.user),range=rangeInput(req.query),admin=campusRole(req.user)==='admin';
  const [entries,students,departments]=await Promise.all([
   AcademicCalendarEntry.find({...scope,...range}).sort({date:1,updatedAt:-1}).limit(1000).lean(),
   User.find({role:'student',isActive:{$ne:false},...(admin?{}:{department:departmentQuery(req.user.department)})}).select('_id name studentId department').sort({name:1,_id:1}).limit(1000).lean(),
   admin?User.distinct('department',{department:{$nin:['',null]},isActive:{$ne:false}}):Promise.resolve([req.user.department.trim()]),
  ]);
  res.json({entries:entries.map(row=>present(row,true)),students:students.map(s=>({id:String(s._id),name:s.name || 'Student',studentId:s.studentId || '',department:s.department || ''})),departments:departments.sort(),canChooseCollege:admin,department:req.user.department || '',source:'administrator'});
 });
 router.get('/academic-calendar',config.auth,async(req,res)=>{
  const range=rangeInput(req.query);
  const audience=req.user.role==='student'?await studentExamAudience(req.user,config):null;
  const department=departmentKey(audience?(audience.verified?audience.department:''):req.user.department);
  // Official AMS names may be expanded while staff publish using CSE/ECE. Read
  // only relevant scope types, then compare the shared canonical department key.
  const candidates=await AcademicCalendarEntry.find({...range,$or:[{scope:'college'},...(department?[{scope:'department'}]:[]),{scope:'students',studentIds:req.user._id}]}).lean();
  const rows=candidates.filter(row=>row.scope!=='department' || departmentKey(row.department)===department);
  rows.sort((a,b)=>ranks[b.scope]-ranks[a.scope] || +new Date(b.updatedAt)-+new Date(a.updatedAt) || String(b._id).localeCompare(String(a._id)));
  const effective=new Map();for(const row of rows)if(!effective.has(row.date))effective.set(row.date,present(row));
  res.json({entries:[...effective.values()].sort((a,b)=>a.date.localeCompare(b.date)),source:'administrator'});
 });
 router.post('/academic-calendar',config.auth,async(req,res)=>{
  requireStaff(req.user);const value=await input(req.body,req.user);
  await AcademicCalendarEntry.init();
  const row=await AcademicCalendarEntry.create({...value,createdBy:req.user._id,updatedBy:req.user._id});
  await Audit.create({actor:req.user._id,action:'academic-calendar.create',target:row.id,details:`${value.date} ${value.scope} ${value.mode}`});
  res.status(201).json(present(row,true));
 });
 router.patch('/academic-calendar/:id',config.auth,async(req,res)=>{
  const scope=await managementScope(req.user),id=validateId(req.params.id);
  if(!await AcademicCalendarEntry.exists({_id:id,...scope}))fail(404,'Calendar entry not found in your assigned scope.');
  const value=await input(req.body,req.user);
  await AcademicCalendarEntry.init();
  const row=await AcademicCalendarEntry.findOneAndUpdate({_id:id,...scope},{$set:{...value,updatedBy:req.user._id}},{returnDocument:'after',runValidators:true});
  if(!row)fail(404,'Calendar entry not found in your assigned scope.');
  await Audit.create({actor:req.user._id,action:'academic-calendar.update',target:row.id,details:`${value.date} ${value.scope} ${value.mode}`});
  res.json(present(row,true));
 });
 router.delete('/academic-calendar/:id',config.auth,async(req,res)=>{
  const scope=await managementScope(req.user),id=validateId(req.params.id);
  const row=await AcademicCalendarEntry.findOneAndDelete({_id:id,...scope});
  if(!row)fail(404,'Calendar entry not found in your assigned scope.');
  await Audit.create({actor:req.user._id,action:'academic-calendar.delete',target:id,details:`${row.date} ${row.scope}`});
  res.json({id,deleted:true});
 });
}
