import test,{before,after,beforeEach} from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';import bcrypt from 'bcrypt';
import {createCampusApp} from '../server.js';
import User from '../../models/User.js';import {Session,AcademicLink,Audit} from '../models.js';
const origin='http://localhost:5173',key='d'.repeat(64);let server,base,owner,limited,upstream=[],verification=false,returnedPrincipal='vtu00000';
// This isolated test worker performs many full login flows in one minute.
// Separate traffic-control tests cover the unchanged production allowances.
process.env.CAMPUS_API_RATE_LIMIT='10000';process.env.CAMPUS_PORTAL_RATE_LIMIT='1000';
const academic={request:async(token,path)=>{upstream.push(path);return [];},internal:async(path,body)=>{upstream.push({path,body});if(verification && !body.challengeId && !path.endsWith('admin-session'))return {verificationRequired:true,challenge:{challengeId:'e'.repeat(32),requiresCaptcha:true,display:'User-entered test verification'}};return path.endsWith('admin-session')?{token:'fictional-admin-token',user:{role:'admin'}}:{token:'fictional-student-token',portalPrincipal:returnedPrincipal,user:{id:'dddddddddddddddddddddddd',name:'Fictional Student',email:'vtu00000@portal.invalid'}};}};
before(async()=>{await mongoose.connect(`mongodb://127.0.0.1:27017/campus_test_unified_${process.pid}`);await Promise.all([User.init(),Session.init(),AcademicLink.init()]);server=createCampusApp({origins:[origin],linkKey:key,academic,loginLimit:1000}).listen(0);await new Promise(r=>server.once('listening',r));base=`http://127.0.0.1:${server.address().port}/api/campus`;});
after(async()=>{await new Promise(r=>server.close(r));await mongoose.connection.dropDatabase();await mongoose.disconnect();});
beforeEach(async()=>{await Promise.all([User.deleteMany({}),Session.deleteMany({}),AcademicLink.deleteMany({}),Audit.deleteMany({})]);upstream=[];verification=false;returnedPrincipal='vtu00000';const password=await bcrypt.hash('Fictional-password-42',4);owner=await User.create({name:'Owner',username:'owner',email:'owner@example.test',password,role:'admin'});limited=await User.create({name:'Limited',username:'limited',email:'limited@example.test',password,role:'admin',adminPermissions:['events','support'],adminCreatedBy:owner.id});});
async function call(path,method='GET',body,auth){const r=await fetch(base+path,{method,headers:{Origin:origin,...(body?{'Content-Type':'application/json'}:{}),...(auth?{Cookie:auth.cookie,'X-CSRF-Token':auth.body.csrfToken}:{})},body:body?JSON.stringify(body):undefined});return {status:r.status,body:await r.json(),cookie:r.headers.getSetCookie().map(v=>v.split(';')[0]).join('; ')};}
const login=identity=>call('/portal/sign-in','POST',{identity,password:'Fictional-password-42'});
test('one sign-in resolves provisioned admin and faculty roles without sending staff passwords to AMS',async()=>{
 const signed=await login(owner.email);assert.equal(signed.status,200);assert.equal(signed.body.user.accountRole,'admin');assert.equal(upstream.length,0);
 await User.updateOne({_id:limited.id},{$set:{role:'faculty',campusRole:'student'}});const faculty=await login(limited.username);assert.equal(faculty.status,200);assert.equal(faculty.body.user.accountRole,'faculty');assert.equal(upstream.length,0);
 assert.equal((await call('/portal/sign-in','POST',{identity:owner.email,password:'wrong-password',role:'admin'})).status,401);assert.equal(upstream.length,0);
});
test('institutional student mailbox resolves to its AMS username on the same sign-in endpoint',async()=>{
 const signed=await login('VTU00000@veltech.edu.in');assert.equal(signed.status,200);assert.equal(signed.body.user.accountRole,'student');assert.equal(upstream[0].body.username,'vtu00000');assert.equal((await call('/session','GET',undefined,signed)).status,200);
});
test('owner creates explicitly limited admins; limited account cannot reach unassigned administrative modules',async()=>{
 const root=await login(owner.email);const result=await call('/management/users','POST',{name:'New Admin',username:'newadmin',email:'newadmin@example.test',password:'Fictional-password-42',accountRole:'admin',adminPermissions:['events','support']},root);
 assert.equal(result.status,201);assert.equal(result.body.accountRole,'admin');assert.deepEqual(result.body.adminPermissions,['events','support']);assert.equal(result.body.isAdminOwner,false);
 const signed=await login('newadmin');assert.equal((await call('/academic-admin/users','GET',undefined,signed)).status,403);assert.equal((await call('/community/reports/admin','GET',undefined,signed)).status,403);assert.equal((await call('/app-feedback/manage','GET',undefined,signed)).status,200);
 const overview=await call('/management','GET',undefined,signed);assert.equal(overview.status,200);assert.deepEqual(overview.body.users,[]);assert.deepEqual(overview.body.audit,[]);
});
test('delegated admins cannot elevate themselves, reset owners or grant permissions they do not hold',async()=>{
 await User.updateOne({_id:limited.id},{$set:{adminPermissions:['accounts','administrators','events']}});const signed=await login(limited.email);
 assert.equal((await call('/management/users/'+owner.id+'/reset-password','POST',{password:'Changed-password-42'},signed)).status,403);
 assert.equal((await call('/management/users/'+limited.id,'PATCH',{campusRole:'admin',adminPermissions:['events','academics.read']},signed)).status,403);
 const created=await call('/management/users','POST',{name:'Child Admin',username:'childadmin',email:'child@example.test',password:'Fictional-password-42',accountRole:'admin',adminPermissions:['events','academics.read']},signed);assert.equal(created.status,403);
 const child=await call('/management/users','POST',{name:'Child Admin',username:'childadmin',email:'child@example.test',password:'Fictional-password-42',accountRole:'admin',adminPermissions:['events']},signed);assert.equal(child.status,201);assert.equal(child.body.isAdminOwner,false);
});
test('academic read permission does not permit edits; permission changes revoke existing sessions',async()=>{
 await User.updateOne({_id:limited.id},{$set:{adminPermissions:['academics.read']}});const signed=await login(limited.email);assert.equal((await call('/academic-admin/users','GET',undefined,signed)).status,200);assert.equal((await call('/academic-admin/attendance','POST',{status:'PRESENT'},signed)).status,403);
 assert.equal((await call('/academic-admin/audit-logs','GET',undefined,signed)).status,403);assert.equal((await call('/academic-admin/sms-logs','GET',undefined,signed)).status,403);assert.equal((await call('/academic-admin/%61udit-logs','GET',undefined,signed)).status,403);
 const root=await login(owner.email);const changed=await call('/management/users/'+limited.id,'PATCH',{campusRole:'admin',adminPermissions:['events'],department:'',club:''},root);assert.equal(changed.status,200);assert.equal((await call('/session','GET',undefined,signed)).status,401);const again=await login(limited.email);assert.equal((await call('/academic-admin/users','GET',undefined,again)).status,403);
});
test('limited administrator cannot bypass event, forms, room or notice permissions using an admin account role',async()=>{
 await User.updateOne({_id:limited.id},{$set:{adminPermissions:['support']}});const signed=await login(limited.email);
 for(const [path,method,body] of [['/events','POST',{}],['/forms','POST',{}],['/timetable-rooms','POST',{}],['/notices','POST',{}],['/academic-rules','POST',{}],['/faculty-exams','POST',{}]])assert.equal((await call(path,method,body,signed)).status,403,path);
});
test('account-only administrators cannot obtain a linked student password through role changes',async()=>{
 const student=await User.create({name:'Linked student',username:'linkedstudent',email:'linked@example.test',password:'unused-hash',role:'student',portalPrincipal:'vtu00001'});await User.updateOne({_id:limited.id},{$set:{adminPermissions:['accounts']}});const signed=await login(limited.email);
 assert.equal((await call('/management/users/'+student.id+'/reset-password','POST',{password:'Changed-password-42'},signed)).status,403);
 assert.equal((await call('/management/users/'+student.id,'PATCH',{campusRole:'student',accountRole:'faculty',department:'CSE',club:''},signed)).status,200);
 assert.equal((await call('/management/users/'+student.id+'/reset-password','POST',{password:'Changed-password-42'},signed)).status,403);
});
test('notice updates and deletion require assigned publishing permission',async()=>{
 const root=await login(owner.email),notice=await call('/notices','POST',{title:'Fictional announcement',body:'Original'},root);assert.equal(notice.status,201);
 const denied=await login(limited.email);assert.equal((await call('/notices/'+notice.body.id,'PATCH',{title:'Changed',body:'Updated'},denied)).status,403);
 assert.equal((await call('/notices/'+notice.body.id,'PATCH',{title:'Changed',body:'Updated'},root)).status,200);
 const feed=await call('/notices','GET',undefined,root);assert.ok(feed.body.some(row=>row.title==='Changed'));
 assert.equal((await call('/notices/'+notice.body.id,'DELETE',{},root)).status,200);assert.equal((await call('/notices','GET',undefined,root)).body.length,0);
});
test('support staff can archive an issue while its submitting student retains the closed history',async()=>{
 const signed=await login(limited.email);const feedback=await call('/app-feedback','POST',{category:'bug',subject:'Fictional issue',message:'A fictional layout problem',clientRequestId:'fictional-request-00001'},signed);assert.equal(feedback.status,201);
 const id=feedback.body.feedback.id;assert.equal((await call('/app-feedback/'+id,'DELETE',{},signed)).status,200);
 assert.equal((await call('/app-feedback/manage','GET',undefined,signed)).body.feedback.length,0);
 const own=await call('/app-feedback','GET',undefined,signed);assert.equal(own.body.feedback[0].status,'closed');assert.ok(own.body.feedback[0].archivedAt);
});

