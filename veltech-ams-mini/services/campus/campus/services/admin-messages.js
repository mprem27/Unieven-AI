import {sameDepartment,departmentQuery} from '../../../../shared/publishing-directory.mjs';
import {resolvePublishingValue} from './publishing-directory.js';
import {duplicateKey} from '../security.js';
import {hasAdminAction} from '../../../../shared/admin-access.mjs';
import crypto from 'node:crypto';
import User from '../../models/User.js';
import Event from '../../models/Event.js';
import Registration from '../../models/EventRegistration.js';
import {AdminMessage,AdminDelivery} from '../models/admin-messages.js';
import {Audit} from '../models.js';
import {campusRole} from '../policy.js';
import {requireAdminAction} from './admin-access.js';
import {eventCapability} from './event-operations.js';
import {createNotification} from './notifications.js';
import {announcementEmail} from './mail-templates.js';
import {fail,validateId} from '../security.js';
const email=value=>typeof value==='string' && value.length<=254 && /^[^\s@,;<>\r\n]+@[^\s@,;<>\r\n]+\.[^\s@,;<>\r\n]+$/.test(value);
export function accountEmail(user){
 const principal=user?.portalPrincipalVerifiedAt && /^vtu\d{3,12}$/i.test(user.portalPrincipal || '')?user.portalPrincipal.toLowerCase():'';
 const value=user?.recoveryEmailVerifiedAt && user.recoveryEmail?user.recoveryEmail:principal?principal+'@veltech.edu.in':user?.email;
 return email(value) && !/\.invalid$/i.test(value)?value.toLowerCase():'';
}
const person=user=>({user:user._id,to:accountEmail(user)});
async function recipientsFor(actor,audience){
 if(!audience || typeof audience!=='object' || Array.isArray(audience) || Object.keys(audience).some(key=>!['kind','department','eventId','status','emails'].includes(key)))fail(400,'Choose a supported message audience.');
 const kind=audience.kind,admin=campusRole(actor)==='admin',faculty=actor.role==='faculty' && !!actor.department?.trim();
 if(admin)requireAdminAction(actor,'communications','create');
 const query={isActive:{$ne:false}};
 if(kind==='event'){
  const event=await Event.findById(validateId(audience.eventId));if(!event)fail(404,'Event not found.');if(!await eventCapability(actor,event,'email'))fail(403,'Event email access is required.');
  if(!['active','registered','attended'].includes(audience.status || 'active'))fail(400,'Choose registered, attended or active participants.');
  const tickets=await Registration.find({event:event._id,status:audience.status && audience.status!=='active'?audience.status:{$in:['registered','attended']}}).select('user').limit(5001).lean();query._id={$in:tickets.map(row=>row.user)};
 }else if(kind==='department'){
  if(typeof audience.department!=='string' || !audience.department.trim() || audience.department.length>120)fail(400,'Choose a department.');
  audience.department=await resolvePublishingValue('department',audience.department,{user:actor,allowBlank:false});
  if(!admin && (!faculty || !sameDepartment(actor.department,audience.department)))fail(403,'Faculty messages are limited to the assigned department.');query.role='student';query.department=departmentQuery(audience.department);
 }else if(kind==='all-students' || kind==='all-members'){
  if(!admin)fail(403,'A college administrator is required for this audience.');if(kind==='all-students')query.role='student';
 }else if(kind==='emails'){
  if(!admin)fail(403,'Administrator access is required for an external address list.');
  if(!Array.isArray(audience.emails) || !audience.emails.length || audience.emails.length>500 || audience.emails.some(value=>!email(value)))fail(400,'Enter up to 500 valid individual email addresses.');
  return [...new Set(audience.emails.map(value=>value.trim().toLowerCase()))].sort().map(to=>({to}));
 }else fail(400,'Choose a supported message audience.');
 if(!admin && !faculty && kind!=='event')fail(403,'Staff messaging access required.');
 const users=await User.find(query).select('email recoveryEmail recoveryEmailVerifiedAt portalPrincipal portalPrincipalVerifiedAt').limit(5001).lean();
 if(users.length>5000)fail(400,'This audience exceeds 5,000 recipients. Send to smaller departments or events.');
 return users.map(person);
}
export const campaignView=(row,mail)=>({id:String(row._id),title:row.title,body:row.body,audience:row.audience,kind:row.kind,email:row.email,inApp:row.inApp,state:row.state,recipientCount:row.recipientCount || 0,createdAt:row.createdAt,mailConfigured:!!mail?.configured});
export async function prepareCampaign({actor,requestId,title,body,audience,email:sendEmail=true,inApp=true,kind='announcement',directRecipients,mail}){
 if(typeof requestId!=='string' || !/^[a-zA-Z0-9_.:-]{12,150}$/.test(requestId) || typeof title!=='string' || !title.trim() || title.length>160 || /[\r\n]/.test(title) || typeof body!=='string' || !body.trim() || body.length>6000 || typeof sendEmail!=='boolean' || typeof inApp!=='boolean' || !sendEmail && !inApp)fail(400,'Enter a title, message, delivery channels and valid request ID.');
 if(audience?.kind==='emails' && !sendEmail)fail(400,'External addresses require email delivery.');
 const recipients=directRecipients || await recipientsFor(actor,audience),normal={title:title.trim(),body:body.trim(),audience,email:sendEmail,inApp,kind};
 const fingerprint=crypto.createHash('sha256').update(JSON.stringify(normal)).digest('hex');
 let row=await AdminMessage.findOne({actor:actor._id,requestId}).select('+recipientPlan'),reused=!!row;
 if(row && row.fingerprint!==fingerprint)fail(409,'That request ID already belongs to a different message.');
 if(!row){
  if(!recipients.length)fail(400,'No active recipients match this audience.');
  try{row=await AdminMessage.create({actor:actor._id,requestId,fingerprint,...normal,recipientCount:recipients.length,recipientPlan:recipients,state:'preparing'});}
  catch(error){if(!duplicateKey(error))throw error;row=await AdminMessage.findOne({actor:actor._id,requestId}).select('+recipientPlan');reused=true;if(row.fingerprint!==fingerprint)fail(409,'That request ID already belongs to a different message.');}
 }
 if(row.state==='preparing'){
  const plan=row.recipientPlan || recipients;
  await AdminDelivery.bulkWrite(plan.map(recipient=>{const recipientKey=recipient.user?'user:'+recipient.user:'email:'+recipient.to;return {updateOne:{filter:{campaign:row._id,recipientKey},update:{$setOnInsert:{...recipient,campaign:row._id,recipientKey,status:'queued',nextAttemptAt:new Date(),attempts:0}},upsert:true}};}),{ordered:false});
  row=await AdminMessage.findOneAndUpdate({_id:row._id,state:'preparing'},{$set:{state:'queued'}},{returnDocument:'after'}) || await AdminMessage.findById(row._id);
  await Audit.create({actor:actor._id,action:'message.queue',target:row.id,details:JSON.stringify({kind,recipientCount:row.recipientCount})});
 }
 return {...campaignView(row,mail),reused};
}
export async function processAdminDeliveries({mail,now=new Date(),limit=25}={}){
 let sent=0,failed=0,notifications=0;
 for(let index=0;index<limit;index++){
  const lease=crypto.randomUUID(),item=await AdminDelivery.findOneAndUpdate({$or:[{status:'queued',nextAttemptAt:{$lte:now}},{status:'sending',lockedUntil:{$lte:now}}]},{$set:{status:'sending',leaseToken:lease,lockedUntil:new Date(+now+120000)}},{sort:{nextAttemptAt:1},returnDocument:'after'});
  if(!item)break;
  const owned={_id:item._id,leaseToken:lease};
  try{
   const campaign=await AdminMessage.findById(item.campaign);
   if(!campaign || campaign.state==='cancelled'){await AdminDelivery.updateOne(owned,{$set:{status:'cancelled',lockedUntil:null}});continue;}
   if(campaign.kind==='announcement'){
    const actor=await User.findById(campaign.actor),audience=campaign.audience || {};let allowed=!!actor && actor.isActive!==false;
    if(allowed && campusRole(actor)==='admin')allowed=hasAdminAction(actor,'communications','create');
    else if(allowed && audience.kind==='event'){const event=await Event.findById(audience.eventId);allowed=await eventCapability(actor,event,'email');}
    else if(allowed)allowed=actor.role==='faculty' && audience.kind==='department' && sameDepartment(actor.department,audience.department);
    if(!allowed){await AdminDelivery.updateOne(owned,{$set:{status:'cancelled',lockedUntil:null,lastError:'Sender access was revoked or the audience is no longer assigned.'}});continue;}
   }
   const user=item.user?await User.findById(item.user):null;
   if(item.user && (!user || user.isActive===false) && campaign.kind!=='moderation'){await AdminDelivery.updateOne(owned,{$set:{status:'cancelled',lockedUntil:null,lastError:'Account is no longer active.'}});continue;}
   if(campaign.inApp && user && !item.notificationSent){
    await createNotification({toUser:user._id,fromUser:campaign.actor,type:campaign.kind==='moderation'?'moderation':campaign.kind==='exam_update'?'exam_update':'campus_message',eventKey:'admin-message:'+campaign.id,title:campaign.title,message:campaign.body,link:'/notifications',category:campaign.kind==='moderation'?'community':'system'});
    await AdminDelivery.updateOne(owned,{$set:{notificationSent:true}});notifications++;
   }
   if(campaign.email && !item.emailSent){
    if(!mail?.configured || !mail.send){await AdminDelivery.updateOne(owned,{$set:{status:'queued',lockedUntil:null,lastError:'SMTP is not configured; email remains queued.',nextAttemptAt:new Date(+now+60000)}});continue;}
    const to=user?accountEmail(user):item.to;if(!to)throw Object.assign(new Error('No deliverable account email.'),{permanent:true});
    await AdminDelivery.updateOne(owned,{$inc:{attempts:1}});
    await mail.send({to,...announcementEmail({title:campaign.title,body:campaign.body,name:user?.name,moderation:campaign.kind==='moderation',appUrl:process.env.CAMPUS_PUBLIC_URL})});
    await AdminDelivery.updateOne(owned,{$set:{emailSent:true}});
   }
   await AdminDelivery.updateOne(owned,{$set:{status:'sent',sentAt:now,lockedUntil:null,lastError:''}});sent++;
  }catch(error){
   const attempts=item.attempts+1;
   await AdminDelivery.updateOne(owned,{$set:{status:error.permanent || attempts>=8?'failed':'queued',lockedUntil:null,nextAttemptAt:new Date(+now+Math.min(3600000,60000*2**Math.min(attempts,6))),lastError:error.permanent?'No deliverable account email.':'Email delivery failed; retry scheduled.'}});failed++;
  }
 }
 return {sent,failed,notifications,configured:!!mail?.configured};
}
