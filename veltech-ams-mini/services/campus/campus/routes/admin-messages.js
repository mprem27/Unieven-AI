import {EventStaffGrant} from '../models/event-staff.js';
import {AdminMessage,AdminDelivery} from '../models/admin-messages.js';
import {prepareCampaign,campaignView} from '../services/admin-messages.js';
import {requireAdminAction} from '../services/admin-access.js';
import {campusRole} from '../policy.js';
import {Audit} from '../models.js';
import {fail,validateId} from '../security.js';
export function registerAdminMessages(router,config){
 const allowed=async(user,action='view')=>{if(campusRole(user)==='admin')requireAdminAction(user,'communications',action);else if(user.role!=='faculty' && !['club_organizer','department_coordinator','college_event_manager'].includes(campusRole(user)) && !await EventStaffGrant.exists({user:user._id,active:true,'capabilities.email':true}))fail(403,'Staff messaging access required.');};
 router.get('/admin/messages',config.auth,async(req,res)=>{
  await allowed(req.user);const query=campusRole(req.user)==='admin'?{}:{actor:req.user._id};const rows=await AdminMessage.find(query).sort({createdAt:-1}).limit(100).lean();
  const messages=[];for(const row of rows){const counts=await AdminDelivery.aggregate([{$match:{campaign:row._id}},{$group:{_id:'$status',count:{$sum:1}}}]);messages.push({...campaignView(row,config.mail),counts:Object.fromEntries(counts.map(item=>[item._id,item.count]))});}
  res.json({messages,mailConfigured:!!config.mail?.configured});
 });
 router.post('/admin/messages',config.auth,async(req,res)=>{
  if(campusRole(req.user)!=='admin' && req.body?.audience?.kind==='event'){}else await allowed(req.user,'create');
  const result=await prepareCampaign({...req.body,actor:req.user,kind:'announcement',directRecipients:undefined,mail:config.mail});res.status(result.reused?200:201).json(result);
 });
 async function editable(req,action){await allowed(req.user,action);const row=await AdminMessage.findById(validateId(req.params.id));if(!row || campusRole(req.user)!=='admin' && String(row.actor)!==String(req.user._id))fail(404,'Message not found.');return row;}
 router.get('/admin/messages/:id',config.auth,async(req,res)=>{const row=await editable(req,'view'),deliveries=await AdminDelivery.find({campaign:row._id}).select('to status notificationSent emailSent attempts lastError sentAt').sort({_id:1}).limit(100).lean();res.json({...campaignView(row,config.mail),deliveries});});
 router.delete('/admin/messages/:id',config.auth,async(req,res)=>{const row=await editable(req,'delete');await AdminMessage.updateOne({_id:row._id},{$set:{state:'cancelled'}});await AdminDelivery.updateMany({campaign:row._id,status:{$in:['queued','failed']}},{$set:{status:'cancelled'}});await Audit.create({actor:req.user._id,action:'message.cancel',target:row.id});res.json({cancelled:true});});
 router.post('/admin/messages/:id/retry',config.auth,async(req,res)=>{const row=await editable(req,'update');if(row.state==='cancelled')fail(409,'A cancelled message cannot be retried.');const result=await AdminDelivery.updateMany({campaign:row._id,status:'failed'},{$set:{status:'queued',attempts:0,nextAttemptAt:new Date()}});await Audit.create({actor:req.user._id,action:'message.retry',target:row.id});res.json({queued:result.modifiedCount});});
}
