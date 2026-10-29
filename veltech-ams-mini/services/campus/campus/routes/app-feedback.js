import {duplicateKey} from '../security.js';
import {randomUUID} from 'node:crypto';
import {AppFeedback} from '../models/app-feedback.js';
import {Audit} from '../models.js';
import {campusRole} from '../policy.js';
import {fail,validateId} from '../security.js';
import {deliverFeedbackNotifications} from '../services/notifications.js';
const statuses=['new','reviewing','planned','resolved','closed'];
function fields(value,allowed){if(!value || typeof value!=='object' || Array.isArray(value) || Object.keys(value).some(k=>!allowed.includes(k)))fail(400,'Use the feedback fields shown in this form.');}
function text(value,label,max,required=true){if(typeof value!=='string' || value.length>max || required&&!value.trim() || /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(value))fail(400,`Enter ${label} up to ${max} characters.`);return value.trim();}
function present(row){return {id:String(row._id),category:row.category,subject:row.subject,message:row.message,rating:row.rating,status:row.status,reply:row.reply || '',replyAt:row.replyAt || null,archivedAt:row.archivedAt || null,createdAt:row.createdAt,updatedAt:row.updatedAt};}
function admin(req,_res,next){if(campusRole(req.user)!=='admin')fail(403,'Administrator access required.');next();}
export function registerAppFeedback(router,config){
 router.get('/app-feedback',config.auth,async(req,res)=>{if(Object.keys(req.query).length)fail(400,'Feedback uses your signed-in account.');res.json({feedback:(await AppFeedback.find({owner:req.user._id}).sort({createdAt:-1}).limit(100).lean()).map(present)});});
 router.get('/app-feedback/manage',config.auth,admin,async(req,res)=>{
  const status=req.query.status || 'all';if(Object.keys(req.query).some(k=>k!=='status') || !['all',...statuses].includes(status))fail(400,'Choose a feedback status.');
  res.json({feedback:(await AppFeedback.find({archivedAt:null,...(status==='all'?{}:{status})}).sort({updatedAt:-1}).limit(200).lean()).map(present)});
 });
 router.post('/app-feedback',config.auth,async(req,res)=>{
  fields(req.body,['category','subject','message','rating','clientRequestId']);
  const {category,rating}=req.body;if(!['bug','idea','experience'].includes(category))fail(400,'Choose a feedback category.');
  if(rating!==undefined && (!Number.isInteger(rating) || rating<1 || rating>5))fail(400,'Choose a rating from 1 to 5.');
  const subject=text(req.body.subject,'a subject',120),message=text(req.body.message,'your feedback',3000),clientRequestId=req.body.clientRequestId ?? randomUUID();
  if(typeof clientRequestId!=='string' || !/^[A-Za-z0-9_-]{16,80}$/.test(clientRequestId))fail(400,'Retry the feedback form.');
  await AppFeedback.init();const key={owner:req.user._id,clientRequestId};
  const existing=await AppFeedback.findOne(key);if(existing)return res.json({feedback:present(existing)});
  if(await AppFeedback.countDocuments({owner:req.user._id,createdAt:{$gte:new Date(Date.now()-3600000)}})>=10)fail(429,'You have sent several suggestions. Please try again in an hour.');
  try{const row=await AppFeedback.create({...key,category,subject,message,...(rating!==undefined?{rating}:{})});res.status(201).json({feedback:present(row)});}
  catch(error){if(!duplicateKey(error))throw error;const row=await AppFeedback.findOne(key);if(!row)throw error;res.json({feedback:present(row)});}
 });
 router.delete('/app-feedback/:id',config.auth,admin,async(req,res)=>{const row=await AppFeedback.findById(validateId(req.params.id));if(!row)fail(404,'Feedback not found.');row.status='closed';row.archivedAt=new Date();row.respondedBy=req.user._id;await row.save();await Audit.create({actor:req.user._id,action:'app-feedback.archive',target:row.id});res.json({feedback:present(row)});});
 router.patch('/app-feedback/:id',config.auth,admin,async(req,res)=>{
  const id=validateId(req.params.id);fields(req.body,['status','reply']);if(!statuses.includes(req.body.status))fail(400,'Choose a feedback status.');
  const reply=text(req.body.reply ?? '','a reply',2000,false),row=await AppFeedback.findById(id);if(!row)fail(404,'Feedback not found.');
  const changed=row.status!==req.body.status || row.reply!==reply;row.status=req.body.status;
  if(row.reply!==reply){row.reply=reply;row.replyAt=reply?new Date():null;row.respondedBy=req.user._id;}
  if(changed){row.respondedBy=req.user._id;row.notificationEventKey=`feedback:${row.id}:${randomUUID()}`;row.notificationPending=true;}
  await row.save();await Audit.create({actor:req.user._id,action:'app-feedback.update',target:row.id,details:row.status});
  await deliverFeedbackNotifications(row.owner);
  res.json({feedback:present(row)});
 });
}