test('unified student verification stays bound to the browser that requested it',async()=>{
 verification=true;const first=await login('vtu00000');assert.equal(first.body.verificationRequired,true);assert.equal(await Session.countDocuments(),0);
 const body={identity:'vtu00000',password:'Fictional-password-42',challengeId:first.body.challenge.challengeId,answer:'user-entered-test-answer'};
 assert.equal((await call('/portal/sign-in','POST',body)).status,409);
 const complete=await call('/portal/sign-in','POST',body,first);assert.equal(complete.status,200);assert.equal(complete.body.user.accountRole,'student');
});
test('published college forms do not expose response management to an unrelated limited admin',async()=>{
 const root=await login(owner.email),created=await call('/forms','POST',{title:'Fictional form',scope:'college',state:'published',fields:[{id:'response',label:'Response',type:'text',required:true}]},root);assert.equal(created.status,201);
 const signed=await login(limited.email),view=await call('/forms/'+created.body.id,'GET',undefined,signed);assert.equal(view.status,200);assert.equal(view.body.canManage,false);
 assert.equal((await call('/forms/'+created.body.id+'/responses','GET',undefined,signed)).status,403);
});
test('owners can revoke limited accounts but protected owner access cannot be deleted',async()=>{
 const root=await login(owner.email),signed=await login(limited.email);assert.equal((await call('/management/users/'+limited.id,'DELETE',{},root)).status,200);assert.equal((await call('/session','GET',undefined,signed)).status,401);assert.equal((await login(limited.email)).status,401);
 assert.equal((await call('/management/users/'+owner.id,'DELETE',{},root)).status,409);
});

