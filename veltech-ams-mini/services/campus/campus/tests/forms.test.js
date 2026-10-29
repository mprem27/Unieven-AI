import test,{before,after,beforeEach} from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import {mkdtemp,rm} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import User from '../../models/User.js';
import Event from '../../models/Event.js';
import Registration from '../../models/EventRegistration.js';
import {Session} from '../models.js';
import {hashToken} from '../security.js';
import {createCampusApp} from '../server.js';
import {CampusForm,FormResponse,FormProof,FormChallenge,initializeFormModels} from '../form-models.js';
let server,origin,directory,student,other,faculty,outsider,event,studentAuth,facultyAuth,otherAuth,outsiderAuth;
const webOrigin='http://127.0.0.1:5173';
async function auth(user){const token='a'.repeat(32)+String(user._id).padEnd(32,'b');await Session.create({user:user._id,tokenHash:hashToken(token),csrfToken:'csrf-'+user.id,expiresAt:new Date(Date.now()+3600000)});return {cookie:'campus_session='+token,'x-csrf-token':'csrf-'+user.id};}
async function call(route,{method='GET',body,headers=facultyAuth}={}){const response=await fetch(origin+'/api/campus'+route,{method,headers:{Origin:webOrigin,...(body instanceof FormData?{}:{'Content-Type':'application/json'}),...headers},body:body===undefined?undefined:body instanceof FormData?body:JSON.stringify(body)});const type=response.headers.get('content-type') || '';return {status:response.status,data:type.includes('json')?await response.json():await response.arrayBuffer()};}
const payload=()=>({title:'Workshop reflection',scope:'department',department:'CSE',state:'published',fields:[{id:'reflection',label:'What did you learn?',type:'textarea',required:true}],eventId:event.id,opensAt:new Date(Date.now()-60000).toISOString(),closesAt:new Date(Date.now()+600000).toISOString(),geofence:{latitude:13,longitude:80,radiusMeters:100},requireProof:true,checkIn:true});
const location=()=>({latitude:13,longitude:80,accuracy:10,capturedAt:Date.now()});
const png=()=>{const bytes=Buffer.alloc(32);Buffer.from([137,80,78,71,13,10,26,10]).copy(bytes);bytes.write('IHDR',12);bytes.writeUInt32BE(1,16);bytes.writeUInt32BE(1,20);return bytes;};
async function capture(form,headers=studentAuth,{nonce,mime='image/png',bytes=png(),capturedAt=Date.now()}={}){const challenge=nonce || (await call(`/forms/${form.id}/capture-challenge`,{method:'POST',body:{},headers})).data;const body=new FormData();body.append('file',new Blob([bytes],{type:mime}),'capture.png');body.append('challengeToken',challenge.token);body.append('capturedAt',String(capturedAt));return call(`/forms/${form.id}/captures`,{method:'POST',body,headers});}
async function upload(form,headers=studentAuth){return capture(form,headers);}
async function create(){const response=await call('/forms',{method:'POST',body:payload()});assert.equal(response.status,201,JSON.stringify(response.data));return response.data;}
before(async()=>{directory=await mkdtemp(path.join(os.tmpdir(),'campus-forms-'));await mongoose.connect(`mongodb://127.0.0.1:27017/campus_forms_${process.pid}`);await Promise.all([User.init(),Event.init(),Registration.init(),Session.init(),initializeFormModels()]);server=createCampusApp({proofDirectory:directory,origins:[webOrigin]}).listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));origin=`http://127.0.0.1:${server.address().port}`;});
after(async()=>{if(server)await new Promise(r=>server.close(r));await mongoose.connection.dropDatabase();await mongoose.disconnect();await rm(directory,{recursive:true,force:true});});
beforeEach(async()=>{await Promise.all([User.deleteMany({}),Event.deleteMany({}),Registration.deleteMany({}),Session.deleteMany({}),CampusForm.deleteMany({}),FormResponse.deleteMany({}),FormProof.deleteMany({}),FormChallenge.deleteMany({})]);student=await User.create({username:'student',name:'Student',email:'student@example.edu',password:'hash',department:'CSE'});other=await User.create({username:'other',email:'other@example.edu',password:'hash',department:'CSE'});faculty=await User.create({username:'faculty',email:'faculty@example.edu',password:'hash',role:'faculty',campusRole:'department_coordinator',department:'CSE'});outsider=await User.create({username:'outside',email:'outside@example.edu',password:'hash',role:'faculty',campusRole:'department_coordinator',department:'ECE'});[studentAuth,facultyAuth,otherAuth,outsiderAuth]=await Promise.all([auth(student),auth(faculty),auth(other),auth(outsider)]);event=await Event.create({createdBy:faculty.id,title:'Workshop',image:'/placeholder.png',date:new Date(Date.now()+86400000),time:'10:00',location:'Hall',scope:'department',department:'CSE'});await Registration.create({user:student.id,event:event.id,studentId:'DEMO-01',email:student.email,phone:'0000000000',department:'CSE',status:'registered',qrToken:'test-ticket',qrExpiresAt:new Date(Date.now()+86400000)});});
test('real session, CSRF and persisted scope protect official form authoring',async()=>{
 assert.equal((await call('/forms',{method:'POST',body:payload(),headers:{}})).status,401);
 assert.equal((await call('/forms',{method:'POST',body:payload(),headers:{cookie:facultyAuth.cookie}})).status,403);
 assert.equal((await call('/forms',{method:'POST',body:payload(),headers:studentAuth})).status,403);
 assert.equal((await call('/forms',{method:'POST',body:payload(),headers:outsiderAuth})).status,403);
 const form=await create();assert.equal(form.canManage,true);assert.equal((await call(`/forms/${form.id}/responses`,{headers:studentAuth})).status,403);
 await User.updateOne({_id:other.id},{$set:{campusRole:'department_coordinator'}});
 assert.equal((await call('/forms',{method:'POST',body:payload(),headers:otherAuth})).status,403);
 await User.updateOne({_id:faculty.id},{$set:{campusRole:'student'}});
 assert.equal((await call('/forms',{method:'POST',body:payload()})).status,201);
});
test('private proof is owner-bound and never resolves through social media',async()=>{
 const form=await create(),proof=await upload(form);assert.equal(proof.status,201);assert.match(proof.data.url,/\/forms\/proofs\//);
 assert.equal((await call(proof.data.url.replace('/api/campus',''),{headers:studentAuth})).status,200);
 assert.equal((await call(proof.data.url.replace('/api/campus',''),{headers:otherAuth})).status,404);
 assert.equal((await call(proof.data.url.replace('/api/campus',''),{headers:outsiderAuth})).status,404);
 assert.equal((await call(`/media/${proof.data.id}`,{headers:facultyAuth})).status,404);
 const nonce=await call(`/forms/${form.id}/challenge`,{method:'POST',body:{},headers:studentAuth});
 assert.equal((await call(`/forms/${form.id}/submissions`,{method:'POST',headers:otherAuth,body:{answers:{reflection:'Good'},proofId:proof.data.id,location:location(),challengeToken:nonce.data.token}})).status,403);
});
test('fresh radius challenge and one response per student gate faculty-reviewed event check-in',async()=>{
 const form=await create(),proof=await upload(form),nonce=await call(`/forms/${form.id}/challenge`,{method:'POST',body:{},headers:studentAuth});
 const body={answers:{reflection:'Learned to build secure systems.'},proofId:proof.data.id,location:location(),challengeToken:nonce.data.token};
 assert.equal((await call(`/forms/${form.id}/submissions`,{method:'POST',headers:studentAuth,body:{...body,location:{...location(),latitude:14}}})).status,400);
 const sent=await call(`/forms/${form.id}/submissions`,{method:'POST',headers:studentAuth,body});assert.equal(sent.status,201,JSON.stringify(sent.data));assert.equal(sent.data.status,'pending');
 assert.equal((await call(`/forms/${form.id}/submissions`,{method:'POST',headers:studentAuth,body})).status,409);
 assert.equal((await Registration.findOne({user:student.id})).status,'registered');
 assert.equal((await call(`/forms/${form.id}/responses/${sent.data.id}/review`,{method:'PATCH',body:{status:'approved'},headers:outsiderAuth})).status,403);
 const accepted=await call(`/forms/${form.id}/responses/${sent.data.id}/review`,{method:'PATCH',body:{status:'approved',note:'Verified at venue'}});assert.equal(accepted.status,200,JSON.stringify(accepted.data));
 const ticket=await Registration.findOne({user:student.id});assert.equal(ticket.status,'attended');assert.equal(ticket.locationVerified,true);
 assert.equal((await call(`/forms/${form.id}/responses/${sent.data.id}/review`,{method:'PATCH',body:{status:'approved'}})).status,409);
 assert.equal((await call(proof.data.url.replace('/api/campus',''))).status,200);
});
test('closed windows and post-response question edits are rejected',async()=>{
 const form=await create();await CampusForm.updateOne({_id:form.id},{$set:{closesAt:new Date(Date.now()-1)}});
 assert.equal((await call(`/forms/${form.id}/challenge`,{method:'POST',body:{},headers:studentAuth})).status,409);
 await FormResponse.create({form:form.id,user:student.id,answers:{reflection:'Test'}});
 assert.equal((await call(`/forms/${form.id}`,{method:'PATCH',body:{fields:[{id:'different',label:'Changed',type:'text'}]}})).status,409);
 assert.equal((await call(`/forms/${form.id}`,{method:'PATCH',body:{state:'closed'}})).status,200);
});
test('retry after a response save failure reconciles only the same approved ticket',async()=>{
 const form=await create(),proof=await upload(form),nonce=await call(`/forms/${form.id}/challenge`,{method:'POST',body:{},headers:studentAuth});
 const sent=await call(`/forms/${form.id}/submissions`,{method:'POST',headers:studentAuth,body:{answers:{reflection:'Retry safely'},proofId:proof.data.id,location:location(),challengeToken:nonce.data.token}});
 assert.equal(sent.status,201);
 const original=FormResponse.prototype.save;let failed=false;
 FormResponse.prototype.save=async function(...args){if(this.status==='approved'&&!failed){failed=true;throw new Error('Synthetic storage failure');}return original.apply(this,args);};
 try{assert.equal((await call(`/forms/${form.id}/responses/${sent.data.id}/review`,{method:'PATCH',body:{status:'approved'}})).status,500);}finally{FormResponse.prototype.save=original;}
 assert.equal((await Registration.findOne({user:student.id})).status,'attended');
 const retry=await call(`/forms/${form.id}/responses/${sent.data.id}/review`,{method:'PATCH',body:{status:'approved'}});
 assert.equal(retry.status,200,JSON.stringify(retry.data));assert.equal(retry.data.status,'approved');
});
test('required camera proof rejects normal uploads, expired, replayed, foreign and mismatched captures',async()=>{
 const form=await create(),normal=new FormData();normal.append('file',new Blob([png()],{type:'image/png'}),'gallery.png');
 assert.equal((await call(`/forms/${form.id}/proofs`,{method:'POST',body:normal,headers:studentAuth})).status,400);
 const nonce=(await call(`/forms/${form.id}/capture-challenge`,{method:'POST',body:{},headers:studentAuth})).data;
 assert.equal((await capture(form,otherAuth,{nonce})).status,409);
 assert.equal((await capture(form,studentAuth,{nonce,mime:'image/jpeg'})).status,400);
 assert.equal((await capture(form,studentAuth,{nonce,capturedAt:Date.now()-180000})).status,400);
 assert.equal((await capture(form,studentAuth,{nonce})).status,201);
 assert.equal((await capture(form,studentAuth,{nonce})).status,409);
 const expired=(await call(`/forms/${form.id}/capture-challenge`,{method:'POST',body:{},headers:studentAuth})).data;
 await FormChallenge.updateOne({tokenHash:hashToken(expired.token)},{$set:{expiresAt:new Date(Date.now()-1)}});
 assert.equal((await capture(form,studentAuth,{nonce:expired})).status,409);
 const locationToken=(await call(`/forms/${form.id}/challenge`,{method:'POST',body:{},headers:studentAuth})).data;
 assert.equal((await capture(form,studentAuth,{nonce:locationToken})).status,409);
});
test('required submissions reject legacy upload proof and expired capture evidence',async()=>{
 const form=await create(),proof=await upload(form),nonce=await call(`/forms/${form.id}/challenge`,{method:'POST',body:{},headers:studentAuth});
 const body={answers:{reflection:'Evidence check'},proofId:proof.data.id,location:location(),challengeToken:nonce.data.token};
 await FormProof.updateOne({_id:proof.data.id},{$set:{source:'upload'}});
 assert.equal((await call(`/forms/${form.id}/submissions`,{method:'POST',body,headers:studentAuth})).status,400);
 await FormProof.updateOne({_id:proof.data.id},{$set:{source:'camera',captureExpiresAt:new Date(Date.now()-1)}});
 assert.equal((await call(`/forms/${form.id}/submissions`,{method:'POST',body,headers:studentAuth})).status,400);
});
test('optional proof also requires fresh camera evidence while proof-free responses remain valid',async()=>{
 const form=await create();await CampusForm.updateOne({_id:form.id},{$set:{requireProof:false,checkIn:false,geofence:null}});
 const normal=new FormData();normal.append('file',new Blob([png()],{type:'image/png'}),'gallery.png');
 assert.equal((await call(`/forms/${form.id}/proofs`,{method:'POST',body:normal,headers:studentAuth})).status,400);
 const proof=await capture(form);assert.equal(proof.status,201);
 await FormProof.updateOne({_id:proof.data.id},{$set:{source:'upload'}});
 assert.equal((await call(`/forms/${form.id}/submissions`,{method:'POST',headers:studentAuth,body:{answers:{reflection:'Optional evidence'},proofId:proof.data.id}})).status,400);
 assert.equal((await call(`/forms/${form.id}/submissions`,{method:'POST',headers:studentAuth,body:{answers:{reflection:'No evidence required'}}})).status,201);
});
test('authorized exports include all scoped response rows and only explicit report columns',async()=>{
 const form=await create();await FormResponse.create({form:form.id,user:student.id,answers:{reflection:'=SUM(1,2)'},reviewNote:'Synthetic review',location:{latitude:13,longitude:80,accuracy:10,distanceMeters:4},proof:new mongoose.Types.ObjectId()});
 for(const headers of [{},studentAuth,otherAuth,outsiderAuth])assert.ok([401,403].includes((await call(`/forms/${form.id}/responses/export`,{headers})).status));
 await FormResponse.insertMany(Array.from({length:104},(_,i)=>({form:form.id,user:new mongoose.Types.ObjectId(),answers:{reflection:'Synthetic '+i}})));
 const exported=await call(`/forms/${form.id}/responses/export`);assert.equal(exported.status,200);assert.equal(exported.data.rows.length,105);assert.ok(exported.data.columns.includes('What did you learn?'));assert.ok(exported.data.rows[0].includes('=SUM(1,2)'));
 assert.doesNotMatch(JSON.stringify(exported.data),/latitude|longitude|password|captureChallenge|qrToken|proofUrl/);
 await User.updateOne({_id:faculty.id},{$set:{role:'student'}});
 assert.equal((await call(`/forms/${form.id}/responses/export`)).status,403);
 assert.equal((await call(`/forms/${form.id}/responses`)).status,403);
 await User.updateOne({_id:outsider.id},{$set:{role:'admin'}});
 assert.equal((await call(`/forms/${form.id}/responses/export`,{headers:outsiderAuth})).status,200);
});
test('faculty review never replaces a ticket consumed through another check-in',async()=>{
 const form=await create(),proof=await upload(form),nonce=await call(`/forms/${form.id}/challenge`,{method:'POST',body:{},headers:studentAuth});
 const sent=await call(`/forms/${form.id}/submissions`,{method:'POST',headers:studentAuth,body:{answers:{reflection:'Before QR entry'},proofId:proof.data.id,location:location(),challengeToken:nonce.data.token}});assert.equal(sent.status,201);
 await Registration.updateOne({user:student.id},{$set:{status:'attended',checkInMethod:'qr'}});
 assert.equal((await call(`/forms/${form.id}/responses/${sent.data.id}/review`,{method:'PATCH',body:{status:'approved'}})).status,409);
 assert.equal((await FormResponse.findById(sent.data.id)).status,'pending');assert.equal((await Registration.findOne({user:student.id})).checkInProofResponse,null);
 await User.updateOne({_id:faculty.id},{$set:{role:'student'}});
 assert.equal((await call(proof.data.url.replace('/api/campus',''))).status,404);
});
test('required evidence review rejects legacy uploads but permits later review of a valid submitted capture',async()=>{
 const form=await create(),proof=await upload(form),nonce=await call(`/forms/${form.id}/challenge`,{method:'POST',body:{},headers:studentAuth});
 const sent=await call(`/forms/${form.id}/submissions`,{method:'POST',headers:studentAuth,body:{answers:{reflection:'Review capture metadata'},proofId:proof.data.id,location:location(),challengeToken:nonce.data.token}});assert.equal(sent.status,201);
 await FormProof.updateOne({_id:proof.data.id},{$set:{source:'upload'}});
 assert.equal((await call(`/forms/${form.id}/responses/${sent.data.id}/review`,{method:'PATCH',body:{status:'approved'}})).status,409);
 await FormProof.updateOne({_id:proof.data.id},{$set:{source:'camera',captureExpiresAt:new Date(new Date(sent.data.createdAt).getTime()+1)}});
 assert.equal((await call(`/forms/${form.id}/responses/${sent.data.id}/review`,{method:'PATCH',body:{status:'approved'}})).status,200);
});
