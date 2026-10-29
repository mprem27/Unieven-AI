import {duplicateKey} from '../security.js';
import {eventExpired} from './event-publication.js';
import {eventCapability} from './event-operations.js';
import Event from '../../models/Event.js';
import Registration from '../../models/EventRegistration.js';
import QRCode from 'qrcode';
import {canCheckInEvent} from '../policy.js';
import {fail,newToken,validateId} from '../security.js';
import {eventStartsAt} from './event-time.js';
import {cancelEventWaitlist} from '../models/event-extra.js';

function ticketFields(event) {
  return {qrToken:newToken(),qrExpiresAt:new Date(eventStartsAt(event).getTime()+86400000)};
}
function readyTicket(ticket) {
  if(!ticket || (ticket.status==='payment_pending' && !ticket.paymentOrderId)) fail(409,'Your registration is being prepared. Retry shortly.');
  return ticket;
}
export async function registerForEvent(user,eventId,provider,details={}) {
  validateId(eventId);
  const event=await Event.findById(eventId);
  if (!event) fail(404,'Event not found');
  if (eventExpired(event) || event.archivedAt || event.status !== 'upcoming' || eventStartsAt(event) < new Date() || (event.deadline && event.deadline < new Date())) fail(409,'Registration is closed');
  if(!details || typeof details!=='object' || Array.isArray(details))fail(400,'Enter valid registration details');
  for(const key of ['studentId','department','phone','degree','collegeName'])if(details[key]!==undefined && (typeof details[key]!=='string' || details[key].length>250))fail(400,'Enter valid registration details');
  if(details.yearOfStudy!==undefined && details.yearOfStudy!==null && (!Number.isInteger(details.yearOfStudy)||details.yearOfStudy<1||details.yearOfStudy>8))fail(400,'Choose a valid year of study');
  const userId=String(user._id ?? user.id);
  let ticket=await Registration.findOne({user:userId,event:eventId});
  if (ticket && ticket.status !== 'cancelled') return readyTicket(ticket);
  if(event.rules?.length && details.acceptEventRules!==true)fail(400,'Accept the published event rules before registering.');
  // Paid cancellation requires a staff refund workflow rather than silent reuse.
  if (ticket?.paymentId) fail(409,'Contact the organizer about this paid registration');
  if (ticket) await Registration.deleteOne({_id:ticket._id,status:'cancelled'});
  try {
    ticket=await Registration.create({user:userId,event:eventId,studentId:user.studentId || details.studentId || user.username,department:user.department || details.department || 'Not specified',email:user.email,phone:user.phone || details.phone || 'Not provided',degree:details.degree || '',yearOfStudy:details.yearOfStudy || null,collegeName:details.collegeName || '',status:'payment_pending',amountPaise:event.pricePaise || 0,currency:'INR'});
  } catch(error) {
    if(duplicateKey(error)) return readyTicket(await Registration.findOne({user:userId,event:eventId}));
    throw error;
  }
  let reserved=false;
  try {
    const now=new Date();
    const available=await Event.findOneAndUpdate({_id:eventId,status:'upcoming',archivedAt:null,date:event.date,time:event.time,$and:[{$or:[{deadline:null},{deadline:{$gte:now}}]},{$or:[{expiresAt:null},{expiresAt:{$gt:now}}]}],$expr:{$lt:[{$ifNull:['$registrationCount',0]},{$ifNull:['$capacity',500]}]}},{$inc:{registrationCount:1},$set:{ticketHistory:true}},{returnDocument:'after'});
    if(!available) fail(409,'This event is full or registration has closed');
    reserved=true;ticket.reserved=true;
    ticket.amountPaise=available.pricePaise || 0;
    if(eventStartsAt(available)<=now)fail(409,'Registration is closed');
    if(available.pricePaise>0) {
      const order=await provider.createOrder({amount:available.pricePaise,currency:'INR',receipt:ticket.id});
      if(!order?.id || order.amount !== available.pricePaise || order.currency !== 'INR') fail(502,'Payment provider returned an invalid order');
      ticket.paymentOrderId=order.id;
    } else {
      ticket.status='registered';Object.assign(ticket,ticketFields(available));
      ticket.qrCode=await QRCode.toDataURL(JSON.stringify({registrationId:ticket.id,eventId,qrToken:ticket.qrToken}));
    }
    await ticket.save();
  } catch(error) {
    if(reserved) await Event.updateOne({_id:eventId,registrationCount:{$gt:0}},{$inc:{registrationCount:-1}});
    await Registration.deleteOne({_id:ticket._id});throw error;
  }
  // Waitlist bookkeeping must never roll back an already issued ticket or payment order.
  await cancelEventWaitlist(userId,eventId);return ticket;
}
export async function checkIn(user,registrationId,qrToken,note='') {
  validateId(registrationId);if(typeof note!=='string' || note.length>500)fail(400,'Use a manual check-in note under 500 characters.');
  const ticket=await Registration.findById(registrationId);
  if(!ticket) fail(404,'Ticket not found');
  const event=await Event.findById(ticket.event);
  if(!await eventCapability(user,event,qrToken?'qr':'manual')) fail(403,'You cannot check in participants for this event');
  if(ticket.status !== 'registered') fail(409,'Ticket is not active or has already been checked in');
  const expiry=ticket.qrExpiresAt || ((!event.scope || event.scope==='legacy')?new Date(eventStartsAt(event).getTime()+86400000):null);
  if(qrToken && (typeof qrToken!=='string' || qrToken!==ticket.qrToken || !expiry || !Number.isFinite(expiry.getTime()) || expiry < new Date())) fail(400,'Invalid or expired QR code');
  if(eventExpired(event) || event.archivedAt || ['cancelled','completed'].includes(event.status)) fail(409,'Event was cancelled');
  const updated=await Registration.findOneAndUpdate({_id:registrationId,status:'registered'},{$set:{status:'attended',attendanceTime:new Date(),attendanceMarkedBy:user._id ?? user.id,checkInMethod:qrToken?'qr':'manual',manualCheckInNote:qrToken?'':note.trim()}},{returnDocument:'after'});
  if(!updated) fail(409,'Ticket has already been checked in');
  return updated;
}
export async function confirmPayment(payment) {
  if(!payment || typeof payment.order_id!=='string' || !payment.order_id || payment.order_id.length>200 || typeof payment.id!=='string' || !payment.id || payment.id.length>200 || !Number.isSafeInteger(payment.amount) || payment.amount<1) fail(400,'Invalid captured payment');
  const ticket=await Registration.findOne({paymentOrderId:payment.order_id});
  if(!ticket) return null;
  if(payment.status!=='captured' || payment.currency!==ticket.currency || payment.amount!==ticket.amountPaise) fail(400,'Payment amount, currency or status does not match the order');
  if(ticket.status==='registered' || ticket.status==='attended') {
    if(ticket.paymentId!==payment.id) fail(409,'The order already has a different payment');
    return ticket;
  }
  if(ticket.status!=='payment_pending') fail(409,'The registration is no longer active');
  const event=await Event.findById(ticket.event);if(!event || event.archivedAt || event.status==='cancelled') fail(409,'Contact the organizer to resolve this payment');
  const fields=ticketFields(event);
  const qrCode=await QRCode.toDataURL(JSON.stringify({registrationId:ticket.id,eventId:String(ticket.event),qrToken:fields.qrToken}));
  let confirmed;
  try {confirmed=await Registration.findOneAndUpdate({_id:ticket._id,status:'payment_pending'},{$set:{status:'registered',paymentId:payment.id,...fields,qrCode}},{returnDocument:'after'});}
  catch(error) {if(duplicateKey(error)) fail(409,'This payment has already funded another registration');throw error;}
  if(confirmed) return confirmed;
  const existing=await Registration.findById(ticket._id);
  if(existing && ['registered','attended'].includes(existing.status) && existing.paymentId===payment.id) return existing;
  fail(409,'The order was updated by another payment or is no longer active');
}
export async function cancelRegistration(user,ticketId) {
  validateId(ticketId);
  const ticket=await Registration.findOne({_id:ticketId,user:user._id ?? user.id});
  if(!ticket) fail(404,'Ticket not found');
  if(ticket.paymentOrderId) fail(409,'Paid orders require organizer assistance to cancel or refund');
  const updated=await Registration.findOneAndUpdate({_id:ticketId,status:'registered'},{$set:{status:'cancelled',reserved:false}},{returnDocument:'after'});
  if(!updated) fail(409,'Ticket cannot be cancelled');
  if(ticket.reserved) await Event.updateOne({_id:ticket.event,registrationCount:{$gt:0}},{$inc:{registrationCount:-1}});
  return updated;
}
