import test,{before,after,beforeEach} from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import bcrypt from 'bcrypt';
import crypto from 'node:crypto';
import {createCampusApp} from '../server.js';
import User from '../../models/User.js';
import Event from '../../models/Event.js';
import Registration from '../../models/EventRegistration.js';
import {registerForEvent} from '../services/registration.js';
import {Session,AcademicLink,Placement} from '../models.js';
let server,base,student,admin,session,cookie;
const origin='http://localhost:5180',key=crypto.randomBytes(32).toString('hex');
const academicCalls=[];
const academic={login:async(email)=>({token:'private-token',user:{id:'academic-id',email}}),request:async(token,path,method='GET',body)=>{academicCalls.push({token,path,method,body});return path==='/profile'?{name:'Linked Student',email:'student@example.edu',photoUrl:'',branch:'CSE'}:[];}};
const payment={keyId:'test-key',createOrder:async({amount,currency,receipt})=>({id:`order_${receipt}`,amount,currency})};
before(async()=>{await mongoose.connect(`mongodb://127.0.0.1:27017/campus_test_api_${process.pid}`);await Promise.all([User.init(),Session.init(),AcademicLink.init(),Registration.init()]);server=createCampusApp({loginLimit:1000,origins:[origin],linkKey:key,academic,payment,webhookSecret:'test-webhook-secret'}).listen(0);await new Promise(r=>server.once('listening',r));base=`http://127.0.0.1:${server.address().port}`;});
after(async()=>{await new Promise(r=>server.close(r));await mongoose.connection.dropDatabase();await mongoose.disconnect();});
async function call(path,method='GET',body,headers={}) {
 const response=await fetch(base+'/api/campus'+path,{method,headers:{Origin:origin,...(body?{'Content-Type':'application/json'}:{}),...headers},body:body?JSON.stringify(body):undefined});
 const content=await response.json();return {status:response.status,content,response};
}
async function login(identity='student@example.edu'){
 const r=await call('/login','POST',{identity,password:'TestPass!234'});assert.equal(r.status,200);cookie=r.response.headers.get('set-cookie').split(';')[0];session=r.content;return r;
}
beforeEach(async()=>{academicCalls.length=0;await Promise.all([User.deleteMany({}),Session.deleteMany({}),AcademicLink.deleteMany({}),Placement.deleteMany({}),Event.deleteMany({}),Registration.deleteMany({})]);const password=await bcrypt.hash('TestPass!234',4);student=await User.create({username:'student',email:'student@example.edu',name:'Student',password,department:'CSE'});admin=await User.create({username:'admin',email:'admin@example.edu',name:'Admin',password,role:'admin'});});
test('session login uses HttpOnly cookie and logout revokes it',async()=>{
 const r=await login();assert.match(r.response.headers.get('set-cookie'),/HttpOnly/);assert.ok(session.csrfToken);assert.equal(session.user.email,student.email);
 assert.equal((await call('/session','GET',undefined,{Cookie:cookie})).status,200);
 assert.equal((await call('/logout','POST',{}, {Cookie:cookie,'X-CSRF-Token':session.csrfToken})).status,200);
 assert.equal((await call('/session','GET',undefined,{Cookie:cookie})).status,401);
});
test('Docker localhost login can use production mode with explicitly configured HTTP cookies',async()=>{
 const localServer=createCampusApp({production:true,cookieSecure:false,origins:[origin],linkKey:key,academic}).listen(0);
 await new Promise(r=>localServer.once('listening',r));
 try {
  const response=await fetch(`http://127.0.0.1:${localServer.address().port}/api/campus/login`,{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify({identity:student.email,password:'TestPass!234'})});
  assert.equal(response.status,200);assert.doesNotMatch(response.headers.get('set-cookie'),/; Secure/);
 } finally {await new Promise(r=>localServer.close(r));}
});
test('new campus accounts automatically get only their own encrypted academic workspace',async()=>{
 const calls=[];const bridge={...academic,bootstrap:async(identity)=>{calls.push(identity);return {token:'managed-private-token',user:{id:'owned-academic-id',email:identity.email}};}};
 const local=createCampusApp({bridgeEnabled:true,origins:[origin],linkKey:key,academic:bridge}).listen(0);await new Promise(r=>local.once('listening',r));
 const address=`http://127.0.0.1:${local.address().port}/api/campus`;
 try {
  const login=await fetch(address+'/login',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify({identity:student.email,password:'TestPass!234'})});
  const ownCookie=login.headers.get('set-cookie').split(';')[0];
  const status=await fetch(address+'/academics/status',{headers:{Cookie:ownCookie}});const data=await status.json();
  assert.equal(status.status,200);assert.equal(data.connected,true);assert.equal(data.managed,true);
  assert.equal(calls[0].campusId,student.id);assert.equal(calls[0].email,student.email);
  assert.ok(!JSON.stringify(data).includes('managed-private-token'));
  const linked=await AcademicLink.findOne({user:student.id}).select('+sealedToken');assert.ok(!linked.sealedToken.includes('managed-private-token'));assert.equal(linked.managed,true);
 }finally{await new Promise(r=>local.close(r));}
});
test('automatic workspace creation never accepts a returned identity for another email',async()=>{
 const bridge={...academic,bootstrap:async()=>({token:'other-private-token',user:{id:'other',email:'other@example.edu'}})};
 const local=createCampusApp({bridgeEnabled:true,origins:[origin],linkKey:key,academic:bridge}).listen(0);await new Promise(r=>local.once('listening',r));
 const address=`http://127.0.0.1:${local.address().port}/api/campus`;
 try {
  const login=await fetch(address+'/login',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify({identity:student.email,password:'TestPass!234'})});
  const status=await fetch(address+'/academics/status',{headers:{Cookie:login.headers.get('set-cookie').split(';')[0]}});
  assert.equal(status.status,403);assert.equal(await AcademicLink.countDocuments({user:student.id}),0);
 }finally{await new Promise(r=>local.close(r));}
});
test('mutations reject missing CSRF token and unapproved origins',async()=>{
 await login();assert.equal((await call('/feed','POST',{text:'Hello'},{Cookie:cookie})).status,403);
 assert.equal((await call('/feed','POST',{text:'Hello'},{Cookie:cookie,'X-CSRF-Token':session.csrfToken,Origin:'https://evil.example'})).status,403);
});
test('student cannot assign roles or create events',async()=>{
 await login();const h={Cookie:cookie,'X-CSRF-Token':session.csrfToken};
 assert.equal((await call(`/management/users/${student.id}`,'PATCH',{campusRole:'admin'},h)).status,403);
 assert.equal((await call('/events','POST',{title:'Forged',scope:'college',pricePaise:0},h)).status,403);
});
test('academic linking verifies identity and never returns or stores the plain token',async()=>{
 await login();const h={Cookie:cookie,'X-CSRF-Token':session.csrfToken};
 assert.equal((await call('/academics/link','POST',{email:'other@example.edu',password:'pass'},h)).status,403);
 const linked=await call('/academics/link','POST',{email:student.email,password:'pass'},h);assert.equal(linked.status,200);assert.ok(!JSON.stringify(linked.content).includes('private-token'));
 const dbLink=await AcademicLink.findOne({user:student.id}).select('+sealedToken');assert.ok(!dbLink.sealedToken.includes('private-token'));
 const profile=await call('/academics/overview','GET',undefined,h);assert.equal(profile.status,200);assert.equal(profile.content.profile.branch,'CSE');
});
test('compose, like, save and comment persist and preserve author privacy',async()=>{
 await login();const h={Cookie:cookie,'X-CSRF-Token':session.csrfToken};
 const post=await call('/feed','POST',{text:'Built our campus project',category:'project'},h);assert.equal(post.status,201);
 assert.equal((await call(`/feed/${post.content.id}/like`,'PUT',{liked:true},h)).status,200);
 assert.equal((await call(`/feed/${post.content.id}/save`,'PUT',{saved:true},h)).status,200);
 assert.equal((await call(`/feed/${post.content.id}/comments`,'POST',{text:'Great work'},h)).status,201);
 const feed=await call('/feed','GET',undefined,h);const p=feed.content.find(x=>x.id===post.content.id);assert.equal(p.liked,true);assert.equal(p.saved,true);assert.equal(p.comments.length,1);assert.equal(p.author.email,undefined);
});
test('only placement officer or admin creates opportunities',async()=>{
 await login();let h={Cookie:cookie,'X-CSRF-Token':session.csrfToken};
 assert.equal((await call('/placements','POST',{company:'Company',title:'Role',type:'campus'},h)).status,403);
 await login(admin.email);h={Cookie:cookie,'X-CSRF-Token':session.csrfToken};
 assert.equal((await call('/placements','POST',{company:'Company',title:'Role',type:'campus',url:'javascript:alert(1)'},h)).status,400);
 assert.equal((await call('/placements','POST',{company:'Company',title:'Role',type:'campus',url:'https://example.org/careers'},h)).status,201);
});
test('academic notifications read relay acts only on the linked student token',async()=>{
 await login();const h={Cookie:cookie,'X-CSRF-Token':session.csrfToken};
 assert.equal((await call('/academics/notifications/read','PATCH',{},h)).status,409);
 await call('/academics/link','POST',{email:student.email,password:'pass'},h);
 const response=await call('/academics/notifications/read','PATCH',{studentId:'another-student'},h);
 assert.equal(response.status,200);
 assert.deepEqual(academicCalls.at(-1),{token:'private-token',path:'/notifications/read-all',method:'PATCH',body:{}});
});
test('signed payment webhook checks raw bytes, order amount and replay identity',async()=>{
 const event=await Event.create({createdBy:admin._id,title:'Paid event',date:new Date(Date.now()+86400000),time:'09:00',location:'Hall',image:'/assets/code-jam.png',scope:'college',pricePaise:25000,capacity:5});
 const ticket=await registerForEvent(student,event.id,payment);
 const captured={id:'pay_verified',order_id:ticket.paymentOrderId,amount:25000,currency:'INR',status:'captured'};
 async function webhook(entity,alterBody=false) {
  const raw=JSON.stringify({event:'payment.captured',payload:{payment:{entity}}});
  const signature=crypto.createHmac('sha256','test-webhook-secret').update(raw).digest('hex');
  const response=await fetch(base+'/api/campus/payments/webhook',{method:'POST',headers:{'Content-Type':'application/json','X-Razorpay-Signature':signature},body:alterBody?raw+' ':raw});
  return {status:response.status,content:await response.json()};
 }
 assert.equal((await webhook(captured,true)).status,401);
 assert.equal((await webhook({...captured,amount:1})).status,400);
 assert.equal((await Registration.findById(ticket.id)).status,'payment_pending');
 assert.equal((await webhook(captured)).status,200);
 const confirmed=await Registration.findById(ticket.id);
 assert.equal(confirmed.status,'registered');assert.ok(confirmed.qrToken);
 assert.equal((await webhook(captured)).status,200);
 assert.equal((await Registration.findById(ticket.id)).qrToken,confirmed.qrToken);
 assert.equal((await webhook({...captured,id:'pay_other'})).status,409);
});
test('webhook rejects a signed request without a raw JSON body rather than crashing',async()=>{
 const raw='{}',signature=crypto.createHmac('sha256','test-webhook-secret').update(raw).digest('hex');
 const response=await fetch(base+'/api/campus/payments/webhook',{method:'POST',headers:{'Content-Type':'text/plain','X-Razorpay-Signature':signature},body:raw});
 assert.equal(response.status,401);
});
test('webhook rejects a signed JSON scalar payload with a client error',async()=>{
 const raw='null',signature=crypto.createHmac('sha256','test-webhook-secret').update(raw).digest('hex');
 const response=await fetch(base+'/api/campus/payments/webhook',{method:'POST',headers:{'Content-Type':'application/json','X-Razorpay-Signature':signature},body:raw});
 assert.equal(response.status,400);
});
test('event creation reports malformed image, date and scope metadata as client errors',async()=>{
 await login(admin.email);const h={Cookie:cookie,'X-CSRF-Token':session.csrfToken};
 const valid={title:'Valid event',scope:'college',date:new Date(Date.now()+86400000).toISOString(),time:'09:00',location:'Hall',capacity:100,pricePaise:0};
 for(const change of [{image:{}},{date:[valid.date]},{department:{}},{club:[]},{time:'99:99'},{category:{name:'Tech'}}]) {
  assert.equal((await call('/events','POST',{...valid,...change},h)).status,400);
 }
});
test('admin provisioning rejects passwords exceeding bcrypt UTF-8 byte limit',async()=>{
 await login(admin.email);const h={Cookie:cookie,'X-CSRF-Token':session.csrfToken};
 for(const password of ['A'.repeat(73),'é'.repeat(37),'😀'.repeat(19)]) {
  const response=await call('/management/users','POST',{name:'Provisioned Student',email:'new@example.edu',username:'newstudent',password},h);
  assert.equal(response.status,400);
  assert.equal(await User.countDocuments({username:'newstudent'}),0);
 }
});
test('a 72-byte unicode password can be provisioned and used without truncation',async()=>{
 await login(admin.email);const h={Cookie:cookie,'X-CSRF-Token':session.csrfToken};
 const password='é'.repeat(36);
 assert.equal(Buffer.byteLength(password,'utf8'),72);
 assert.equal((await call('/management/users','POST',{name:'Provisioned Student',email:'new@example.edu',username:'newstudent',password},h)).status,201);
 assert.equal((await call('/login','POST',{identity:'new@example.edu',password})).status,200);
});
test('campus login rejects long legacy passwords without altering their stored hashes',async()=>{
 const password='A'.repeat(73),hash=await bcrypt.hash(password,4);
 await User.updateOne({_id:student._id},{$set:{password:hash}});
 const response=await call('/login','POST',{identity:student.email,password});
 assert.equal(response.status,400);
 assert.equal((await User.findById(student.id)).password,hash);
 // Existing accounts remain usable through the original app until reset; do not rewrite hashes.
 assert.equal(await bcrypt.compare(password,hash),true);
 assert.equal(await Session.countDocuments({user:student._id}),0);
});
test('manual check-in rejects empty or missing registration identifiers',async()=>{
 await login(admin.email);const h={Cookie:cookie,'X-CSRF-Token':session.csrfToken};
 for(const body of [{},{registrationId:''},{registrationId:null},{registrationId:[]}]) {
  assert.equal((await call('/check-in','POST',body,h)).status,400);
 }
});
test('event bookmarks are idempotent, private to an account and validate inputs',async()=>{
 const event=await Event.create({createdBy:admin._id,title:'Bookmark event',date:new Date(Date.now()+86400000),time:'10:00',location:'Hall',image:'/assets/code-jam.png'});
 await login();const h={Cookie:cookie,'X-CSRF-Token':session.csrfToken};
 assert.equal((await call(`/events/${event.id}/save`,'PUT',{saved:'true'},h)).status,400);
 for(let i=0;i<2;i++)assert.equal((await call(`/events/${event.id}/save`,'PUT',{saved:true},h)).status,200);
 assert.equal((await User.findById(student.id)).savedCampusEvents.length,1);
 assert.equal((await call('/events','GET',undefined,h)).content.find(e=>e.id===event.id).saved,true);
 await login(admin.email);assert.equal((await call('/events','GET',undefined,{Cookie:cookie})).content.find(e=>e.id===event.id).saved,false);
});
test('post attachment ownership and item privacy protect all feed interactions',async()=>{
 await login();const h={Cookie:cookie,'X-CSRF-Token':session.csrfToken};
 assert.equal((await call('/feed','POST',{text:'External file',image:'https://example.org/private.png'},h)).status,400);
 const p=await call('/feed','POST',{text:'Private post',visibility:'private'},h);assert.equal(p.status,201);
 await login(admin.email);const other={Cookie:cookie,'X-CSRF-Token':session.csrfToken};
 assert.ok(!(await call('/feed','GET',undefined,other)).content.some(x=>x.id===p.content.id));
 assert.equal((await call(`/feed/${p.content.id}/like`,'PUT',{liked:true},other)).status,403);
});
test('deactivated accounts lose sessions and cannot sign in',async()=>{
 await login();await User.updateOne({_id:student._id},{$set:{isActive:false}});
 assert.equal((await call('/session','GET',undefined,{Cookie:cookie})).status,401);
 assert.equal((await call('/login','POST',{identity:student.email,password:'TestPass!234'})).status,401);
});
test('admin account lifecycle revokes access while protecting administrator identities',async()=>{
 await login();const oldCookie=cookie;
 await login(admin.email);const h={Cookie:cookie,'X-CSRF-Token':session.csrfToken};
 assert.equal((await call(`/management/users/${admin.id}/status`,'PATCH',{active:false},h)).status,409);
 assert.equal((await call(`/management/users/${student.id}/status`,'PATCH',{active:false},h)).status,200);
 assert.equal((await call('/session','GET',undefined,{Cookie:oldCookie})).status,401);
 assert.equal(await Session.countDocuments({user:student._id}),0);
 assert.equal((await call(`/management/users/${student.id}/status`,'PATCH',{active:true},h)).status,200);
 assert.equal((await call(`/management/users/${student.id}/reset-password`,'POST',{password:'ResetForTests!234'},h)).status,200);
 assert.equal((await call('/login','POST',{identity:student.email,password:'TestPass!234'})).status,401);
 assert.equal((await call('/login','POST',{identity:student.email,password:'ResetForTests!234'})).status,200);
 assert.equal((await call(`/management/users/${student.id}`,'DELETE',{},h)).content.deactivated,true);
 assert.ok(await User.exists({_id:student._id}));
});
test('only administrators provision faculty and faculty publications stay in their department',async()=>{
 await login();const studentHeaders={Cookie:cookie,'X-CSRF-Token':session.csrfToken};
 assert.equal((await call(`/management/users/${student.id}`,'PATCH',{campusRole:'student',accountRole:'faculty',department:'CSE'},studentHeaders)).status,403);
 assert.equal((await call('/faculty-exams','POST',{},studentHeaders)).status,403);
 await login(admin.email);const adminHeaders={Cookie:cookie,'X-CSRF-Token':session.csrfToken};
 assert.equal((await call(`/management/users/${student.id}`,'PATCH',{campusRole:'student',accountRole:'faculty',department:''},adminHeaders)).status,400);
 const assigned=await call(`/management/users/${student.id}`,'PATCH',{campusRole:'student',accountRole:'faculty',department:'CSE'},adminHeaders);
 assert.equal(assigned.status,200);assert.equal(assigned.content.accountRole,'faculty');
 await login();const staff={Cookie:cookie,'X-CSRF-Token':session.csrfToken};
 const exam={title:'Synthetic midterm',courseCode:'QA101',courseName:'Synthetic Security',date:'2026-12-01',startTime:'10:00',endTime:'11:00',department:'CSE'};
 assert.equal((await call('/faculty-exams','POST',{...exam,department:'ECE'},staff)).status,403);
 const published=await call('/faculty-exams','POST',exam,staff);assert.equal(published.status,201);
 assert.equal((await call('/academics/faculty-exams','GET',undefined,staff)).content.examinations.length,1);
 await User.updateOne({_id:student.id},{$set:{department:'ECE'}});
 assert.equal((await call('/academics/faculty-exams','GET',undefined,staff)).content.examinations.length,0);
 assert.equal((await call('/faculty-exams/'+published.content.id,'DELETE',{},staff)).status,404);
});
