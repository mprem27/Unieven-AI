import test,{before,after,beforeEach,mock} from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import {createCampusApp} from '../server.js';
import User from '../../models/User.js';
import {Session} from '../models.js';
import Notification from '../../models/Notification.js';
import {newToken,hashToken} from '../security.js';
let server,base,student,other,admin,coordinator;
const origin='http://localhost:5174';
async function account(name,scope={}){
 const user=await User.create({username:name,email:name+'@example.test',name,password:'unused-test-hash',...scope}),token=newToken(),csrf=newToken();
 await Session.create({user:user.id,tokenHash:hashToken(token),csrfToken:csrf,expiresAt:new Date(Date.now()+86400000)});
 return {user,cookie:'campus_session='+token,csrf};
}
async function call(path,{as=student,method='GET',body,csrf=true}={}){
 const r=await fetch(base+path,{method,headers:{Origin:origin,...(as?{Cookie:as.cookie}:{}),...(csrf&&as?{'X-CSRF-Token':as.csrf}:{}),...(body?{'Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined});
 return {status:r.status,body:await r.json()};
}
const draft=(extra={})=>({category:'idea',subject:'Clearer campus updates',message:'Please add more useful event reminders.',...extra});
before(async()=>{await mongoose.connect('mongodb://127.0.0.1:27017/campus_test_feedback_v18_'+process.pid);await Promise.all([User.init(),Session.init()]);server=createCampusApp({origins:[origin]}).listen(0);await new Promise(r=>server.once('listening',r));base='http://127.0.0.1:'+server.address().port+'/api/campus';});
after(async()=>{await new Promise(r=>server.close(r));await mongoose.connection.dropDatabase();await mongoose.disconnect();});
beforeEach(async()=>{for(const c of Object.values(mongoose.connection.collections))await c.deleteMany({});student=await account('student');other=await account('other');admin=await account('administrator',{campusRole:'admin'});coordinator=await account('coordinator',{campusRole:'department_coordinator',department:'CSE'});});
test('app feedback persists only the authenticated owner and excludes contact/academic details',async()=>{
 const posted=await call('/app-feedback',{method:'POST',body:draft({rating:4})});assert.equal(posted.status,201);
 assert.equal(posted.body.feedback.status,'new');assert.equal(posted.body.feedback.rating,4);
 const mine=await call('/app-feedback');assert.equal(mine.body.feedback.length,1);assert.equal(mine.body.feedback[0].subject,draft().subject);
 assert.doesNotMatch(JSON.stringify(mine.body),/student@example|password|academic|portal/i);
 assert.equal((await call('/app-feedback',{as:other})).body.feedback.length,0);
 assert.equal((await call('/app-feedback',{as:null})).status,401);
});
test('student or coordinator cannot read support inbox or respond to another student',async()=>{
 const item=(await call('/app-feedback',{method:'POST',body:draft()})).body.feedback;
 assert.ok(item?.id);
 for(const as of [student,other,coordinator]){
  assert.equal((await call('/app-feedback/manage',{as})).status,403);
  assert.equal((await call('/app-feedback/'+item.id,{as,method:'PATCH',body:{status:'resolved',reply:'Not allowed'}})).status,403);
 }
 const inbox=await call('/app-feedback/manage',{as:admin});assert.equal(inbox.status,200);assert.equal(inbox.body.feedback.length,1);
});
test('administrator response reaches its owner without changing submitted content',async()=>{
 const item=(await call('/app-feedback',{method:'POST',body:draft()})).body.feedback;
 const updated=await call('/app-feedback/'+item.id,{as:admin,method:'PATCH',body:{status:'planned',reply:'Thank you. This update is planned.'}});
 assert.equal(updated.status,200);assert.equal(updated.body.feedback.status,'planned');assert.equal(updated.body.feedback.message,draft().message);
 const mine=(await call('/app-feedback')).body.feedback[0];assert.equal(mine.reply,'Thank you. This update is planned.');assert.ok(mine.replyAt);
 assert.equal((await call('/app-feedback/manage?status=new',{as:admin})).body.feedback.length,0);
});
test('feedback validation and CSRF reject forged or oversized submissions',async()=>{
 for(const body of [draft({category:'admin'}),draft({rating:'5'}),draft({rating:8}),draft({subject:''}),draft({message:'x'.repeat(3001)}),draft({user:other.user.id}),draft({status:'resolved'})])assert.equal((await call('/app-feedback',{method:'POST',body})).status,400);
 assert.equal((await call('/app-feedback',{method:'POST',body:draft(),csrf:false})).status,403);
});
test('retrying the same owner request creates a single item, without conflating different owners',async()=>{
 const body=draft({clientRequestId:'fictional-request-123456789'});
 const rows=await Promise.all([call('/app-feedback',{method:'POST',body}),call('/app-feedback',{method:'POST',body})]);
 assert.ok(rows.every(x=>[200,201].includes(x.status)));assert.equal(rows[0].body.feedback.id,rows[1].body.feedback.id);
 assert.equal((await call('/app-feedback')).body.feedback.length,1);
 assert.equal((await call('/app-feedback',{as:other,method:'POST',body})).status,201);
});
for(const recover of ['retry','inbox'])test(`a persisted feedback reply retries notification delivery after a transient failure via ${recover}`,async()=>{
 const item=(await call('/app-feedback',{method:'POST',body:draft()})).body.feedback;
 const original=Notification.findOneAndUpdate.bind(Notification);let attempts=0;
 const replacement=mock.method(Notification,'findOneAndUpdate',(...args)=>{if(++attempts===1)throw new Error('Fictional temporary notification outage');return original(...args);});
 try{
  const first=await call('/app-feedback/'+item.id,{as:admin,method:'PATCH',body:{status:'planned',reply:'A planned improvement.'}});assert.equal(first.status,500);
  assert.equal((await call('/app-feedback')).body.feedback[0].status,'planned');
  if(recover==='retry')assert.equal((await call('/app-feedback/'+item.id,{as:admin,method:'PATCH',body:{status:'planned',reply:'A planned improvement.'}})).status,200);
  const inbox=await call('/notifications/inbox');assert.equal(inbox.status,200);assert.equal(inbox.body.filter(n=>n.type==='app_feedback_reply').length,1);
  assert.equal(await Notification.countDocuments({toUser:student.user._id,type:'app_feedback_reply'}),1);
  assert.ok(attempts>=2);
 }finally{replacement.mock.restore();}
});
