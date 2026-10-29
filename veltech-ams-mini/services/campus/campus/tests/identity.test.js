import test,{before,after,beforeEach} from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import mongoose from 'mongoose';
import bcrypt from 'bcrypt';
import {registerIdentity} from '../routes/identity.js';
import {registerPortalLogin} from '../routes/portal-login.js';
import {IdentityChallenge,IdentityProof} from '../models/identity.js';
import {Session} from '../models.js';
import User from '../../models/User.js';
let server,base,mail,config;
const origin='http://localhost:5173';
before(async()=>{
 await mongoose.connect(`mongodb://127.0.0.1:27017/campus_test_identity_${process.pid}`);
 await Promise.all([User.init(),IdentityChallenge.init(),IdentityProof.init(),Session.init()]);
 mail=[];config={cookieSecure:false,selfRegistration:true,auth:(req,res,next)=>next(),identitySecret:'a'.repeat(64),mail:{configured:true,async send(message){mail.push(message);}},identityRateLimit:1000};
 const app=express();app.use(express.json());const router=express.Router();registerIdentity(router,config);registerPortalLogin(router,{...config,academic:{internal(){throw new Error('Recovery must not call AMS.');}}});app.use('/api/campus',router);app.use((error,req,res,next)=>res.status(error.status || (error.code===11000?409:500)).json({message:error.message}));
 server=app.listen(0);await new Promise(resolve=>server.once('listening',resolve));base=`http://127.0.0.1:${server.address().port}/api/campus/identity`;
});
after(async()=>{await new Promise(resolve=>server.close(resolve));await mongoose.connection.dropDatabase();await mongoose.disconnect();});
beforeEach(async()=>{await Promise.all([User.deleteMany({}),IdentityChallenge.deleteMany({}),IdentityProof.deleteMany({}),Session.deleteMany({})]);mail.length=0;config.mail.configured=true;});
const payload={recoveryEmail:'student@example.edu',recoveryEmailVerifiedAt:new Date(),email:'student@example.edu',username:'student',name:'Student Example',password:'Example-long-42'};
const code=()=>mail.at(-1)?.text.match(/\b\d{6}\b/)[0];
async function call(path,body={},cookies=''){
 const response=await fetch(base+path,{method:'POST',headers:{Origin:origin,'Content-Type':'application/json',...(cookies?{Cookie:cookies}:{})},body:JSON.stringify(body)});
 return {status:response.status,body:await response.json(),cookies:response.headers.getSetCookie(),cookie:response.headers.getSetCookie().map(value=>value.split(';')[0]).join('; ')};
}
test('signup delivers a hashed, browser-bound one-use code and grants only the student role',async()=>{
 const requested=await call('/signup/request',{...payload,role:'admin',campusRole:'admin'});assert.equal(requested.status,202);assert.equal(mail.length,1);assert.equal(requested.body.code,undefined);assert.match(mail[0].html || '',/veltech-ams-mini/);assert.ok(mail[0].html.includes(code()));
 const challenge=await IdentityChallenge.findOne();assert.notEqual(challenge.codeHash,code());assert.notEqual(challenge.payload.passwordHash,payload.password);assert.match(requested.cookies[0],/HttpOnly/);assert.match(requested.cookies[0],/SameSite=Strict/);
 const verified=await call('/signup/verify',{challengeId:requested.body.challengeId,code:code()},requested.cookie);assert.equal(verified.status,201);assert.ok(verified.body.csrfToken);assert.match(verified.cookie,/campus_session=/);
 const user=await User.findOne();assert.equal(user.role,'student');assert.equal(user.campusRole,'student');assert.equal(user.isVerified,true);assert.equal(await bcrypt.compare(payload.password,user.password),true);
 assert.equal((await call('/signup/verify',{challengeId:requested.body.challengeId,code:code()},requested.cookie)).status,400);assert.equal(await User.countDocuments(),1);
});
test('codes cannot be verified in another browser and lock after five incorrect attempts',async()=>{
 const requested=await call('/signup/request',payload),body={challengeId:requested.body.challengeId,code:code()};
 assert.equal((await call('/signup/verify',body)).status,400);
 const wrong=body.code==='000000'?'000001':'000000';for(let index=0;index<5;index++)assert.equal((await call('/signup/verify',{...body,code:wrong},requested.cookie)).status,400);
 assert.equal((await call('/signup/verify',body,requested.cookie)).status,400);assert.equal(await User.countDocuments(),0);
});
test('concurrent verification consumes a signup challenge only once',async()=>{
 const requested=await call('/signup/request',payload),body={challengeId:requested.body.challengeId,code:code()};
 const results=await Promise.all([call('/signup/verify',body,requested.cookie),call('/signup/verify',body,requested.cookie)]);
 assert.deepEqual(results.map(r=>r.status).sort(),[201,400]);assert.equal(await User.countDocuments(),1);
});
test('password reset needs an HttpOnly browser proof, revokes all sessions and cannot be replayed',async()=>{
 const user=await User.create({...payload,password:await bcrypt.hash(payload.password,4)});
 await Session.create({user:user.id,tokenHash:'oldtoken',csrfToken:'csrf',expiresAt:new Date(Date.now()+60000)});
 const requested=await call('/reset/request',{email:payload.email});
 const verified=await call('/reset/verify',{challengeId:requested.body.challengeId,code:code()},requested.cookie);assert.equal(verified.status,200);assert.equal(verified.body.proof,undefined);assert.match(verified.cookies[0],/HttpOnly/);
 assert.equal((await call('/reset/complete',{password:'Another-long-pass'},verified.cookie)).status,400);
 const cookies=requested.cookie+'; '+verified.cookie;
 assert.equal((await call('/reset/complete',{password:'Another-long-pass'},cookies)).status,200);
 assert.equal(await bcrypt.compare('Another-long-pass',(await User.findById(user.id)).password),true);assert.equal(await Session.countDocuments(),0);
 assert.equal((await call('/reset/complete',{password:'Third-long-pass'},cookies)).status,400);
});
test('reset responses do not reveal unknown accounts and signup request enforces password byte limits',async()=>{
 const result=await call('/reset/request',{email:'unknown@example.edu'});assert.equal(result.status,202);assert.equal(mail.length,0);assert.equal(result.body.code,undefined);
 assert.equal((await call('/signup/request',{...payload,password:'short'})).status,400);
 assert.equal((await call('/signup/request',{...payload,password:'é'.repeat(37)})).status,400);
});
test('expired challenges fail and repeated email requests enforce a cooldown',async()=>{
 const requested=await call('/signup/request',payload);assert.equal((await call('/signup/request',payload,requested.cookie)).status,429);
 await IdentityChallenge.updateMany({},{$set:{expiresAt:new Date(Date.now()-1000)}});
 assert.equal((await call('/signup/verify',{challengeId:requested.body.challengeId,code:code()},requested.cookie)).status,400);
});
test('unconfigured delivery fails without exposing a fake code',async()=>{
 config.mail.configured=false;const result=await call('/signup/request',payload);assert.equal(result.status,503);assert.equal(mail.length,0);assert.equal(await IdentityChallenge.countDocuments(),0);
});
test('a newly verified reset invalidates an older browser proof',async()=>{
 await User.create({...payload,password:await bcrypt.hash(payload.password,4)});
 const first=await call('/reset/request',{email:payload.email}),proof1=await call('/reset/verify',{challengeId:first.body.challengeId,code:code()},first.cookie);
 await IdentityChallenge.updateMany({},{$set:{issuedAt:new Date(0)}});
 const second=await call('/reset/request',{email:payload.email}),proof2=await call('/reset/verify',{challengeId:second.body.challengeId,code:code()},second.cookie);
 assert.equal((await call('/reset/complete',{password:'New-long-password'},first.cookie+'; '+proof1.cookie)).status,400);
 assert.equal((await call('/reset/complete',{password:'New-long-password'},second.cookie+'; '+proof2.cookie)).status,200);
});
test('verified email recovery enables a portal workspace password without changing its university binding',async()=>{
 const verifiedAt=new Date('2026-01-01T00:00:00Z');
 const user=await User.create({...payload,password:await bcrypt.hash('unknown-random-password',4),portalOnly:true,portalPrincipal:'vtu00000',portalAcademicId:'dddddddddddddddddddddddd',portalPrincipalVerifiedAt:verifiedAt});
 await Session.create({user:user.id,tokenHash:'portal-old-token',csrfToken:'csrf',expiresAt:new Date(Date.now()+60000)});
 const requested=await call('/reset/request',{email:payload.recoveryEmail});
 const proof=await call('/reset/verify',{challengeId:requested.body.challengeId,code:code()},requested.cookie);
 const changed=await call('/reset/complete',{password:'Recovered-workspace-42'},requested.cookie+'; '+proof.cookie);assert.equal(changed.status,200);assert.match(changed.body.message,/AMS password is unchanged/);
 const updated=await User.findById(user.id);assert.ok(updated.portalPasswordSetAt);assert.equal(updated.portalPrincipalVerifiedAt.getTime(),verifiedAt.getTime());assert.equal(updated.portalAcademicId,user.portalAcademicId);assert.equal(await Session.countDocuments(),0);
 const response=await fetch(base.replace(/\/identity$/,'')+'/portal/sign-in',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify({identity:'vtu00000',password:'Recovered-workspace-42'})});
 assert.equal(response.status,200);const signed=await response.json();assert.equal(signed.source,'workspace-password');assert.equal(signed.user.password,undefined);
});
