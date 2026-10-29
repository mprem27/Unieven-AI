import test,{before,after,beforeEach} from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import mongoose from 'mongoose';
import {registerAcademics} from '../routes/academics.js';
import {harness,member,clearCollections} from './support/social-harness.js';
import {AcademicLink} from '../models.js';
import {encryptToken} from '../security.js';

const key=crypto.randomBytes(32).toString('hex');
const jwt=(sub,exp=Date.now()/1000+3600)=>`${Buffer.from('{"alg":"HS256"}').toString('base64url')}.${Buffer.from(JSON.stringify({sub,role:'student',exp})).toString('base64url')}.synthetic-signature`;
let app,owner,academicId,bootstraps,requests,release,upstreamError,returnedId;
const academic={
 async bootstrap(identity){bootstraps++;if(release)await release;return {token:jwt(returnedId || academicId),user:{id:returnedId || academicId,email:identity.email}};},
 async request(token,path){requests.push({token,path});if(upstreamError)throw Object.assign(new Error('Workspace inactive'),{status:403});return {state:'idle',modules:[]};}
};
before(async()=>{app=await harness('academic_links_v18',(router,config)=>registerAcademics(router,{...config,bridgeEnabled:true,academic,linkKey:key}));await AcademicLink.init();});
after(async()=>app.close());
beforeEach(async()=>{await clearCollections();owner=await member('fixture_owner');academicId=String(new mongoose.Types.ObjectId());bootstraps=0;requests=[];release=null;upstreamError=false;returnedId=null;});
async function link(overrides={}){return AcademicLink.create({user:owner._id,academicId,email:owner.email,sealedToken:encryptToken(jwt(academicId),key),managed:true,...overrides});}

test('valid managed tokens serve repeated owner reads without bootstrapping again',async()=>{
 const saved=await link();
 for(const path of ['/academics/status','/academics/sync-status','/academics/sync-status'])assert.equal((await app.call(path,{user:owner})).status,200);
 assert.equal(bootstraps,0);assert.equal(requests.length,2);assert.equal((await AcademicLink.findById(saved.id)).academicId,academicId);
});
test('simultaneous first reads share one workspace bootstrap',async()=>{
 let unlock;release=new Promise(resolve=>{unlock=resolve;});
 const pending=Array.from({length:12},()=>app.call('/academics/sync-status',{user:owner}));
 // The first bridge call is held until all local requests have had a turn.
 await new Promise(resolve=>setTimeout(resolve,100));unlock();
 const results=await Promise.all(pending);assert.ok(results.every(result=>result.status===200),JSON.stringify(results));
 assert.equal(bootstraps,1);assert.equal(requests.length,12);assert.equal(await AcademicLink.countDocuments({user:owner._id}),1);
});
test('expired managed tokens renew once and retain the durable academic owner',async()=>{
 await link({sealedToken:encryptToken(jwt(academicId,Date.now()/1000-1),key)});
 assert.equal((await app.call('/academics/sync-status',{user:owner})).status,200);
 assert.equal((await app.call('/academics/sync-status',{user:owner})).status,200);
 assert.equal(bootstraps,1);assert.equal(requests.length,2);
});
test('a cached managed token cannot override its durable owner or email binding',async()=>{
 for(const overrides of [{sealedToken:encryptToken(jwt(String(new mongoose.Types.ObjectId())),key)},{email:'other@example.test'}]){
  await AcademicLink.deleteMany({});await link(overrides);
  assert.equal((await app.call('/academics/sync-status',{user:owner})).status,403);
 }
 assert.equal(bootstraps,0);assert.equal(requests.length,0);
});
test('renewal cannot replace an existing academic owner and inactive service access stays denied',async()=>{
 await link({sealedToken:encryptToken(jwt(academicId,1),key)});returnedId=String(new mongoose.Types.ObjectId());
 assert.equal((await app.call('/academics/sync-status',{user:owner})).status,403);
 assert.equal((await AcademicLink.findOne({user:owner._id})).academicId,academicId);
 await AcademicLink.deleteMany({});await link();upstreamError=true;
 assert.equal((await app.call('/academics/sync-status',{user:owner})).status,403);
 assert.equal(bootstraps,1);
});
test('an in-flight renewal cannot overwrite a newly changed durable link',async()=>{
 const saved=await link({sealedToken:encryptToken(jwt(academicId,1),key)});
 let unlock;release=new Promise(resolve=>{unlock=resolve;});
 const pending=app.call('/academics/sync-status',{user:owner});
 await new Promise(resolve=>setTimeout(resolve,75));
 const replacement=String(new mongoose.Types.ObjectId());
 await AcademicLink.updateOne({_id:saved.id},{$set:{academicId:replacement,managed:false,sealedToken:encryptToken(jwt(replacement),key)}});
 unlock();
 assert.equal((await pending).status,409);
 assert.equal((await AcademicLink.findById(saved.id)).academicId,replacement);
 assert.equal(requests.length,0);
});
