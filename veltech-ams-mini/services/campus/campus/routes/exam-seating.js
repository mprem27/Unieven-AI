import {seatingExportRows} from '../../../../shared/seating-import.mjs';
import {departmentQuery,sameDepartment} from '../../../../shared/publishing-directory.mjs';
import {requireAdminAction} from '../services/admin-access.js';
import multer from 'multer';
import path from 'node:path';
import fs from 'node:fs/promises';
import crypto from 'node:crypto';
import {FacultyExam} from '../models/faculty-exams.js';
import {ExamSeatingRelease,ExamSeatingEntry} from '../models/exam-seating.js';
import User from '../../models/User.js';
import {Audit} from '../models.js';
import {campusRole} from '../policy.js';
import {canPublishExams} from './faculty-exams.js';
import {studentExamAudience,matchesExamAudience} from '../services/exam-audience.js';
import {verifiedStudentIdentity} from '../services/student-identity.js';
import {prepareCampaign,accountEmail} from '../services/admin-messages.js';
import {fail,validateId} from '../security.js';
import {matchImportedSeats} from '../services/seating-matching.js';
import {allocateSeating,validateSeatingRooms} from '../services/seating-allocation.js';
import {currentPublishedExams} from '../services/exam-publications.js';
const fields={vtuNumber:20,hall:120,room:120,seat:60,reportingTime:80,notes:500};
export function validateSeatingRows(rows){
 if(!Array.isArray(rows) || !rows.length || rows.length>5000)fail(400,'Add between 1 and 5,000 student seat rows.');
 const seen=new Set();return rows.map(row=>{
  if(!row || typeof row!=='object' || Array.isArray(row) || Object.keys(row).some(key=>!Object.hasOwn(fields,key)))fail(400,'Use the supported VTU, hall, room and seat fields.');
  const value={};for(const [key,max] of Object.entries(fields)){const raw=row[key] ?? '';if(typeof raw!=='string' || raw.length>max || /[\x00-\x08\x0b\x0c\x0e-\x1f]/.test(raw) || /^[=+@-]/.test(raw.trim()))fail(400,'A seat field is invalid, too long or contains a formula.');value[key]=raw.trim();}
  value.vtuNumber=value.vtuNumber.toUpperCase();if(!/^VTU[0-9]{3,12}$/.test(value.vtuNumber) || !value.room || !value.seat)fail(400,'Every row needs an exact VTU number, room and seat.');if(seen.has(value.vtuNumber))fail(400,'Each VTU number must occur only once per examination.');seen.add(value.vtuNumber);return value;
 });
}
const releaseView=row=>({id:String(row._id),filename:row.filename,mime:row.mime,size:row.size,state:row.state,revision:row.revision,rowCount:row.rowCount,instructions:row.instructions,allowDownload:row.allowDownload,warnings:row.warnings,review:row.importReview || [],issues:row.importIssues || [],publishedAt:row.publishedAt,createdAt:row.createdAt});
export function registerExamSeating(router,config){
 const directory=path.resolve(path.join(config.mediaDirectory || process.env.CAMPUS_MEDIA_DIR || '.campus-media','private-exam-seating'));
 const parser=multer({storage:multer.memoryStorage(),limits:{fileSize:8*1024*1024,files:1,fields:0,parts:1}}).single('file');
 const upload=(req,res,next)=>parser(req,res,error=>{if(error){error.status=error.code==='LIMIT_FILE_SIZE'?413:400;error.message='Upload one CSV, XLSX or PDF up to 8 MB.';}next(error);});
 const rosterParser=multer({storage:multer.memoryStorage(),limits:{fileSize:8*1024*1024,files:1,fields:3,parts:4,fieldSize:100000}}).single('file');
 const uploadRoster=(req,res,next)=>rosterParser(req,res,error=>{if(error){error.status=error.code==='LIMIT_FILE_SIZE'?413:400;error.message='Upload one CSV or XLSX roster up to 8 MB with rooms and optional course code / reporting time.';}next(error);});
 async function active(exam){if(!(await currentPublishedExams([exam])).length)fail(409,'This examination is withdrawn or belongs to an older schedule revision. Open the current examination.');}
 async function managed(req){
  if(!canPublishExams(req.user))fail(403,'Academic staff assignment required.');
  const scope=campusRole(req.user)==='admin'?{}:{department:departmentQuery(req.user.department),...(req.user.role==='faculty' && campusRole(req.user)!=='department_coordinator'?{publishedBy:req.user._id}:{})};
  const exam=await FacultyExam.findOne({_id:validateId(req.params.id),...scope});if(!exam)fail(404,'Examination not found in your assigned scope.');return exam;
 }
 router.get('/faculty-exams/:id/seating',config.auth,async(req,res)=>{const exam=await managed(req),releases=await ExamSeatingRelease.find({exam:exam._id}).sort({createdAt:-1}).limit(20).lean();res.json({releases:releases.map(releaseView),currentRelease:exam.seatingRelease?String(exam.seatingRelease):null});});
 router.get('/faculty-exams/:id/seating/template',config.auth,async(req,res)=>{const exam=await managed(req);res.set({'Content-Type':'text/csv; charset=utf-8','Content-Disposition':'attachment; filename="exam-seating-template.csv"','Cache-Control':'private, no-store'});const template=seatingExportRows(exam.courseCode,[{vtuNumber:'VTU00000',hall:'Main Block',room:'A101',seat:'S12',reportingTime:'09:00',notes:'Carry college ID'}]);res.send(template.map(row=>row.map(value=>'\"'+String(value).replaceAll('\"','\"\"')+'\"').join(',')).join('\r\n')+'\r\n');});
 router.post('/faculty-exams/:id/seating/allocate',config.auth,async(req,res,next)=>{const exam=await managed(req);await active(exam);next();},uploadRoster,async(req,res)=>{
  const exam=await managed(req);await active(exam);
  if(!req.file)fail(400,'Choose an explicit student roster.');
  if(Object.keys(req.body).some(key=>!['rooms','courseCode','reportingTime'].includes(key)))fail(400,'Use rooms, optional course code and reporting time.');
  let roomInput;try{roomInput=JSON.parse(req.body.rooms);}catch{fail(400,'Configure the room capacities before generating.');}validateSeatingRooms(roomInput);
  const courseCode=req.body.courseCode;
  if(courseCode!==undefined && (typeof courseCode!=='string' || courseCode.length>40 || !/^[A-Za-z0-9][A-Za-z0-9._/ -]*$/.test(courseCode) || courseCode.replace(/[^A-Za-z0-9]/g,'').toUpperCase()!==exam.courseCode.replace(/[^A-Za-z0-9]/g,'').toUpperCase()))fail(400,'The roster filter must exactly match this examination course code.');
  const name=path.basename(req.file.originalname).slice(0,180),extension=name.split('.').at(-1).toLowerCase();if(!['csv','xlsx'].includes(extension))fail(400,'Choose a CSV or XLSX student roster.');
  const parsed=await config.academic.internal('/campus/bridge/seating/roster',{filename:name,contentBase64:req.file.buffer.toString('base64'),...(courseCode!==undefined?{courseCode}:{})});
  if(!parsed || !Array.isArray(parsed.students) || parsed.students.length>5000)fail(502,'The roster parser returned an invalid preview.');
  const allocation=allocateSeating(parsed.students,roomInput,{reportingTime:req.body.reportingTime ?? ''}),preview=validateSeatingRows(allocation.rows);
  const warnings=['Generated from the staff-selected roster in VTU order. Review the roster, room capacities and every assignment before publishing. The attached roster is private by default.',...(parsed.warnings || []).map(value=>String(value).slice(0,500)).slice(0,19)],key=crypto.randomBytes(24).toString('hex'),mime=extension==='csv'?'text/csv':'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
  await active(exam);await fs.mkdir(directory,{recursive:true,mode:0o700});await fs.writeFile(path.join(directory,key),req.file.buffer,{flag:'wx',mode:0o600});let row;
  try{row=await ExamSeatingRelease.create({exam:exam._id,uploadedBy:req.user._id,filename:name,key,mime,size:req.file.size,preview,rowCount:preview.length,warnings,allowDownload:false});}catch(error){await fs.unlink(path.join(directory,key)).catch(()=>{});throw error;}
  await Audit.create({actor:req.user._id,action:'seating.allocate',target:row.id,details:JSON.stringify({exam:exam.id,students:preview.length,rooms:roomInput.length,capacity:allocation.capacity})});
  res.status(201).json({release:releaseView(row),rows:preview,warnings,allocation:{capacity:allocation.capacity,unusedSeats:allocation.unusedSeats}});
 });
 router.post('/faculty-exams/:id/seating/import',config.auth,async(req,res,next)=>{await managed(req);next();},upload,async(req,res)=>{
  const exam=await managed(req);await active(exam);
  if(!req.file)fail(400,'Choose a seating file.');const name=path.basename(req.file.originalname).slice(0,180),extension=name.split('.').at(-1).toLowerCase();if(extension==='xls')fail(400,'Legacy XLS is not supported by the installed parser. Save it as XLSX or CSV and upload again.');if(!['csv','xlsx','pdf'].includes(extension))fail(400,'Choose a CSV, XLSX or PDF seating list.');
  const parsed=await config.academic.internal('/campus/bridge/seating/parse',{filename:name,contentBase64:req.file.buffer.toString('base64'),courseCode:exam.courseCode});
  if(!parsed || !Array.isArray(parsed.rows) || parsed.rows.length>5000)fail(502,'The document parser returned an invalid preview.');
  // Resolve names only inside the verified course/audience roster. Campus
  // display names and unverified registration fields are never identity evidence.
  const eligible=[];
  if(parsed.rows.some(row=>!row.vtuNumber && row.name)){
   const users=await User.find({role:'student',isActive:{$ne:false},portalPrincipalVerifiedAt:{$type:'date'}}).limit(5001);
   if(users.length>5000)fail(400,'Name matching roster exceeds the safe limit. Supply exact VTU numbers.');
   let incomplete=false;
   for(let offset=0;offset<users.length;offset+=10){
    const audiences=await Promise.all(users.slice(offset,offset+10).map(user=>studentExamAudience(user,config)));
    for(const audience of audiences){if(!audience.verified || !audience.officialName || !audience.courseCodes?.length || ['department','semester','section','batch','regulation'].some(key=>exam[key] && exam[key]!=='*' && !audience[key])){incomplete=true;continue;}if(matchesExamAudience(exam,audience))eligible.push({vtuNumber:audience.vtuNumber,name:audience.officialName});}
   }
   // An unavailable record could be a homonym. Do not assume uniqueness from
   // a partial directory, even when one visible eligible student matches.
   if(incomplete)eligible.length=0;
  }
  const matched=matchImportedSeats(parsed.rows,exam.courseCode,eligible),issues=[...(parsed.issues || []),...matched.issues];
  const preview=matched.rows.length?validateSeatingRows(matched.rows):[],key=crypto.randomBytes(24).toString('hex'),mime={csv:'text/csv',xlsx:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',pdf:'application/pdf'}[extension];
  await fs.mkdir(directory,{recursive:true,mode:0o700});await fs.writeFile(path.join(directory,key),req.file.buffer,{flag:'wx',mode:0o600});let row;
  try{row=await ExamSeatingRelease.create({exam:exam._id,uploadedBy:req.user._id,filename:name,key,mime,size:req.file.size,preview,rowCount:preview.length,allowDownload:false,importReview:matched.review,importIssues:issues,warnings:(parsed.warnings || []).map(value=>String(value).slice(0,500)).slice(0,20)});}catch(error){await fs.unlink(path.join(directory,key)).catch(()=>{});throw error;}
  await Audit.create({actor:req.user._id,action:'seating.import',target:row.id,details:exam.id});res.status(201).json({release:releaseView(row),rows:preview,warnings:row.warnings});
 });
 router.get('/faculty-exams/:id/seating/:releaseId',config.auth,async(req,res)=>{const exam=await managed(req),row=await ExamSeatingRelease.findOne({_id:validateId(req.params.releaseId),exam:exam._id}).select('+preview');if(!row)fail(404,'Seating document not found.');const entries=row.revision && row.state==='published'?await ExamSeatingEntry.find({release:row._id,revision:row.revision}).select('vtuNumber hall room seat reportingTime notes -_id').lean():row.preview;res.json({release:releaseView(row),rows:entries || []});});
 router.put('/faculty-exams/:id/seating/:releaseId',config.auth,async(req,res)=>{
  const exam=await managed(req);await active(exam);const rows=validateSeatingRows(req.body.rows),revision=req.body.revision,instructions=req.body.instructions ?? '';
  if(!Number.isInteger(revision) || revision<0 || typeof instructions!=='string' || instructions.length>2000 || req.body.allowDownload!==undefined && typeof req.body.allowDownload!=='boolean')fail(400,'Choose a valid seating revision, instructions and download setting.');
  const row=await ExamSeatingRelease.findOne({_id:validateId(req.params.releaseId),exam:exam._id,revision});if(!row)fail(409,'This seating list changed. Reload it before publishing.');
  const allowDownload=false;
  const token=crypto.randomUUID(),now=new Date(),locked=await FacultyExam.findOneAndUpdate({_id:exam._id,isPublished:true,$or:[{seatingLockedUntil:null},{seatingLockedUntil:{$lte:now}}]},{$set:{seatingJobToken:token,seatingLockedUntil:new Date(+now+120000)}},{returnDocument:'after'});if(!locked)fail(409,'Another seating publication is in progress. Retry shortly.');
  const nextRevision=Math.max(revision,String(locked.seatingRelease)===row.id?(locked.seatingRevision || 0):0)+1;
  let reserved=false,published=false;
  try{
   // Reserve a unique generation only after taking the exam lease. A stale
   // request cannot overwrite a newer review, even after waiting for its lease.
   const reservation=await ExamSeatingRelease.findOneAndUpdate({_id:row._id,revision},{$set:{revision:nextRevision,state:'publishing',preview:rows}},{returnDocument:'after'});
   if(!reservation)fail(409,'This seating list changed. Reload it before publishing.');reserved=true;
   // New rows are staged under a new revision. The single exam pointer exposes
   // them only after every row is saved, so readers keep the previous seats.
   await ExamSeatingEntry.insertMany(rows.map(value=>({...value,exam:exam._id,release:row._id,revision:nextRevision})));
   await active(exam);
   const changed=await FacultyExam.findOneAndUpdate({_id:exam._id,isPublished:true,seatingJobToken:token,seatingLockedUntil:{$gt:new Date()}},{$set:{seatingRelease:row._id,seatingRevision:nextRevision,seatingInstructions:instructions.trim(),seatingAllowDownload:allowDownload,seatingPublishedAt:new Date()}},{returnDocument:'after'});if(!changed)fail(409,'The examination changed during publication. Reload it.');published=true;
   await ExamSeatingRelease.updateOne({_id:row._id,revision:nextRevision},{$set:{state:'published',revision:nextRevision,rowCount:rows.length,instructions:instructions.trim(),allowDownload,publishedAt:new Date(),lockedUntil:null}});
  }finally{if(reserved && !published)await ExamSeatingRelease.updateOne({_id:row._id,revision:nextRevision,state:'publishing'},{$set:{state:'draft'}});await FacultyExam.updateOne({_id:exam._id,seatingJobToken:token},{$unset:{seatingJobToken:'',seatingLockedUntil:''}});}
  await Audit.create({actor:req.user._id,action:'seating.publish',target:row.id,details:JSON.stringify({exam:exam.id,revision:nextRevision,students:rows.length})});
  const users=await User.find({portalPrincipal:{$in:rows.map(value=>value.vtuNumber.toLowerCase())},portalPrincipalVerifiedAt:{$type:'date'},isActive:{$ne:false}}).select('email recoveryEmail recoveryEmailVerifiedAt portalPrincipal portalPrincipalVerifiedAt').lean();
  if(users.length)await prepareCampaign({actor:req.user,requestId:`seating:${row.id}:${nextRevision}`,title:('Exam seating: '+exam.title).slice(0,160),body:`Your seating arrangement for ${exam.courseName} on ${exam.date} has been published. Open Academics → Examinations to view your own room and seat.`,audience:{kind:'exam-seating',examId:exam.id},kind:'exam_update',directRecipients:users.map(user=>({user:user._id,to:accountEmail(user)})),email:false,inApp:true,mail:config.mail});
  res.json({release:releaseView(await ExamSeatingRelease.findById(row._id)),published:true});
 });
 router.delete('/faculty-exams/:id/seating/:releaseId',config.auth,async(req,res)=>{
  const exam=await managed(req),id=validateId(req.params.releaseId),row=await ExamSeatingRelease.findOne({_id:id,exam:exam._id});if(!row)fail(404,'Seating document not found.');
  const token=crypto.randomUUID(),now=new Date(),locked=await FacultyExam.findOneAndUpdate({_id:exam._id,$or:[{seatingLockedUntil:null},{seatingLockedUntil:{$lte:now}}]},{$set:{seatingJobToken:token,seatingLockedUntil:new Date(+now+120000)}},{returnDocument:'after'});
  if(!locked)fail(409,'A seating publication is in progress. Retry withdrawal shortly.');
  try{
   const cleared=await FacultyExam.updateOne({_id:exam._id,seatingJobToken:token,seatingLockedUntil:{$gt:new Date()}},{$set:{seatingJobToken:token},$unset:{...(String(locked.seatingRelease)===row.id?{seatingRelease:'',seatingRevision:'',seatingInstructions:'',seatingAllowDownload:'',seatingPublishedAt:''}:{})}});
   if(!cleared.matchedCount)fail(409,'The examination changed during withdrawal. Reload it.');
   await ExamSeatingRelease.updateOne({_id:row._id},{$set:{state:'withdrawn'}});
  }finally{await FacultyExam.updateOne({_id:exam._id,seatingJobToken:token},{$unset:{seatingJobToken:'',seatingLockedUntil:''}});}
  await Audit.create({actor:req.user._id,action:'seating.withdraw',target:row.id});res.json({withdrawn:true});
 });
 router.get('/academics/exam-seating',config.auth,async(req,res)=>{
  const identity=await verifiedStudentIdentity(req.user,config);if(!identity.vtuNumber)return res.json({seating:[],identityAvailable:false,message:'Connect your own AMS account to view your examination seat.'});
  const entries=await ExamSeatingEntry.find({vtuNumber:identity.vtuNumber}).sort({_id:-1}).limit(1000).lean(),exams=await currentPublishedExams(await FacultyExam.find({_id:{$in:entries.map(row=>row.exam)},isPublished:true}).sort({date:1,startTime:1}).lean()),releases=await ExamSeatingRelease.find({_id:{$in:exams.map(row=>row.seatingRelease).filter(Boolean)}}).lean();const seating=[],audience=exams.some(exam=>exam.planId)?await studentExamAudience(req.user,config):null;
  for(const exam of exams){if(exam.planId && !matchesExamAudience(exam,audience))continue;const release=releases.find(row=>String(row._id)===String(exam.seatingRelease)),own=release && entries.find(row=>String(row.release)===String(release._id) && row.revision===exam.seatingRevision);if(!own)continue;seating.push({id:String(release._id),exam:{id:String(exam._id),title:exam.title,courseCode:exam.courseCode,courseName:exam.courseName,date:exam.date,startTime:exam.startTime,endTime:exam.endTime},ownSeat:Object.fromEntries(Object.keys(fields).map(key=>[key,own[key] || ''])),instructions:exam.seatingInstructions ?? release.instructions,publishedAt:exam.seatingPublishedAt || release.publishedAt,document:null});}
  res.json({seating,identityAvailable:true});
 });
 router.get('/academics/exam-seating/:releaseId/file',config.auth,async(req,res)=>{
  const release=await ExamSeatingRelease.findOne({_id:validateId(req.params.releaseId)});if(!release)fail(404,'Published seating document not found.');const exam=await FacultyExam.findOne({_id:release.exam,isPublished:true,seatingRelease:release._id});if(!exam || !(await currentPublishedExams([exam])).length)fail(404,'Published seating document not found.');
  let staff=false;if(campusRole(req.user)==='admin')requireAdminAction(req.user,'examinations','view');if(canPublishExams(req.user))staff=campusRole(req.user)==='admin' || sameDepartment(req.user.department,exam.department) && (req.user.role!=='faculty' || String(exam.publishedBy)===String(req.user._id));
  if(!staff)fail(404,'Original seating documents are private to authorized staff. View your own seat in Examinations.');
  if(!/^[a-f0-9]{48}$/.test(release.key))fail(404,'Document not found.');const file=path.join(directory,release.key);let stat;try{stat=await fs.stat(file);}catch{fail(404,'Document not found.');}if(!stat.isFile() || stat.size!==release.size)fail(404,'Document not found.');
  const name=release.filename.replace(/[^a-zA-Z0-9_. -]/g,'_').slice(0,160);res.set({'Content-Type':release.mime,'Content-Disposition':`attachment; filename="${name}"`,'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'none'; sandbox"});res.sendFile(file,{dotfiles:'allow'});
 });
}
