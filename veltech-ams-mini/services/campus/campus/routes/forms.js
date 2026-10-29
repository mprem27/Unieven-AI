import {sameDepartment,sameClub} from '../../../../shared/publishing-directory.mjs';
import multer from 'multer';
import path from 'node:path';
import fs from 'node:fs/promises';
import crypto from 'node:crypto';
import {rateLimit} from 'express-rate-limit';
import Event from '../../models/Event.js';
import Registration from '../../models/EventRegistration.js';
import {Audit} from '../models.js';
import {CampusForm,FormResponse,FormProof,FormChallenge} from '../form-models.js';
import {fail,validateId,newToken,hashToken} from '../security.js';
import {validateForm,validateAnswers,verifyLocation,canCreateForm,canManageForm,canViewForm,canSubmitForm,assertFormOpen} from '../services/form-policy.js';
import {inspectMedia} from '../services/media-store.js';

const proofUrl=id=>`/api/campus/forms/proofs/${id}`;
const serializeResponse=response=>{const value=response.toObject?response.toObject():response;return {...value,id:String(value._id),proofUrl:value.proof?proofUrl(value.proof):null};};
const serializeForm=(form,user)=>{const value=form.toObject?form.toObject():form;return {...value,id:String(value._id),canManage:canManageForm(user,value)};};
async function linkedEvent(user,form) {
 if(!form.eventId)return null;
 const event=await Event.findById(form.eventId);
 if(!event || !canManageForm(user,event))fail(403,'You cannot manage forms for this event.');
 if(event.scope!==form.scope || (form.scope!=='college' && !sameDepartment(event.department,form.department)) || (form.scope==='club' && !sameClub(event.club,form.club,form.department)))fail(400,'The form scope must match its linked event.');
 return event;
}
async function load(id,user,{manage=false}={}) {
 validateId(id);const form=await CampusForm.findById(id);if(!form)fail(404,'Form not found.');
 if(manage && !canManageForm(user,form))fail(403,'Faculty access is required for this form.');
 if(!manage && !canViewForm(user,form))fail(404,'Form not found.');
 return form;
}
async function studentForm(id,user) {
 const form=await load(id,user);if(!canSubmitForm(user))fail(403,'Only student accounts can submit this form.');assertFormOpen(form);
 if(form.eventId){const event=await Event.findById(form.eventId);if(!event || event.archivedAt || ['cancelled','completed'].includes(event.status))fail(409,'The linked event is no longer accepting submissions.');}
 return form;
}
export function registerForms(router,config) {
 const directory=path.resolve(config.proofDirectory || process.env.CAMPUS_PROOF_DIR || path.join(config.mediaDirectory || process.env.CAMPUS_MEDIA_DIR || '.campus-media','private-form-proofs'));
 const upload=multer({storage:multer.memoryStorage(),limits:{fileSize:8*1024*1024,files:1,fields:0,parts:1}}).single('file');
 const captureUpload=multer({storage:multer.memoryStorage(),limits:{fileSize:8*1024*1024,files:1,fields:2,parts:3,fieldSize:256}}).single('file');
 const parseUpload=parser=>(req,res,next)=>parser(req,res,error=>{if(error){error.status=error.code==='LIMIT_FILE_SIZE'?413:400;error.message='Send one supported proof image up to 8 MB with valid capture details.';}next(error);});
 async function storeProof(form,user,bytes,mime,details={}) {
  const key=crypto.randomBytes(24).toString('hex');await fs.mkdir(directory,{recursive:true,mode:0o700});await fs.writeFile(path.join(directory,key),bytes,{flag:'wx',mode:0o600});
  try{return await FormProof.create({form:form.id,owner:user._id,key,mime,size:bytes.length,...details});}catch(error){await fs.unlink(path.join(directory,key)).catch(()=>{});throw error;}
 }
 const writes=config.trafficControls?.formWrites || rateLimit({windowMs:60000,limit:30,keyGenerator:req=>String(req.user._id),standardHeaders:'draft-8',legacyHeaders:false,message:{message:'Too many form changes. Please wait a minute.'}});
 router.use('/forms',config.auth);
 router.use('/forms',(req,res,next)=>['GET','HEAD','OPTIONS'].includes(req.method)?next():writes(req,res,next));
 router.get('/forms',async(req,res)=>{
  const forms=await CampusForm.find({}).sort({createdAt:-1}).limit(300).lean();
  const visible=forms.filter(f=>canViewForm(req.user,f));
  const responses=await FormResponse.find({user:req.user._id,form:{$in:visible.map(f=>f._id)}}).select('form status createdAt').lean();
  res.json(visible.map(f=>({...serializeForm(f,req.user),submission:responses.find(r=>String(r.form)===String(f._id)) || null})));
 });
 router.post('/forms',async(req,res)=>{
  const value=validateForm(req.body);if(!canCreateForm(req.user,value))fail(403,'Your faculty role cannot create official forms in this scope.');await linkedEvent(req.user,value);
  const form=await CampusForm.create({...value,createdBy:req.user._id});await Audit.create({actor:req.user._id,action:'form.create',target:form.id});res.status(201).json(serializeForm(form,req.user));
 });
 router.get('/forms/proofs/:id',async(req,res)=>{
  validateId(req.params.id);const proof=await FormProof.findById(req.params.id);if(!proof)fail(404,'Proof not found.');
  const form=await CampusForm.findById(proof.form),owner=String(proof.owner)===String(req.user._id);
  // Reviewers can access submitted evidence; unattached uploads remain owner-only.
  if(!owner && (!proof.response || !canManageForm(req.user,form)))fail(404,'Proof not found.');
  if(!/^[a-f0-9]{48}$/.test(proof.key))fail(404,'Proof not found.');
  const filename=path.join(directory,proof.key);let stat;try{stat=await fs.stat(filename);}catch{fail(404,'Proof not found.');}if(!stat.isFile() || stat.size!==proof.size)fail(404,'Proof not found.');
  res.set({'Content-Type':proof.mime,'Content-Disposition':'attachment; filename="form-proof.'+(proof.mime==='application/pdf'?'pdf':proof.mime==='image/png'?'png':'jpg')+'"','X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'none'; sandbox",'Cache-Control':'private, no-store'});res.sendFile(filename);
 });
 router.get('/forms/:id',async(req,res)=>{
  const form=await load(req.params.id,req.user),submission=await FormResponse.findOne({form:form.id,user:req.user._id}).lean();
  res.json({...serializeForm(form,req.user),submission:submission?serializeResponse(submission):null});
 });
 router.delete('/forms/:id',async(req,res)=>{
  const form=await load(req.params.id,req.user,{manage:true});await CampusForm.updateOne({_id:form._id},{$set:{archivedAt:new Date(),state:'closed'},$inc:{revision:1}});await Audit.create({actor:req.user._id,action:'form.archive',target:form.id});res.json({id:form.id,archived:true,historyRetained:true});
 });
 router.patch('/forms/:id',async(req,res)=>{
  const form=await load(req.params.id,req.user,{manage:true});
  if(!req.body || typeof req.body!=='object' || Array.isArray(req.body))fail(400,'Enter valid form changes.');
  const editable=['title','description','state','fields','opensAt','closesAt','geofence','requireProof','requireRegistration','checkIn'];
  if(Object.keys(req.body).some(k=>!editable.includes(k)))fail(400,'This form setting cannot be changed.');
  const frozen=Object.keys(req.body).some(k=>!['state'].includes(k));
  if(frozen && (form.responseCount>0 || await FormResponse.exists({form:form.id})))fail(409,'Questions and conditions are locked after the first response. Close this form and create another.');
  const value=validateForm({...form.toObject(),...req.body});await linkedEvent(req.user,value);
  const updated=await CampusForm.findOneAndUpdate({_id:form.id,revision:form.revision,...(frozen?{responseCount:0}:{})},{$set:value,$inc:{revision:1}},{returnDocument:'after'});
  if(!updated)fail(409,'The form changed. Reload and retry.');await Audit.create({actor:req.user._id,action:'form.update',target:form.id});res.json(serializeForm(updated,req.user));
 });
 router.post('/forms/:id/proofs',parseUpload(upload),async(req,res)=>{
  const form=await studentForm(req.params.id,req.user);if(await FormResponse.exists({form:form.id,user:req.user._id}))fail(409,'You already submitted this form.');
  fail(400,'Use a fresh camera capture from this form. Gallery proof uploads are not accepted.');
 });
 router.post('/forms/:id/capture-challenge',async(req,res)=>{
  const form=await studentForm(req.params.id,req.user);if(await FormResponse.exists({form:form.id,user:req.user._id}))fail(409,'You already submitted this form.');
  const token=newToken(),expiresAt=new Date(Date.now()+120000);await FormChallenge.create({form:form.id,user:req.user._id,purpose:'camera',tokenHash:hashToken(token),expiresAt});res.json({token,expiresAt});
 });
 router.post('/forms/:id/captures',parseUpload(captureUpload),async(req,res)=>{
  const form=await studentForm(req.params.id,req.user);if(await FormResponse.exists({form:form.id,user:req.user._id}))fail(409,'You already submitted this form.');
  if(!req.file || !['image/png','image/jpeg'].includes(req.file.mimetype))fail(400,'Capture a JPEG or PNG image with the form camera.');
  const info=inspectMedia(req.file.buffer);if(info.mime!==req.file.mimetype || !['image/png','image/jpeg'].includes(info.mime))fail(400,'The capture contents must match its image format.');
  const {challengeToken}=req.body || {},capturedAt=Number(req.body?.capturedAt),now=new Date();
  if(typeof challengeToken!=='string' || !/^[a-f0-9]{64}$/.test(challengeToken) || !Number.isFinite(capturedAt) || capturedAt>now.getTime()+5000 || now.getTime()-capturedAt>120000)fail(400,'Start a fresh camera capture and retry.');
  const challenge=await FormChallenge.findOneAndUpdate({form:form.id,user:req.user._id,purpose:'camera',tokenHash:hashToken(challengeToken),createdAt:{$lte:new Date(capturedAt+2000)},expiresAt:{$gt:now},consumedAt:null},{$set:{consumedAt:now}},{returnDocument:'after'});
  if(!challenge)fail(409,'The camera challenge expired or was already used. Retake your photo.');
  const proof=await storeProof(form,req.user,req.file.buffer,info.mime,{source:'camera',captureChallenge:challenge.id,capturedAt:new Date(capturedAt),captureExpiresAt:challenge.expiresAt});
  res.status(201).json({id:proof.id,url:proofUrl(proof.id),mime:proof.mime,size:proof.size,expiresAt:proof.captureExpiresAt});
 });
 router.post('/forms/:id/challenge',async(req,res)=>{
  const form=await studentForm(req.params.id,req.user);if(await FormResponse.exists({form:form.id,user:req.user._id}))fail(409,'You already submitted this form.');
  const token=newToken(),expiresAt=new Date(Date.now()+120000);await FormChallenge.create({form:form.id,user:req.user._id,purpose:'location',tokenHash:hashToken(token),expiresAt});res.json({token,expiresAt});
 });
 router.post('/forms/:id/submissions',async(req,res)=>{
  const form=await studentForm(req.params.id,req.user),body=req.body || {};if(await FormResponse.exists({form:form.id,user:req.user._id}))fail(409,'You already submitted this form.');
  const answers=validateAnswers(form.fields,body.answers),location=form.geofence?verifyLocation(form.geofence,body.location):null;
  let proof=null;if(body.proofId){validateId(body.proofId);proof=await FormProof.findOne({_id:body.proofId,form:form.id,owner:req.user._id,response:null});if(!proof)fail(403,'Attach your own proof uploaded for this form.');}
  if(form.requireProof || proof) {
   if(!proof || proof.source!=='camera' || !['image/jpeg','image/png'].includes(proof.mime) || !proof.captureChallenge || !proof.captureExpiresAt || proof.captureExpiresAt<=new Date())fail(400,'Retake a fresh camera photo before submitting.');
   if(!await FormChallenge.exists({_id:proof.captureChallenge,form:form.id,user:req.user._id,purpose:'camera',consumedAt:{$ne:null},expiresAt:{$gt:new Date()}}))fail(409,'The camera capture expired. Retake your photo.');
  }
  const registration=form.eventId?await Registration.findOne({user:req.user._id,event:form.eventId,status:{$in:['registered','attended']}}):null;
  if(form.requireRegistration && !registration)fail(403,'An active event registration is required.');
  if(form.checkIn && registration?.status!=='registered')fail(409,'This ticket has already been checked in.');
  if(form.geofence || form.checkIn) {
   if(typeof body.challengeToken!=='string' || !/^[a-f0-9]{64}$/.test(body.challengeToken))fail(400,'Refresh the location check and retry.');
   const challenge=await FormChallenge.findOneAndUpdate({form:form.id,user:req.user._id,purpose:'location',tokenHash:hashToken(body.challengeToken),expiresAt:{$gt:new Date()},consumedAt:null},{$set:{consumedAt:new Date()}},{returnDocument:'after'});
   if(!challenge)fail(409,'The check-in token has expired or was already used. Get a fresh location check.');
  }
  const now=new Date(),reserved=await CampusForm.findOneAndUpdate({_id:form.id,revision:form.revision,state:'published',$and:[{$or:[{opensAt:null},{opensAt:{$lte:now}}]},{$or:[{closesAt:null},{closesAt:{$gt:now}}]}]},{$inc:{responseCount:1}},{returnDocument:'after'});
  if(!reserved)fail(409,'The form changed or closed. Reload before submitting.');
  let response;try{response=await FormResponse.create({form:form.id,user:req.user._id,answers,proof:proof?._id || null,location,registration:registration?._id || null});}catch(error){await CampusForm.updateOne({_id:form.id},{$inc:{responseCount:-1}});throw error;}
  if(proof)await FormProof.updateOne({_id:proof.id,owner:req.user._id,response:null},{$set:{response:response.id}});
  await Audit.create({actor:req.user._id,action:'form.submit',target:response.id});res.status(201).json(serializeResponse(response));
 });
 router.get('/forms/:id/responses',async(req,res)=>{
  const form=await load(req.params.id,req.user,{manage:true});
  const limit=Math.min(100,Math.max(1,Number(req.query.limit) || 50)),query={form:form.id};if(req.query.before){validateId(req.query.before);query._id={$lt:req.query.before};}
  const responses=await FormResponse.find(query).populate('user','name username studentId department').sort({_id:-1}).limit(limit).lean();res.json({form:serializeForm(form,req.user),responses:responses.map(serializeResponse),nextCursor:responses.length===limit?String(responses.at(-1)._id):null});
 });
 router.get('/forms/:id/responses/export',async(req,res)=>{
  const form=await load(req.params.id,req.user,{manage:true});
  const responses=await FormResponse.find({form:form.id}).populate('user','name username studentId department').sort({_id:1}).limit(10001).lean();
  if(responses.length>10000)fail(413,'This form exceeds the 10,000 response export limit. Ask an administrator for a scoped archive.');
  const columns=['Submitted at','Student','Student ID','Department',...form.fields.map(f=>f.label),'Review status','Reviewer note','Reviewed at','Private proof attached','Venue distance (m)','Location accuracy (m)'];
  const rows=responses.map(r=>[r.createdAt.toISOString(),r.user?.name || r.user?.username || '',r.user?.studentId || '',r.user?.department || '',...form.fields.map(f=>Array.isArray(r.answers?.[f.id])?r.answers[f.id].join('; '):r.answers?.[f.id] ?? ''),r.status,r.reviewNote || '',r.reviewedAt?.toISOString() || '',!!r.proof,r.location?.distanceMeters ?? '',r.location?.accuracy ?? '']);
  res.set('Cache-Control','private, no-store');await Audit.create({actor:req.user._id,action:'form.export',target:form.id});res.json({title:form.title,columns,rows,exportedAt:new Date().toISOString()});
 });
 router.patch('/forms/:id/responses/:responseId/review',async(req,res)=>{
  const form=await load(req.params.id,req.user,{manage:true});validateId(req.params.responseId);const {status,note=''}=req.body || {};
  if(!['approved','rejected'].includes(status) || typeof note!=='string' || note.length>1000)fail(400,'Choose approve or reject and a note up to 1,000 characters.');
  const response=await FormResponse.findOneAndUpdate({_id:req.params.responseId,form:form.id,status:'pending'},{$set:{status:'reviewing'}},{returnDocument:'after'});if(!response)fail(409,'This response has already been reviewed.');
  try {
   if(status==='approved' && form.requireProof) {
    // Challenges expire after submission; retain the private capture record so
    // faculty can review later, while legacy file uploads cannot be approved.
    const evidence=await FormProof.findOne({_id:response.proof,form:form.id,owner:response.user,response:response.id,source:'camera',captureChallenge:{$ne:null},capturedAt:{$lte:response.createdAt},captureExpiresAt:{$gte:response.createdAt}});
    if(!evidence)fail(409,'This response lacks a fresh camera capture recorded at submission.');
   }
   if(status==='approved' && form.checkIn) {
    const event=await linkedEvent(req.user,form);if(!event || event.archivedAt || ['cancelled','completed'].includes(event.status))fail(409,'This event is no longer accepting check-in.');
    if(!response.location || (form.requireProof && !response.proof))fail(409,'This response lacks required check-in evidence.');
    const ticket=await Registration.findOneAndUpdate({_id:response.registration,user:response.user,event:form.eventId,status:'registered'},{$set:{status:'attended',attendanceTime:new Date(),attendanceMarkedBy:req.user._id,checkInMethod:'manual',locationVerified:true,checkInProofResponse:response._id},$unset:{qrToken:1}},{returnDocument:'after'});
    // Reconcile a partial write without consuming a second ticket or accepting another response.
    if(!ticket && !await Registration.exists({_id:response.registration,user:response.user,event:form.eventId,status:'attended',checkInProofResponse:response._id}))fail(409,'The event ticket is no longer active or was already checked in.');
   }
   response.status=status;response.reviewNote=note.trim();response.reviewedBy=req.user._id;response.reviewedAt=new Date();await response.save();
  }catch(error){await FormResponse.updateOne({_id:response.id,status:'reviewing'},{$set:{status:'pending'}});throw error;}
  await Audit.create({actor:req.user._id,action:'form.review.'+status,target:response.id});res.json(serializeResponse(response));
 });
}
