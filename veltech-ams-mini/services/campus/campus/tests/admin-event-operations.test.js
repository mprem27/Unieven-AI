import test,{before,after,beforeEach} from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import bcrypt from 'bcrypt';
import User from '../../models/User.js';
import Event from '../../models/Event.js';
import Registration from '../../models/EventRegistration.js';
import {createCampusApp} from '../server.js';
let server,base,password,owner,scanner,student,event;
const origin='http://localhost:5173';
before(async()=>{await mongoose.connect(`mongodb://127.0.0.1:27017/campus_test_admin_events_${process.pid}`);await User.init();await Registration.init();password=await bcrypt.hash('Fictional-password-42',4);server=createCampusApp({origins:[origin],loginLimit:1000,linkKey:'a'.repeat(64),academic:{request:async()=>({})}}).listen(0);await new Promise(r=>server.once('listening',r));base=`http://127.0.0.1:${server.address().port}/api/campus`;});
after(async()=>{await new Promise(r=>server.close(r));await mongoose.connection.dropDatabase();await mongoose.disconnect();});
beforeEach(async()=>{for(const c of Object.values(mongoose.connection.collections))await c.deleteMany({});owner=await member('owner',{role:'admin'});scanner=await member('scanner',{role:'faculty',department:'ECE'});student=await member('student');event=await Event.create({createdBy:owner._id,title:'Campus design day',image:'/assets/veltech-campus.jpg',date:new Date('2030-10-23'),time:'10:00',location:'Hall A',scope:'college',rules:['Carry your college ID.']});});
const member=(name,fields={})=>User.create({username:name,email:name+'@example.test',name,password,...fields});
async function call(path,method='GET',body,auth){const r=await fetch(base+path,{method,headers:{Origin:origin,...(body?{'Content-Type':'application/json'}:{}),...(auth?{Cookie:auth.cookie,'X-CSRF-Token':auth.data.csrfToken}:{})},body:body?JSON.stringify(body):undefined});return {status:r.status,data:await r.json(),cookie:r.headers.get('set-cookie')?.split(';')[0]};}
const login=u=>call('/login','POST',{identity:u.email,password:'Fictional-password-42'});
test('rules require explicit acknowledgement before reservation',async()=>{
 const auth=await login(student);assert.equal((await call(`/events/${event.id}/register`,'POST',{},auth)).status,400);assert.equal(await Registration.countDocuments(),0);
 const result=await call(`/events/${event.id}/register`,'POST',{acceptEventRules:true},auth);assert.equal(result.status,200);assert.equal(result.data.status,'registered');
});
test('assigned scanner can inspect and QR check in but cannot manually mark or edit event',async()=>{
 const admin=await login(owner),auth=await login(scanner),ticket=await Registration.create({user:student._id,event:event._id,email:student.email,studentId:'VTU00000',department:'CSE',phone:'0000000000',status:'registered',qrToken:'fixture-token',qrExpiresAt:new Date('2031-01-01')});
 const grant=await call(`/events/${event.id}/staff`,'PUT',{userId:scanner.id,capabilities:{qr:true,manual:false,email:false}},admin);assert.equal(grant.status,200);
 assert.equal((await call(`/events/${event.id}/operations`,'GET',null,auth)).status,200);
 assert.equal((await call(`/registrations/${ticket.id}/check-in`,'POST',{},auth)).status,403);
 assert.equal((await call(`/events/${event.id}`,'PATCH',{title:'Not allowed'},auth)).status,403);
 assert.equal((await call('/check-in','POST',{registrationId:ticket.id,eventId:event.id,qrToken:'fixture-token'},auth)).status,200);
});
test('manual capability is separately editable and revoked delegates lose access immediately',async()=>{
 const admin=await login(owner),auth=await login(scanner),ticket=await Registration.create({user:student._id,event:event._id,email:student.email,studentId:'VTU00000',department:'CSE',phone:'0000000000',status:'registered'});
 assert.equal((await call(`/events/${event.id}/staff`,'PUT',{userId:scanner.id,capabilities:{manual:true}},admin)).status,200);
 assert.equal((await call(`/registrations/${ticket.id}/check-in`,'POST',{note:'Identity verified against college ID'},auth)).status,200);
 assert.equal((await Registration.findById(ticket.id)).checkInMethod,'manual');
 assert.equal((await call(`/events/${event.id}/staff/${scanner.id}`,'DELETE',{},admin)).status,200);
 assert.equal((await call(`/events/${event.id}/operations`,'GET',null,auth)).status,403);
});
test('scanner cannot admit unpaid tickets or grant itself capabilities',async()=>{
 const admin=await login(owner),auth=await login(scanner);await call(`/events/${event.id}/staff`,'PUT',{userId:scanner.id,capabilities:{manual:true}},admin);
 const ticket=await Registration.create({user:student._id,event:event._id,email:student.email,studentId:'VTU00000',department:'CSE',phone:'0000000000',status:'payment_pending',amountPaise:100});
 assert.equal((await call(`/registrations/${ticket.id}/check-in`,'POST',{},auth)).status,409);
 assert.equal((await call(`/events/${event.id}/staff`,'PUT',{userId:scanner.id,capabilities:{email:true}},auth)).status,403);
});
test('ordinary student accounts cannot be appointed to check in other participants',async()=>{
 const auth=await login(owner);
 assert.equal((await call(`/events/${event.id}/staff`,'PUT',{userId:student.id,capabilities:{manual:true,qr:true}},auth)).status,400);
});
test('an event editor cannot delegate email power that they do not hold',async()=>{
 const editor=await member('event_editor',{role:'admin',adminPermissions:['events'],adminActionPermissions:{events:['view','update']}});
 assert.equal((await call(`/events/${event.id}/staff`,'PUT',{userId:scanner.id,capabilities:{email:true}},await login(editor))).status,403);
});
test('a delete-only administrator can revoke event staff without an unrelated update action',async()=>{
 await call(`/events/${event.id}/staff`,'PUT',{userId:scanner.id,capabilities:{qr:true}},await login(owner));
 const reviewer=await member('revoker',{role:'admin',adminPermissions:['events'],adminActionPermissions:{events:['view','delete']}});
 assert.equal((await call(`/events/${event.id}/staff/${scanner.id}`,'DELETE',{},await login(reviewer))).status,200);
 assert.equal((await call(`/events/${event.id}/operations`,'GET',null,await login(scanner))).status,403);
});
