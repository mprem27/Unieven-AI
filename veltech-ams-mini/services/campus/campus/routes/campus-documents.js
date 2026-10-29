import multer from 'multer';
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import {normalizePublishingScope} from '../services/publishing-directory.js';
import {CampusDocument} from '../models/campus-documents.js';
import {Audit} from '../models.js';
import {campusRole} from '../policy.js';
import {fail,validateId} from '../security.js';
import {studentExamAudience} from '../services/exam-audience.js';
import {documentStaffScope,documentInput,matchesDocumentAudience,inspectDocument,documentView,DOCUMENT_MAX_BYTES} from '../services/campus-documents.js';
export function registerCampusDocuments(router,config){
 const directory=path.resolve(config.documentDirectory || path.join(config.mediaDirectory || process.env.CAMPUS_MEDIA_DIR || '.campus-media','private-campus-documents'));
 const parser=multer({storage:multer.memoryStorage(),limits:{fileSize:DOCUMENT_MAX_BYTES,files:1,fields:1,fieldSize:16000,parts:2}}).single('file');
 const upload=(req,res,next)=>parser(req,res,error=>{if(error){error.status=error.code==='LIMIT_FILE_SIZE'?413:400;error.message='Upload one PDF, XLSX, CSV, PNG or JPEG up to 8 MB.';}next(error);});
 async function managed(req,action='view'){const scope=documentStaffScope(req.user,action),row=await CampusDocument.findOne({_id:validateId(req.params.id),...scope}).select('+file.key');if(!row)fail(404,'Document not found in your assigned scope.');return row;}
 router.get('/campus-documents',config.auth,async(req,res)=>{const scope=documentStaffScope(req.user),rows=await CampusDocument.find(scope).sort({createdAt:-1,_id:-1}).limit(300).lean();res.json({documents:rows.map(documentView),department:req.user.department || '',canChooseCollege:campusRole(req.user)==='admin',canCreate:can(req.user,'create'),canUpdate:can(req.user,'update'),canDelete:can(req.user,'delete')});});
 function can(user,action){try{documentStaffScope(user,action);return true;}catch{return false;}}
 router.post('/campus-documents',config.auth,(req,_res,next)=>{documentStaffScope(req.user,'create');next();},upload,async(req,res)=>{
  let metadata;try{metadata=JSON.parse(req.body.metadata);}catch{fail(400,'Provide document metadata as JSON.');}
  const value=documentInput(await normalizePublishingScope(documentInput(metadata,req.user),req.user),req.user);if(!req.file)fail(400,'Choose a document file.');const info=inspectDocument(req.file.buffer,req.file.originalname),key=crypto.randomBytes(24).toString('hex');
  await fs.mkdir(directory,{recursive:true,mode:0o700});await fs.writeFile(path.join(directory,key),req.file.buffer,{flag:'wx',mode:0o600});let row;
  try{row=await CampusDocument.create({...value,file:{...info,key},createdBy:req.user._id,createdByName:req.user.name,updatedBy:req.user._id});}catch(error){await fs.unlink(path.join(directory,key)).catch(()=>{});throw error;}
  await Audit.create({actor:req.user._id,action:'academic.document.publish',target:row.id,details:`${value.scope} ${value.department}`});res.status(201).json({document:documentView(row)});
 });
 router.patch('/campus-documents/:id',config.auth,async(req,res)=>{const old=await managed(req,'update'),value=documentInput(await normalizePublishingScope(documentInput({...Object.fromEntries(['title','category','reference','date','scope','department','semester','section','batch','courseCodes'].map(k=>[k,old[k]])),...req.body},req.user),req.user),req.user);const row=await CampusDocument.findOneAndUpdate({_id:old._id,...documentStaffScope(req.user,'update')},{$set:{...value,updatedBy:req.user._id}},{returnDocument:'after',runValidators:true});if(!row)fail(404,'Document not found in your assigned scope.');await Audit.create({actor:req.user._id,action:'academic.document.update',target:row.id});res.json({document:documentView(row)});});
 router.delete('/campus-documents/:id',config.auth,async(req,res)=>{const old=await managed(req,'delete'),row=await CampusDocument.findOneAndDelete({_id:old._id,...documentStaffScope(req.user,'delete')});if(!row)fail(404,'Document not found in your assigned scope.');if(/^[a-f0-9]{48}$/.test(old.file.key))await fs.unlink(path.join(directory,old.file.key)).catch(()=>{});await Audit.create({actor:req.user._id,action:'academic.document.delete',target:old.id});res.json({id:old.id,deleted:true});});
 router.get('/academics/campus-documents',config.auth,async(req,res)=>{if(req.user.role!=='student' || campusRole(req.user)==='admin')fail(403,'A student workspace is required.');const audience=await studentExamAudience(req.user,config),rows=await CampusDocument.find().sort({createdAt:-1,_id:-1}).limit(1000).lean();res.json({documents:rows.filter(row=>matchesDocumentAudience(row,audience)).map(documentView)});});
 router.get('/academics/campus-documents/:id/file',config.auth,async(req,res)=>{
  let row;if(req.user.role==='student' && campusRole(req.user)!=='admin' && campusRole(req.user)!=='department_coordinator'){row=await CampusDocument.findById(validateId(req.params.id)).select('+file.key');if(!row || !matchesDocumentAudience(row,await studentExamAudience(req.user,config)))fail(404,'Published document not found.');}else row=await managed(req);
  if(!/^[a-f0-9]{48}$/.test(row.file.key || ''))fail(404,'Document file not found.');const file=path.join(directory,row.file.key);let stat;try{stat=await fs.lstat(file);}catch{fail(404,'Document file not found.');}if(!stat.isFile() || stat.isSymbolicLink() || stat.size!==row.file.size)fail(404,'Document file not found.');
  res.set({'Content-Type':row.file.mime,'Content-Disposition':`attachment; filename="${row.file.name.replace(/[^A-Za-z0-9_. -]/g,'_')}"`,'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'none'; sandbox"});res.sendFile(file,{dotfiles:'allow'});
 });
}
