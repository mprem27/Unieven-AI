import Event from '../../models/Event.js';
import User from '../../models/User.js';
import Registration from '../../models/EventRegistration.js';
import {EventStaffGrant} from '../models/event-staff.js';
import {Audit} from '../models.js';
import {canManageEvent,publicUser} from '../policy.js';
import {eventCapability} from '../services/event-operations.js';
import {requireAdminAction} from '../services/admin-access.js';
import {campusRole} from '../policy.js';
import {hasAdminAction} from '../../../../shared/admin-access.mjs';
import {fail,validateId} from '../security.js';
export function registerEventOperations(router,config){
 async function managed(req){if(campusRole(req.user)==='admin')requireAdminAction(req.user,'events',['GET','HEAD'].includes(req.method)?'view':req.method==='DELETE'?'delete':'update');const event=await Event.findById(validateId(req.params.id));if(!event)fail(404,'Event not found.');if(!canManageEvent(req.user,event))fail(403,'Event manager access required.');return event;}
 router.get('/event-operations',config.auth,async(req,res)=>{
  const events=await Event.find({archivedAt:null}).sort({date:1}).limit(300).lean(),visible=[];
  for(const event of events)if(await eventCapability(req.user,event,'view'))visible.push({...event,id:String(event._id)});
  res.json({events:visible});
 });
 router.get('/events/:id/operations',config.auth,async(req,res)=>{
  const event=await Event.findById(validateId(req.params.id));if(!event)fail(404,'Event not found.');if(!await eventCapability(req.user,event,'view'))fail(403,'An event operations assignment is required.');
  const participants=await Registration.find({event:event._id}).select('-qrToken -qrCode -paymentOrderId -paymentId').populate('user','name username image').sort({createdAt:-1}).limit(5000).lean();
  const capabilities={};for(const key of ['qr','manual','email'])capabilities[key]=await eventCapability(req.user,event,key);
  res.json({event:{...event.toObject(),id:event.id},participants:participants.map(row=>({...row,id:String(row._id)})),capabilities,canManage:canManageEvent(req.user,event),canAssignStaff:canManageEvent(req.user,event) && (campusRole(req.user)!=='admin' || hasAdminAction(req.user,'events','update')),canRevokeStaff:canManageEvent(req.user,event) && (campusRole(req.user)!=='admin' || hasAdminAction(req.user,'events','delete'))});
 });
 router.get('/events/:id/staff',config.auth,async(req,res)=>{
  const event=await managed(req);const rows=await EventStaffGrant.find({event:event._id,active:true}).populate('user','name username email role isActive').lean();
  const choices=await User.find({isActive:{$ne:false},role:{$in:['faculty','admin']}}).select('name username email role').sort({name:1}).limit(500).lean();
  res.json({staff:rows.map(row=>({id:String(row._id),user:row.user?publicUser(row.user):null,capabilities:row.capabilities})),choices:choices.map(publicUser)});
 });
 router.put('/events/:id/staff',config.auth,async(req,res)=>{
  const event=await managed(req);if(event.archivedAt)fail(409,'Archived event assignments cannot change.');
  const target=await User.findById(validateId(req.body.userId));if(!target || target.isActive===false)fail(404,'Choose an active campus account.');
  if(!['faculty','admin'].includes(target.role))fail(400,'Choose an active faculty or administrator account.');
  const input=req.body.capabilities;if(!input || typeof input!=='object' || Array.isArray(input) || Object.entries(input).some(([key,value])=>!['qr','manual','email'].includes(key) || typeof value!=='boolean'))fail(400,'Choose valid scanner, manual check-in and email capabilities.');
  const capabilities=Object.fromEntries(['qr','manual','email'].map(key=>[key,input[key]===true]));
  for(const [key,enabled] of Object.entries(capabilities))if(enabled && !await eventCapability(req.user,event,key))fail(403,'You cannot delegate an event capability you do not hold.');
  const row=await EventStaffGrant.findOneAndUpdate({event:event._id,user:target._id},{$set:{capabilities,active:Object.values(capabilities).some(Boolean),grantedBy:req.user._id}},{upsert:true,returnDocument:'after'});
  await User.updateOne({_id:target._id},{$set:{hasEventAssignment:!!await EventStaffGrant.exists({user:target._id,active:true})}});
  await Audit.create({actor:req.user._id,action:'event.staff.assign',target:event.id,details:JSON.stringify({user:target.id,capabilities})});res.json({id:row.id,userId:target.id,capabilities});
 });
 router.delete('/events/:id/staff/:userId',config.auth,async(req,res)=>{
  const event=await managed(req),user=validateId(req.params.userId);await EventStaffGrant.updateOne({event:event._id,user},{$set:{active:false}});await User.updateOne({_id:user},{$set:{hasEventAssignment:!!await EventStaffGrant.exists({user,active:true})}});await Audit.create({actor:req.user._id,action:'event.staff.revoke',target:event.id,details:user});res.json({revoked:true});
 });
}
