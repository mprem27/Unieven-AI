import {duplicateKey} from '../security.js';
import {activeEventQuery,eventExpired,eventPublicationInput,publishEventPost} from '../services/event-publication.js';
import {AppPolicy} from '../models/app-policy.js';
import {requireAdminAction} from '../services/admin-access.js';
import {eventRulesInput} from '../services/event-operations.js';
import Event from '../../models/Event.js';
import Registration from '../../models/EventRegistration.js';
import {Audit} from '../models.js';
import {canManageEvent} from '../policy.js';
import {fail,validateId} from '../security.js';
import {checkIn} from '../services/registration.js';
import {EventWaitlist} from '../models/event-extra.js';
import {eventStartsAt} from '../services/event-time.js';
import {eventMedia} from '../services/event-media.js';
import {eventDetailsInput,eventForViewer,validateEventKeys} from '../services/event-details.js';
export {eventStartsAt};
async function managed(req){validateId(req.params.id);const event=await Event.findById(req.params.id);if(!event)fail(404,'Event not found');if(!canManageEvent(req.user,event))fail(403,'Organizer access required for this event');return event;}
const text=(value,max,label)=>{if(typeof value!=='string' || !value.trim() || value.length>max)fail(400,`Enter a valid ${label}`);return value.trim();};
export function registerEventExtras(router,config){
 router.get('/event-policy',config.auth,async(_req,res)=>res.json({eventExpiryMonths:(await AppPolicy.findOne({key:'events'}))?.eventExpiryMonths || 6}));
 router.put('/event-policy',config.auth,async(req,res)=>{requireAdminAction(req.user,'events','update');const months=req.body.eventExpiryMonths;if(!Number.isInteger(months) || months<1 || months>120)fail(400,'Choose 1–120 months.');await AppPolicy.findOneAndUpdate({key:'events'},{$set:{eventExpiryMonths:months,updatedBy:req.user._id}},{upsert:true});await Audit.create({actor:req.user._id,action:'event.policy-update',target:'events'});res.json({eventExpiryMonths:months});});
 router.post('/events/:id/community-post',config.auth,async(req,res)=>{const event=await managed(req);if(event.archivedAt)fail(409,'Archived events cannot be posted.');const postId=await publishEventPost(event,req.user);res.json({postId});});
 router.get('/events/:id',config.auth,async(req,res)=>{validateId(req.params.id);const event=await Event.findById(req.params.id).lean();if(!event)fail(404,'Event not found');const [recommendedEvents,ticket]=await Promise.all([Event.find({_id:{$ne:event._id},category:event.category,status:'upcoming',...activeEventQuery()}).sort({date:1}).limit(3).lean(),Registration.findOne({event:event._id,user:req.user._id}).select('status').lean()]);res.json({...eventForViewer(event,req.user,ticket?.status),id:String(event._id),canManage:canManageEvent(req.user,event),recommendedEvents:recommendedEvents.map(e=>({...eventForViewer(e,req.user),id:String(e._id)}))});});
 router.patch('/events/:id',config.auth,async(req,res)=>{
  const event=await managed(req);if(event.archivedAt)fail(409,'Archived events cannot be edited');
  const body=req.body || {};validateEventKeys(body);
  const patch={...eventRulesInput(body),...eventDetailsInput(body,{existing:event})};
  for(const key of ['title','location','category'])if(body[key]!==undefined)patch[key]=text(body[key],key==='title'?150:key==='location'?250:80,key);
  if(body.description!==undefined){if(typeof body.description!=='string' || body.description.length>5000)fail(400,'Description is too long');patch.description=body.description.trim();}
  if(body.capacity!==undefined){if(!Number.isInteger(body.capacity)||body.capacity<1||body.capacity>100000)fail(400,'Choose a valid capacity');patch.capacity=body.capacity;}
  if(body.pricePaise!==undefined){if(!Number.isInteger(body.pricePaise)||body.pricePaise<0||body.pricePaise>10000000)fail(400,'Choose a valid price');patch.pricePaise=body.pricePaise;}
  if(body.date!==undefined){if(typeof body.date!=='string'||!Number.isFinite(new Date(body.date).getTime()))fail(400,'Choose a valid date');patch.date=new Date(body.date);}
  if(body.time!==undefined){if(typeof body.time!=='string'||!/^([01]\d|2[0-3]):[0-5]\d$/.test(body.time))fail(400,'Choose a valid time');patch.time=body.time;}
  const start=eventStartsAt({...event.toObject(),...patch});
  Object.assign(patch,await eventPublicationInput(body,start,{existing:event}));
  if(patch.expiresAt===undefined && event.expiresAt && new Date(event.expiresAt)<=start)fail(400,'Move expiry after the updated event time.');
  if((body.date!==undefined || body.time!==undefined) && start<=new Date())fail(400,'Choose a future event date and time');
  if(body.date!==undefined || body.time!==undefined)patch.startsAt=start;
  if(body.deadline!==undefined){if(body.deadline!==null && (typeof body.deadline!=='string' || !Number.isFinite(new Date(body.deadline).getTime())))fail(400,'Choose a valid registration deadline');patch.deadline=body.deadline?new Date(body.deadline):null;}
  const deadline=Object.hasOwn(patch,'deadline')?patch.deadline:event.deadline;
  if(deadline && new Date(deadline)>start)fail(400,'Registration deadline must be before the event');
  for(const key of ['image','video'])if(body[key]!==undefined)patch[key]=await eventMedia(req.user,body[key],{kind:key==='video'?'video':'image',previous:event[key]});
  const query={_id:event._id,archivedAt:null};
  if(patch.pricePaise!==undefined)query.pricePaise=event.pricePaise;
  if(patch.pricePaise!==undefined && patch.pricePaise!==event.pricePaise){if(await Registration.exists({event:event._id}))fail(409,'Price cannot change after a ticket has been created');query.ticketHistory={$ne:true};}
  if(patch.capacity!==undefined)query.$expr={$lte:[{$ifNull:['$registrationCount',0]},patch.capacity]};
  const updated=await Event.findOneAndUpdate(query,{$set:patch},{returnDocument:'after',runValidators:true});
  if(!updated)fail(409,'The event changed while editing; capacity cannot be below reserved seats and ticket prices must be retained');
  await Audit.create({actor:req.user._id,action:'event.edit',target:event.id,details:Object.keys(patch).join(',')});res.json({...updated.toObject(),id:updated.id});
 });
 router.delete('/events/:id',config.auth,async(req,res)=>{const event=await managed(req);const archived=await Event.findOneAndUpdate({_id:event._id,archivedAt:null},{$set:{archivedAt:new Date(),status:'cancelled'}},{returnDocument:'after'});if(archived)await Audit.create({actor:req.user._id,action:'event.archive',target:event.id});res.json({id:event.id,archived:true,historyRetained:true});});
 router.get('/events/:id/analytics',config.auth,async(req,res)=>{
  const event=await managed(req),tickets=await Registration.find({event:event._id}).select('status department amountPaise paymentId'),active=tickets.filter(t=>['registered','attended'].includes(t.status)),attended=active.filter(t=>t.status==='attended');
  const departmentStats={};for(const t of active){const key=t.department || 'Not specified';Object.defineProperty(departmentStats,key,{value:(Object.hasOwn(departmentStats,key)?departmentStats[key]:0)+1,writable:true,enumerable:true,configurable:true});}
  res.json({eventId:event.id,totalRegistered:active.length,totalAttended:attended.length,attendanceRate:active.length?Math.round(attended.length/active.length*10000)/100:0,paymentPending:tickets.filter(t=>t.status==='payment_pending').length,cancelled:tickets.filter(t=>t.status==='cancelled').length,capacity:event.capacity,reserved:event.registrationCount,remainingSeats:Math.max(0,event.capacity-event.registrationCount),revenuePaise:active.filter(t=>t.paymentId).reduce((sum,t)=>sum+t.amountPaise,0),departmentStats,waitlisted:await EventWaitlist.countDocuments({event:event._id,status:'waiting'}),archived:!!event.archivedAt});
 });
 router.get('/events/:id/waitlist',config.auth,async(req,res)=>{validateId(req.params.id);const event=await Event.findById(req.params.id);if(!event)fail(404,'Event not found');const own=await EventWaitlist.findOne({event:event._id,user:req.user._id,status:'waiting'}).lean();const result={waiting:!!own,id:own?String(own._id):null,count:await EventWaitlist.countDocuments({event:event._id,status:'waiting'})};if(canManageEvent(req.user,event))result.entries=(await EventWaitlist.find({event:event._id,status:'waiting'}).populate('user','name username').sort({createdAt:1}).limit(500).lean()).map(e=>({...e,id:String(e._id)}));res.json(result);});
 router.post('/events/:id/waitlist',config.auth,async(req,res)=>{validateId(req.params.id);const event=await Event.findById(req.params.id);if(!event)fail(404,'Event not found');if(eventExpired(event) || event.archivedAt || event.status!=='upcoming' || eventStartsAt(event)<=new Date() || (event.deadline && event.deadline<new Date()))fail(409,'The waitlist is closed');if(await Registration.exists({event:event._id,user:req.user._id,status:{$in:['registered','attended','payment_pending']}}))fail(409,'You already have a registration');if(event.registrationCount<event.capacity)fail(409,'Seats are available; register directly');let entry;try{entry=await EventWaitlist.findOneAndUpdate({event:event._id,user:req.user._id},{$set:{status:'waiting'}},{upsert:true,returnDocument:'after'});}catch(e){if(!duplicateKey(e))throw e;entry=await EventWaitlist.findOne({event:event._id,user:req.user._id});}res.json({id:entry.id,waiting:true,notice:'Joining the waitlist does not reserve a ticket. Check this event for released seats.'});});
 router.delete('/events/:id/waitlist',config.auth,async(req,res)=>{validateId(req.params.id);await EventWaitlist.updateOne({event:req.params.id,user:req.user._id},{$set:{status:'cancelled'}});res.json({waiting:false});});
 router.post('/registrations/:id/check-in',config.auth,async(req,res)=>{const ticket=await checkIn(req.user,req.params.id,undefined,req.body?.note || '');await Audit.create({actor:req.user._id,action:'event.manual-check-in',target:ticket.id});res.json({id:ticket.id,status:ticket.status});});
}
