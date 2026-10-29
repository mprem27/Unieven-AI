import test,{before,after,beforeEach} from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import Event from '../../models/Event.js';
import User from '../../models/User.js';
import Registration from '../../models/EventRegistration.js';
import {registerForEvent,checkIn,confirmPayment,cancelRegistration} from '../services/registration.js';
let student,organizer,event;
before(async()=>{await mongoose.connect(`mongodb://127.0.0.1:27017/campus_test_registration_${process.pid}`);await Promise.all([Event.init(),User.init(),Registration.init()]);});
after(async()=>{await mongoose.connection.dropDatabase();await mongoose.disconnect();});
beforeEach(async()=>{
 await Promise.all([Event.deleteMany({}),User.deleteMany({}),Registration.deleteMany({})]);
 student=await User.create({name:'Test Student',username:'student',email:'student@example.edu',password:'hashed',department:'CSE',studentId:'VTU1'});
 organizer=await User.create({name:'Organizer',username:'organizer',email:'organizer@example.edu',password:'hashed',campusRole:'club_organizer',department:'CSE',club:'coding'});
 event=await Event.create({createdBy:organizer._id,title:'Test event',image:'/assets/code-jam.png',date:new Date(Date.now()+86400000),time:'09:00',location:'Hall',scope:'club',department:'CSE',club:'coding',capacity:1});
});
const provider={createOrder:async({amount,currency,receipt})=>({id:`order_${receipt}`,amount,currency})};
test('repeat registration is idempotent and does not cancel a free ticket',async()=>{
 const a=await registerForEvent(student,event.id,provider),b=await registerForEvent(student,event.id,provider);
 assert.equal(a.id,b.id);assert.equal(b.status,'registered');assert.equal((await Event.findById(event.id)).registrationCount,1);
});
test('concurrent registrations cannot oversell capacity',async()=>{
 const other=await User.create({username:'other',email:'other@example.edu',password:'hash'});
 const outcomes=await Promise.allSettled([registerForEvent(student,event.id,provider),registerForEvent(other,event.id,provider)]);
 assert.equal(outcomes.filter(x=>x.status==='fulfilled').length,1);
 assert.equal(outcomes.find(x=>x.status==='rejected').reason.status,409);
 assert.equal(await Registration.countDocuments({event:event.id}),1);
 assert.equal((await Event.findById(event.id)).registrationCount,1);
});
test('check-in rejects another club and QR replay',async()=>{
 const ticket=await registerForEvent(student,event.id,provider);
 await assert.rejects(checkIn({id:'someone',campusRole:'club_organizer',department:'CSE',club:'music'},ticket.id,ticket.qrToken),e=>e.status===403);
 const checked=await checkIn(organizer,ticket.id,ticket.qrToken);assert.equal(checked.status,'attended');
 await assert.rejects(checkIn(organizer,ticket.id,ticket.qrToken),e=>e.status===409);
});
test('paid registration has no QR and wrong-amount capture cannot confirm it',async()=>{
 event.pricePaise=25000;await event.save();
 const ticket=await registerForEvent(student,event.id,provider);assert.equal(ticket.status,'payment_pending');assert.equal(ticket.qrToken,undefined);
 await assert.rejects(confirmPayment({order_id:ticket.paymentOrderId,id:'pay1',amount:100,currency:'INR',status:'captured'}),e=>e.status===400);
 const confirmed=await confirmPayment({order_id:ticket.paymentOrderId,id:'pay1',amount:25000,currency:'INR',status:'captured'});assert.equal(confirmed.status,'registered');assert.ok(confirmed.qrToken);
 const again=await confirmPayment({order_id:ticket.paymentOrderId,id:'pay1',amount:25000,currency:'INR',status:'captured'});assert.equal(again.id,confirmed.id);
});
test('provider failure releases capacity and removes the unfinished reservation',async()=>{
 event.pricePaise=25000;await event.save();
 await assert.rejects(registerForEvent(student,event.id,{createOrder:async()=>{throw new Error('Provider unavailable');}}));
 assert.equal(await Registration.countDocuments({}),0);assert.equal((await Event.findById(event.id)).registrationCount,0);
});
test('two simultaneous captures on one order accept only one payment identity',async()=>{
 event.pricePaise=25000;await event.save();
 const ticket=await registerForEvent(student,event.id,provider);
 const outcomes=await Promise.allSettled(['pay_a','pay_b'].map(id=>confirmPayment({order_id:ticket.paymentOrderId,id,amount:25000,currency:'INR',status:'captured'})));
 assert.equal(outcomes.filter(r=>r.status==='fulfilled').length,1);
 assert.equal(outcomes.find(r=>r.status==='rejected').reason.status,409);
 const stored=await Registration.findById(ticket.id);assert.ok(['pay_a','pay_b'].includes(stored.paymentId));
});
test('one captured payment cannot confirm registrations for two different orders',async()=>{
 event.pricePaise=25000;event.capacity=2;await event.save();
 const other=await User.create({username:'other',email:'other@example.edu',password:'hash'});
 const tickets=await Promise.all([registerForEvent(student,event.id,provider),registerForEvent(other,event.id,provider)]);
 const payment={id:'pay_reused',amount:25000,currency:'INR',status:'captured'};
 await confirmPayment({...payment,order_id:tickets[0].paymentOrderId});
 await assert.rejects(confirmPayment({...payment,order_id:tickets[1].paymentOrderId}),e=>e.status===409);
 assert.equal((await Registration.findById(tickets[1].id)).status,'payment_pending');
});
test('retry during paid order preparation never returns an unusable half-created order',async()=>{
 event.pricePaise=25000;await event.save();
 let release,started;const ready=new Promise(r=>started=r),gate=new Promise(r=>release=r);
 const pending=registerForEvent(student,event.id,{createOrder:async(args)=>{started();await gate;return provider.createOrder(args);}});
 await ready;
 try {await assert.rejects(registerForEvent(student,event.id,provider),e=>e.status===409);} finally {release();await pending;}
 const ticket=await pending;assert.ok(ticket.paymentOrderId);
 assert.equal((await Event.findById(event.id)).registrationCount,1);
});
test('concurrent cancellations release a seat once and permit a new free registration',async()=>{
 const ticket=await registerForEvent(student,event.id,provider);
 const outcomes=await Promise.allSettled([cancelRegistration(student,ticket.id),cancelRegistration(student,ticket.id)]);
 assert.equal(outcomes.filter(r=>r.status==='fulfilled').length,1);
 assert.equal((await Event.findById(event.id)).registrationCount,0);
 const next=await registerForEvent(student,event.id,provider);assert.equal(next.status,'registered');
 assert.equal((await Event.findById(event.id)).registrationCount,1);
});
test('capacity reservation rechecks a deadline that changed after the initial event read',async()=>{
 const original=Event.findById;
 Event.findById=async function(id) {
  const stale=await original.call(this,id);
  await Event.updateOne({_id:id},{$set:{deadline:new Date(Date.now()-1000)}});
  return stale;
 };
 try {await assert.rejects(registerForEvent(student,event.id,provider),e=>e.status===409);}
 finally {Event.findById=original;}
 assert.equal(await Registration.countDocuments({event:event.id}),0);
 assert.equal((await Event.findById(event.id)).registrationCount,0);
});
test('legacy QR tickets without explicit expiry use their event date plus one day',async()=>{
 event.scope='legacy';await event.save();
 const ticket=await registerForEvent(student,event.id,provider);
 await Registration.updateOne({_id:ticket._id},{$set:{qrExpiresAt:null}});
 const checked=await checkIn(organizer,ticket.id,ticket.qrToken);assert.equal(checked.status,'attended');
});
test('legacy QR tickets inferred from old events still expire',async()=>{
 event.scope='legacy';await event.save();
 const ticket=await registerForEvent(student,event.id,provider);
 await Registration.updateOne({_id:ticket._id},{$set:{qrExpiresAt:null}});
 event.date=new Date(Date.now()-2*86400000);await event.save();
 await assert.rejects(checkIn(organizer,ticket.id,ticket.qrToken),e=>e.status===400);
});