test('verified AMS login enables returning workspace password without upstream calls or timestamp changes',async()=>{
 const signed=await login('vtu00000');assert.equal(signed.status,200);
 const user=await User.findOne({portalPrincipal:'vtu00000'});assert.equal(await bcrypt.compare('Fictional-password-42',user.password),true);assert.ok(user.portalPasswordSetAt);
 const link=await AcademicLink.findOne({user:user.id});const verified=user.portalPrincipalVerifiedAt.getTime();
 upstream=[];verification=true;
 for(const identity of ['VTU00000','vtu00000@veltech.edu.in']){const again=await login(identity);assert.equal(again.status,200);assert.equal(again.body.source,'workspace-password');assert.equal(again.body.user.password,undefined);}
 assert.equal(upstream.length,0);assert.equal((await User.findById(user.id)).portalPrincipalVerifiedAt.getTime(),verified);assert.equal((await AcademicLink.findOne({user:user.id})).linkedAt.getTime(),link.linkedAt.getTime());
 const wrong=await call('/portal/sign-in','POST',{identity:'vtu00000',password:'Wrong-password-42'});assert.equal(wrong.body.verificationRequired,true);assert.equal(wrong.body.user,undefined);
});
test('legacy, unverified and overlong credentials never establish a local portal verifier',async()=>{
 const long='é'.repeat(40);const first=await call('/portal/sign-in','POST',{identity:'vtu00000',password:long});assert.equal(first.status,200);let user=await User.findOne({portalPrincipal:'vtu00000'});assert.equal(user.portalPasswordSetAt,undefined);
 verification=true;upstream=[];assert.equal((await call('/portal/sign-in','POST',{identity:'vtu00000',password:long})).body.verificationRequired,true);assert.equal(upstream.length,1);
 await User.updateOne({_id:user.id},{$set:{password:await bcrypt.hash('Fictional-password-42',4)},$unset:{portalPrincipalVerifiedAt:1}});upstream=[];assert.equal((await login('vtu00000')).body.verificationRequired,true);assert.equal(upstream.length,1);
});
test('a different upstream principal cannot receive the submitted password or a new campus binding',async()=>{
 returnedPrincipal='vtu00001';const result=await login('vtu00000');assert.equal(result.status,502);assert.equal(await User.countDocuments({portalPrincipal:{$exists:true}}),0);assert.equal(await Session.countDocuments(),0);assert.equal(await AcademicLink.countDocuments(),0);
});
test('explicit upstream verification remains browser-bound even after a workspace password exists',async()=>{
 await login('vtu00000');verification=true;
 const first=await call('/portal/sign-in','POST',{identity:'vtu00000',password:'Changed-AMS-password-42'});
 const body={identity:'vtu00000',password:'Fictional-password-42',challengeId:first.body.challenge.challengeId,answer:'human-entered-test-code'};
 assert.equal((await call('/portal/sign-in','POST',body)).status,409);
 upstream=[];const verified=await call('/portal/sign-in','POST',body,first);assert.equal(verified.status,200);assert.equal(verified.body.source,'ams-manual-login');assert.equal(upstream[0].body.challengeId,body.challengeId);
});
test('logout revokes the app session while a verified returning login needs no university request',async()=>{
 const signed=await login('vtu00000');assert.equal((await call('/logout','POST',{},signed)).status,200);assert.equal((await call('/session','GET',undefined,signed)).status,401);
 upstream=[];verification=true;const again=await login('vtu00000');assert.equal(again.body.source,'workspace-password');assert.equal(upstream.length,0);assert.equal((await call('/session','GET',undefined,again)).status,200);
});
test('alternate password endpoints do not bypass a portal account binding or verifier guard',async()=>{
 await login('vtu00000');const user=await User.findOne({portalPrincipal:'vtu00000'});
 await User.updateOne({_id:user.id},{$unset:{portalPasswordSetAt:1}});assert.equal((await call('/login','POST',{identity:user.email,password:'Fictional-password-42'})).status,401);
 await User.updateOne({_id:user.id},{$set:{portalPasswordSetAt:new Date(),portalAcademicId:'invalid-binding'}});assert.equal((await call('/login','POST',{identity:user.email,password:'Fictional-password-42'})).status,401);
 await User.updateOne({_id:user.id},{$set:{portalAcademicId:'dddddddddddddddddddddddd',isActive:false}});upstream=[];assert.equal((await login('vtu00000')).status,401);assert.equal(upstream.length,0);
});
test('a new long upstream password invalidates the previous short application verifier',async()=>{
 await login('vtu00000');const old=await User.findOne({portalPrincipal:'vtu00000'});
 const result=await call('/portal/login','POST',{username:'vtu00000',password:'é'.repeat(40)});assert.equal(result.status,200);
 const updated=await User.findById(old.id);assert.equal(updated.portalPasswordSetAt,undefined);assert.equal(await bcrypt.compare('Fictional-password-42',updated.password),false);
});
