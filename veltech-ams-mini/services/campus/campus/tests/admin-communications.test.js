import test,{before,after,beforeEach} from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import bcrypt from 'bcrypt';
import {createCampusApp} from '../server.js';
import User from '../../models/User.js';
import {CampusPost} from '../models.js';
import Notification from '../../models/Notification.js';
let server,base,password,owner,student,other,faculty;const origin='http://localhost:5173';
before(async()=>{await mongoose.connect(`mongodb://127.0.0.1:27017/campus_test_admin_messages_${process.pid}`);await User.init();await Notification.init();password=await bcrypt.hash('Fictional-password-42',4);server=createCampusApp({origins:[origin],loginLimit:1000,mail:{configured:false},linkKey:'a'.repeat(64),academic:{request:async()=>({})}}).listen(0);await new Promise(r=>server.once('listening',r));base=`http://127.0.0.1:${server.address().port}/api/campus`;});
after(async()=>{await new Promise(r=>server.close(r));await mongoose.connection.dropDatabase();await mongoose.disconnect();});
beforeEach(async()=>{for(const c of Object.values(mongoose.connection.collections))await c.deleteMany({});owner=await member('owner',{role:'admin'});student=await member('student',{department:'CSE'});other=await member('other',{department:'ECE'});faculty=await member('faculty',{role:'faculty',department:'CSE'});});
const member=(name,fields={})=>User.create({username:name,email:name+'@example.test',name,password,...fields});
async function call(path,method='GET',body,auth){const r=await fetch(base+path,{method,headers:{Origin:origin,...(body?{'Content-Type':'application/json'}:{}),...(auth?{Cookie:auth.cookie,'X-CSRF-Token':auth.data.csrfToken}:{})},body:body?JSON.stringify(body):undefined});return {status:r.status,data:await r.json(),cookie:r.headers.get('set-cookie')?.split(';')[0]};}
const login=u=>call('/login','POST',{identity:u.email,password:'Fictional-password-42'});
test('moderation requires a reason and sends the owner one persistent notification after removal',async()=>{
 const auth=await login(owner),post=await CampusPost.create({user:student._id,text:'Fictional inappropriate content'});
 assert.equal((await call(`/admin/community/post/${post.id}`,'DELETE',{},auth)).status,400);
 const removed=await call(`/admin/community/post/${post.id}`,'DELETE',{reason:'Removed for harassment under campus rules.'},auth);assert.equal(removed.status,200);assert.equal((await CampusPost.findById(post.id)).isArchived,true);
 assert.equal((await call(`/admin/community/post/${post.id}`,'DELETE',{reason:'Removed for harassment under campus rules.'},auth)).status,200);
 assert.equal(await Notification.countDocuments({toUser:student._id,type:'moderation'}),1);
 const inbox=await call('/notifications/inbox','GET',null,await login(student));assert.equal(inbox.status,200);assert.ok(inbox.data.some(row=>row.type==='moderation' && row.message.includes('harassment')));
 const history=await call('/moderation/history','GET',null,await login(other));assert.equal(history.status,200);assert.equal(history.data.actions.length,0);
});
test('student and view-only reviewer cannot moderate other students content',async()=>{
 const post=await CampusPost.create({user:student._id,text:'Fictional content'}),reviewer=await member('reviewer',{role:'admin',adminPermissions:['moderation'],adminActionPermissions:{moderation:['view']}});
 for(const user of [other,reviewer])assert.equal((await call(`/admin/community/post/${post.id}`,'DELETE',{reason:'A valid reason'},await login(user))).status,403);
 assert.equal((await CampusPost.findById(post.id)).isArchived,false);
});
test('the author cannot restore a post removed by moderation, but can restore their self-archive',async()=>{
 const admin=await login(owner),auth=await login(student),post=await CampusPost.create({user:student._id,text:'Fictional content'}),own=await CampusPost.create({user:student._id,text:'Own archived content',isArchived:true});
 assert.equal((await call(`/admin/community/post/${post.id}`,'DELETE',{reason:'Removed for harassment.'},admin)).status,200);
 assert.equal((await call(`/community/activity/post/${post.id}`,'PATCH',{archived:false},auth)).status,403);
 assert.equal((await CampusPost.findById(post.id)).isArchived,true);
 assert.equal((await call(`/community/activity/post/${own.id}`,'PATCH',{archived:false},auth)).status,200);
});
test('faculty campaign is limited to assigned department and request retries do not duplicate recipients',async()=>{
 const auth=await login(faculty),body={requestId:'fictional-request-0001',title:'Department update',body:'Please check the examination schedule.',audience:{kind:'department',department:'CSE'},email:true,inApp:true};
 assert.equal((await call('/admin/messages','POST',{...body,audience:{kind:'all-students'}},auth)).status,403);
 const made=await call('/admin/messages','POST',body,auth);assert.equal(made.status,201);assert.equal(made.data.recipientCount,1);assert.equal(made.data.mailConfigured,false);
 const retried=await call('/admin/messages','POST',body,auth);assert.equal(retried.status,200);assert.equal(retried.data.id,made.data.id);
 assert.equal(await mongoose.connection.db.collection('admin_deliveries').countDocuments({campaign:new mongoose.Types.ObjectId(made.data.id)}),1);
 assert.equal((await call('/admin/messages','POST',{...body,body:'Different payload under same id'},auth)).status,409);
});
test('announcements use separate recipient deliveries and students cannot send',async()=>{
 const body={requestId:'fictional-request-0002',title:'Campus update',body:'A new programme is available.',audience:{kind:'all-students'},email:true,inApp:true};
 assert.equal((await call('/admin/messages','POST',body,await login(student))).status,403);
 const made=await call('/admin/messages','POST',body,await login(owner));assert.equal(made.status,201);assert.equal(made.data.recipientCount,2);
 const rows=await mongoose.connection.db.collection('admin_deliveries').find({campaign:new mongoose.Types.ObjectId(made.data.id)}).toArray();assert.equal(rows.length,2);assert.ok(rows.every(row=>typeof row.to==='string' && !row.to.includes(',')));
});
test('mail failure retains a queued moderation reason and a later worker sends only once',async()=>{
 const service=await import('../services/admin-messages.js').catch(()=>({}));assert.equal(typeof service.processAdminDeliveries,'function');
 const post=await CampusPost.create({user:student._id,text:'Fictional content'});await call(`/admin/community/post/${post.id}`,'DELETE',{reason:'Removed for harassment.'},await login(owner));
 const failed=await service.processAdminDeliveries({mail:{configured:true,async send(){throw new Error('Simulated SMTP outage');}}});assert.equal(failed.failed,1);
 let sends=0;const mail={configured:true,async send(message){sends++;assert.equal(message.to,student.email);assert.match(message.text,/harassment/);return {accepted:true};}};
 await service.processAdminDeliveries({mail,now:new Date(Date.now()+3600000)});await service.processAdminDeliveries({mail,now:new Date(Date.now()+3600000)});assert.equal(sends,1);
});

test('a submitted actor object cannot turn faculty messaging into college administrator access',async()=>{
 const body={actor:{_id:owner.id,role:'admin'},requestId:'forged-actor-request-0001',title:'Attempted broadcast',body:'This must not be queued.',audience:{kind:'all-students'},email:true,inApp:true};
 assert.equal((await call('/admin/messages','POST',body,await login(faculty))).status,403);
 assert.equal(await mongoose.connection.db.collection('admin_messages').countDocuments(),0);
});

test('queued announcements stop when the sender loses messaging access',async()=>{
 const service=await import('../services/admin-messages.js'),sender=await member('sender',{role:'admin',adminPermissions:['communications'],adminActionPermissions:{communications:['view','create']}});
 const made=await call('/admin/messages','POST',{requestId:'revoked-sender-request-0001',title:'A queued update',body:'This must stop after access is revoked.',audience:{kind:'all-students'},email:true,inApp:true},await login(sender));assert.equal(made.status,201);
 await User.updateOne({_id:sender._id},{$set:{adminActionPermissions:{communications:['view']}}});let sends=0;
 await service.processAdminDeliveries({mail:{configured:true,async send(){sends++;}}});assert.equal(sends,0);
});
