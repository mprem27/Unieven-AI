import {duplicateKey} from '../security.js';
import Event from '../../models/Event.js';
import Registration from '../../models/EventRegistration.js';
import {EventDelivery} from '../models/event-extra.js';
import {eventStartsAt} from './event-time.js';
import {eventEmail} from './mail.js';
export async function queueRegistrationReceipt(ticket){
 if(!ticket || !['registered','attended'].includes(ticket.status))return null;
 try{return await EventDelivery.findOneAndUpdate({registration:ticket._id ?? ticket.id,kind:'receipt'},{$setOnInsert:{event:ticket.event?._id ?? ticket.event,status:'queued',nextAttemptAt:new Date()}},{upsert:true,returnDocument:'after'});}catch(error){if(!duplicateKey(error))throw error;return EventDelivery.findOne({registration:ticket._id ?? ticket.id,kind:'receipt'});}
}
export async function sendRegistrationReceipt({ticket,mail,now=new Date()}){await queueRegistrationReceipt(ticket);return processEventReceipts({mail,now});}
function isConfigured(mail){return !!mail?.send && mail.configured!==false;}
async function processDeliveries(kind,{mail,now=new Date(),limit=50}){
 if(!isConfigured(mail))return {sent:0,failed:0,configured:false};
 let sent=0,failed=0;
 for(let i=0;i<limit;i++){
  const item=await EventDelivery.findOneAndUpdate({kind,$or:[{status:'queued',nextAttemptAt:{$lte:now}},{status:'sending',lockedUntil:{$lte:now}}]},{$set:{status:'sending',lockedUntil:new Date(now.getTime()+120000)},$inc:{attempts:1}},{sort:{nextAttemptAt:1},returnDocument:'after'});
  if(!item)break;
  try{
   const ticket=await Registration.findById(item.registration).populate('event').populate('user','name email');
   const event=ticket?.event;
   if(!ticket || !event || !['registered','attended'].includes(ticket.status) || (kind==='reminder' && (event.archivedAt || event.status!=='upcoming'))){await EventDelivery.updateOne({_id:item._id},{$set:{status:'cancelled',lockedUntil:null}});continue;}
   const to=ticket.email || ticket.user?.email;
   if(!to || /@portal\.invalid$/i.test(to)){await EventDelivery.updateOne({_id:item._id},{$set:{status:'failed',lastError:'No deliverable account email',lockedUntil:null}});failed++;continue;}
   const when=eventStartsAt(event).toLocaleString('en-IN',{timeZone:'Asia/Kolkata',dateStyle:'medium',timeStyle:'short'});
   await mail.send({to,...eventEmail({kind,name:ticket.user?.name || 'student',title:event.title,when:`${when} IST`,location:event.location,registrationId:ticket.id,amountPaise:ticket.amountPaise,paymentId:ticket.paymentId,appUrl:process.env.CAMPUS_PUBLIC_URL,cancelled:!!event.archivedAt || event.status==='cancelled'})});
   await EventDelivery.updateOne({_id:item._id},{$set:{status:'sent',sentAt:now,lockedUntil:null,lastError:''}});sent++;
  }catch(_error){await EventDelivery.updateOne({_id:item._id},{$set:{status:item.attempts>=8?'failed':'queued',lockedUntil:null,nextAttemptAt:new Date(now.getTime()+Math.min(3600000,60000*2**Math.min(item.attempts,6))),lastError:'Delivery failed; retry scheduled'}});failed++;}
 }
 return {sent,failed,configured:true};
}
export async function processEventReceipts(options={}){
 // Recover a confirmed ticket even if the API process stopped before queuing its receipt.
 const missing=await Registration.aggregate([{$match:{status:{$in:['registered','attended']}}},{$lookup:{from:EventDelivery.collection.name,let:{registration:'$_id'},pipeline:[{$match:{$expr:{$and:[{$eq:['$registration','$$registration']},{$eq:['$kind','receipt']}]}}},{$limit:1}],as:'_receipt'}},{$match:{'_receipt.0':{$exists:false}}},{$limit:100},{$project:{_id:1,event:1,status:1}}]);
 for(const ticket of missing)await queueRegistrationReceipt(ticket);
 return processDeliveries('receipt',options);
}
export async function processEventReminders({mail,now=new Date(),limit=50}={}){
 const events=await Event.find({status:'upcoming',archivedAt:null,date:{$gte:new Date(now.getTime()-86400000),$lte:new Date(now.getTime()+2*86400000)}});
 for(const event of events){let start;try{start=eventStartsAt(event);}catch{continue;}if(start<=now || start>new Date(now.getTime()+24*3600000))continue;const tickets=await Registration.find({event:event._id,status:'registered'}).select('_id');for(const t of tickets)try{await EventDelivery.updateOne({registration:t._id,kind:'reminder'},{$setOnInsert:{event:event._id,status:'queued',nextAttemptAt:now}},{upsert:true});}catch(error){if(!duplicateKey(error))throw error;}}
 return processDeliveries('reminder',{mail,now,limit});
}
