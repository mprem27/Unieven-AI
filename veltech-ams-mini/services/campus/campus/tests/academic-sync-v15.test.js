import test,{before,after,beforeEach} from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import bcrypt from 'bcrypt';
import crypto from 'node:crypto';
import {createCampusApp} from '../server.js';
import {encryptToken} from '../security.js';
import User from '../../models/User.js';
import {Session,AcademicLink} from '../models.js';

let server,base;const origin='http://localhost:5173',key=crypto.randomBytes(32).toString('hex');
const fileId='abcdef012345678901234567',calls=[];
const status={state:'partial',source:'ams',lastAttemptAt:'2026-10-15T10:00:00Z',lastSuccessAt:'2026-10-15T10:00:01Z',message:'Some AMS sections are unavailable.',modules:[{id:'fees',label:'Fees & receipts',state:'unsupported',lastAttemptAt:'2026-10-15T10:00:00Z',lastSuccessAt:null,error:'Data not available',recordCount:0,source:'unavailable',retained:false}]};
const academic={request:async(token,path)=>{
 calls.push({token,path});
 if(path==='/campus/sync-status')return status;
 if(path===`/campus/documents/${fileId}`){
  if(token!=='owner-academic-token')throw Object.assign(new Error('AMS file not available.'),{status:404});
  return {name:'Own certificate.pdf',contentType:'application/pdf',base64:Buffer.from('%PDF-1.7\nSynthetic fixture').toString('base64')};
 }
 return {};
}};
before(async()=>{await mongoose.connect(`mongodb://127.0.0.1:27017/campus_test_academic_sync_v15_${process.pid}`);await Promise.all([User.init(),Session.init(),AcademicLink.init()]);server=createCampusApp({academic,linkKey:key,origins:[origin],loginLimit:1000}).listen(0);await new Promise(r=>server.once('listening',r));base=`http://127.0.0.1:${server.address().port}/api/campus`;});
after(async()=>{await new Promise(r=>server.close(r));await mongoose.connection.dropDatabase();await mongoose.disconnect();});
beforeEach(async()=>{calls.length=0;await Promise.all([User.deleteMany({}),Session.deleteMany({}),AcademicLink.deleteMany({})]);});
async function account(name,token){
 const user=await User.create({username:name,email:`${name}@example.test`,password:await bcrypt.hash('Synthetic!234',4),name,role:'student'});
 await AcademicLink.create({user:user._id,academicId:new mongoose.Types.ObjectId().toString(),email:user.email,sealedToken:encryptToken(token,key),managed:false});
 const response=await fetch(base+'/login',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify({identity:user.email,password:'Synthetic!234'})});
 assert.equal(response.status,200);return response.headers.get('set-cookie').split(';')[0];
}
test('sync status is authenticated and returns the owned source contract without source network requests',async()=>{
 assert.equal((await fetch(base+'/academics/sync-status')).status,401);assert.equal(calls.length,0);
 const cookie=await account('syncowner','owner-academic-token');
 const response=await fetch(base+'/academics/sync-status',{headers:{Cookie:cookie}});
 assert.equal(response.status,200);assert.deepEqual(await response.json(),status);
 assert.equal(response.headers.get('cache-control'),'private, no-store');
 assert.deepEqual(calls,[{token:'owner-academic-token',path:'/campus/sync-status'}]);
});
test('cached file download keeps owner authorization, attachment and no-store headers',async()=>{
 assert.equal((await fetch(base+`/academics/documents/${fileId}`)).status,401);
 const own=await account('fileowner','owner-academic-token'),other=await account('otherowner','other-academic-token');
 const response=await fetch(base+`/academics/documents/${fileId}`,{headers:{Cookie:own}});
 assert.equal(response.status,200);assert.equal(await response.text(),'%PDF-1.7\nSynthetic fixture');
 assert.match(response.headers.get('content-disposition'),/^attachment;/);assert.equal(response.headers.get('content-type'),'application/pdf');
 assert.equal(response.headers.get('cache-control'),'private, no-store');assert.equal(response.headers.get('x-content-type-options'),'nosniff');
 assert.equal((await fetch(base+`/academics/documents/${fileId}`,{headers:{Cookie:other}})).status,404);
 assert.equal((await fetch(base+'/academics/documents/not-an-id',{headers:{Cookie:own}})).status,400);
});
