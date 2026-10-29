import test,{before,after,beforeEach} from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import '../../models/User.js';
import Event from '../../models/Event.js';
import Registration from '../../models/EventRegistration.js';
import {markAttendance,verifyEventQR,getEventAnalytics,exportParticipantsCSV} from '../../controllers/eventRegistrationController.js';
import {deleteEvent} from '../../controllers/eventController.js';
let event,ticket;
before(async()=>{await mongoose.connect(`mongodb://127.0.0.1:27017/campus_test_legacy_${process.pid}`);});
after(async()=>{await mongoose.connection.dropDatabase();await mongoose.disconnect();});
beforeEach(async()=>{
 await Event.deleteMany({});await Registration.deleteMany({});
 event=await Event.create({createdBy:new mongoose.Types.ObjectId(),title:'Scoped event',date:new Date(Date.now()+86400000),time:'09:00',location:'Hall',image:'/image.png',scope:'department',department:'CSE'});
 ticket=await Registration.create({user:new mongoose.Types.ObjectId(),event:event._id,studentId:'VTU1',email:'test@example.edu',phone:'123',department:'CSE',qrToken:'private-qr',status:'registered'});
});
async function invoke(fn,req) {
 const res={statusCode:200,status(n){this.statusCode=n;return this;},json(d){this.body=d;return this;},header(){return this;},attachment(){return this;},send(d){this.body=d;return this;}};
 await fn({user:{id:String(new mongoose.Types.ObjectId()),role:'student'},...req},res);return res;
}
test('legacy manual attendance requires event-specific organizer access',async()=>{
 assert.equal((await invoke(markAttendance,{params:{registrationId:ticket.id}})).statusCode,403);
 assert.equal((await Registration.findById(ticket.id)).status,'registered');
});
test('legacy QR endpoint cannot be used by an unrelated logged-in student',async()=>{
 assert.equal((await invoke(verifyEventQR,{body:{qrData:JSON.stringify({registrationId:ticket.id,qrToken:ticket.qrToken})}})).statusCode,403);
});
test('legacy analytics and CSV cannot leak another event roster',async()=>{
 assert.equal((await invoke(getEventAnalytics,{params:{eventId:event.id}})).statusCode,403);
 assert.equal((await invoke(exportParticipantsCSV,{params:{eventId:event.id}})).statusCode,403);
});
test('legacy deletion cannot erase paid orders or their registration receipts',async()=>{
 await Event.updateOne({_id:event._id},{$set:{image:''}});
 ticket.amountPaise=25000;ticket.paymentOrderId='order_keep';ticket.paymentId='pay_keep';await ticket.save();
 const result=await invoke(deleteEvent,{params:{id:event.id},user:{id:String(event.createdBy),role:'admin'}});
 assert.equal(result.statusCode,409);
 assert.ok(await Event.findById(event.id));assert.ok(await Registration.findById(ticket.id));
});
