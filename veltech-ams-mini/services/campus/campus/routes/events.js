import {activeEventQuery,eventPublicationInput,publishEventPost} from '../services/event-publication.js';
import {eventRulesInput} from '../services/event-operations.js';
import Event from '../../models/Event.js';
import Registration from '../../models/EventRegistration.js';
import {Audit} from '../models.js';
import {canCreateEvent,canManageEvent,canCheckInEvent} from '../policy.js';
import {fail,validateId,checkWebhook} from '../security.js';
import {registerForEvent,checkIn,confirmPayment,cancelRegistration} from '../services/registration.js';
import {eventStartsAt} from '../services/event-time.js';
import {queueRegistrationReceipt} from '../services/event-reminders.js';
import {eventMedia} from '../services/event-media.js';
import {eventDetailsInput,eventForViewer,validateEventKeys} from '../services/event-details.js';

export function registerEvents(router,config) {
  router.get('/events',config.auth,async(req,res)=>{
    const events=await Event.find(activeEventQuery()).sort({date:1}).limit(200).lean();
    const tickets=await Registration.find({user:req.user._id}).select('event status').lean();
    res.json(events.map(e=>{const registered=tickets.find(t=>String(t.event)===String(e._id))?.status || null;return {...eventForViewer(e,req.user,registered),id:String(e._id),saved:(req.user.savedCampusEvents || []).map(String).includes(String(e._id)),registered,canManage:canManageEvent(req.user,e),canCheckIn:canCheckInEvent(req.user,e)};}));
  });
  router.put('/events/:id/save',config.auth,async(req,res)=>{
    validateId(req.params.id);if(typeof req.body.saved!=='boolean')fail(400,'Choose a bookmark state');
    if(!await Event.exists({_id:req.params.id}))fail(404,'Event not found');
    await req.user.constructor.updateOne({_id:req.user._id},req.body.saved?{$addToSet:{savedCampusEvents:req.params.id}}:{$pull:{savedCampusEvents:req.params.id}});
    res.json({saved:req.body.saved});
  });
  router.post('/events',config.auth,async(req,res)=>{
    validateEventKeys(req.body,{create:true});
    const {scope,department='',club=''}=req.body || {};
    if(!['club','department','college'].includes(scope) || typeof department!=='string' || department.length>120 || typeof club!=='string' || club.length>120) fail(400,'Choose a valid event scope, department and club');
    if(!canCreateEvent(req.user,{scope,department,club})) fail(403,'Your role cannot create events in this scope');
    const {title,description='',date,time,location,category='General',capacity=100,pricePaise=0,deadline}=req.body;
    if(typeof title!=='string' || !title.trim() || title.length>150 || typeof description!=='string' || description.length>5000 || typeof location!=='string' || !location.trim() || typeof time!=='string' || !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(time) || typeof category!=='string' || !category.trim() || category.length>80 || !Number.isInteger(capacity) || capacity<1 || capacity>100000 || !Number.isInteger(pricePaise) || pricePaise<0 || pricePaise>10000000 || !['club','department','college'].includes(scope)) fail(400,'Enter valid event details, scope, capacity and price');
    if(typeof date!=='string' || !date || !Number.isFinite(new Date(date).getTime()))fail(400,'Choose a valid event date');
    const startsAt=eventStartsAt({date,time});if(startsAt<=new Date())fail(400,'Choose a future event date and time');
    if(deadline && (typeof deadline!=='string' || !Number.isFinite(new Date(deadline).getTime()) || new Date(deadline)>startsAt)) fail(400,'Registration deadline must be before the event');
    const details=eventDetailsInput(req.body);
    const image=await eventMedia(req.user,req.body.image ?? '',{kind:'image'});
    const video=await eventMedia(req.user,req.body.video ?? '',{kind:'video'});
    const publication=await eventPublicationInput(req.body,startsAt);
    const event=await Event.create({...publication,...eventRulesInput(req.body),...details,createdBy:req.user._id,title:title.trim(),description,date,time,location,category,capacity,pricePaise,scope,department,club,deadline:deadline || null,startsAt,image,video,organizerName:req.user.name || req.user.username});
    await Audit.create({actor:req.user._id,action:'event.create',target:event.id});
    const postId=req.body.publishPost?await publishEventPost(event,req.user):null;
    res.status(201).json({...event.toObject(),id:event.id,postId});
  });
  router.post('/events/:id/register',config.auth,async(req,res)=>{
    const ticket=await registerForEvent(req.user,req.params.id,config.payment,req.body);
    await queueRegistrationReceipt(ticket);
    res.json({...ticket.toObject(),id:ticket.id,payment:ticket.status==='payment_pending' && ticket.paymentOrderId?{orderId:ticket.paymentOrderId,keyId:config.payment.keyId,amount:ticket.amountPaise,currency:ticket.currency}:null});
  });
  router.get('/registrations',config.auth,async(req,res)=>{
    const tickets=await Registration.find({user:req.user._id}).populate('event').sort({createdAt:-1});
    res.json(tickets.map(t=>({...t.toObject(),id:t.id})));
  });
  router.post('/registrations/:id/cancel',config.auth,async(req,res)=>res.json(await cancelRegistration(req.user,req.params.id)));
  router.get('/events/:id/participants',config.auth,async(req,res)=>{
    validateId(req.params.id);const event=await Event.findById(req.params.id);
    if(!canManageEvent(req.user,event)) fail(403,'Organizer access required for this event');
    const tickets=await Registration.find({event:event.id}).populate('user','name username').select('-qrToken -qrCode -paymentOrderId -paymentId').lean();
    res.json(tickets.map(t=>({...t,id:String(t._id)})));
  });
  router.post('/check-in',config.auth,async(req,res)=>{
    const {registrationId,qrToken,eventId}=req.body || {};
    if(typeof qrToken!=='string' || !qrToken || qrToken.length>128)fail(400,'A valid QR security token is required. Use manual check-in for a verified registration.');
    if(eventId!==undefined){validateId(eventId);validateId(registrationId);if(!await Registration.exists({_id:registrationId,event:eventId}))fail(400,'This ticket belongs to a different event');}
    const ticket=await checkIn(req.user,registrationId,qrToken);
    await Audit.create({actor:req.user._id,action:'event.check-in',target:ticket.id});res.json({id:ticket.id,status:ticket.status});
  });
  router.post('/payments/webhook',async(req,res)=>{
    if(!checkWebhook(req.body,req.headers['x-razorpay-signature'],config.webhookSecret)) fail(401,'Invalid webhook signature');
    let payload;try {payload=JSON.parse(req.body.toString());} catch {fail(400,'Invalid webhook payload');}
    if(!payload || typeof payload!=='object' || Array.isArray(payload) || typeof payload.event!=='string') fail(400,'Invalid webhook payload');
    if(payload.event!=='payment.captured') return res.json({received:true,ignored:true});
    const payment=payload.payload?.payment?.entity;
    if(!payment?.order_id || !payment?.id) fail(400,'Invalid captured payment');
    const ticket=await confirmPayment(payment);await queueRegistrationReceipt(ticket);res.json({received:true,confirmed:!!ticket});
  });
}
