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
const calls=[];let bundled=true,failure=0;
const academic={request:async(token,path)=>{
 calls.push({token,path});
 if(path==='/campus/workspace'){
  if(failure)throw Object.assign(new Error('Private workspace temporarily unavailable'),{status:failure});
  if(bundled)return {workspaceVersion:1,profile:{name:token==='owner-academic-token'?'Owned profile':'Other profile'},academic:{courses:[]},summary:[],records:[],subjects:[],timetable:[],notifications:[],syncStatus:{state:'idle'},errors:{}};
 }
 if(path==='/profile')return {name:'Legacy owned profile'};
 return {};
}};
before(async()=>{await mongoose.connect(`mongodb://127.0.0.1:27017/campus_test_workspace_bundle_${process.pid}`);await Promise.all([User.init(),Session.init(),AcademicLink.init()]);server=createCampusApp({academic,linkKey:key,origins:[origin],loginLimit:1000}).listen(0);await new Promise(r=>server.once('listening',r));base=`http://127.0.0.1:${server.address().port}/api/campus`;});
after(async()=>{await new Promise(r=>server.close(r));await mongoose.connection.dropDatabase();await mongoose.disconnect();});
beforeEach(async()=>{calls.length=0;bundled=true;failure=0;await Promise.all([User.deleteMany({}),Session.deleteMany({}),AcademicLink.deleteMany({})]);});
async function account(name,token){
 const user=await User.create({username:name,email:`${name}@example.test`,password:await bcrypt.hash('Synthetic!234',4),name,role:'student'});
 await AcademicLink.create({user:user._id,academicId:new mongoose.Types.ObjectId().toString(),email:user.email,sealedToken:encryptToken(token,key),managed:false});
 const response=await fetch(base+'/login',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify({identity:user.email,password:'Synthetic!234'})});
 assert.equal(response.status,200);return response.headers.get('set-cookie').split(';')[0];
}
test('the owned workspace uses one authenticated private request and no-store',async()=>{
 assert.equal((await fetch(base+'/academics/overview')).status,401);assert.equal(calls.length,0);
 const cookie=await account('bundleowner','owner-academic-token');
 const response=await fetch(base+'/academics/overview',{headers:{Cookie:cookie}});
 assert.equal(response.status,200);assert.equal((await response.json()).profile.name,'Owned profile');
 assert.equal(response.headers.get('cache-control'),'private, no-store');
 assert.deepEqual(calls,[{token:'owner-academic-token',path:'/campus/workspace'}]);
});
test('each account resolves its own academic token without reusing another workspace',async()=>{
 const own=await account('owner','owner-academic-token'),other=await account('other','other-academic-token');
 const responses=await Promise.all([fetch(base+'/academics/overview',{headers:{Cookie:own}}),fetch(base+'/academics/overview',{headers:{Cookie:other}})]);
 assert.deepEqual(await Promise.all(responses.map(async response=>(await response.json()).profile.name)),['Owned profile','Other profile']);assert.equal(calls.length,2);
});
test('an older private deployment retains legacy workspace compatibility',async()=>{
 failure=404;const cookie=await account('legacy','owner-academic-token');
 const response=await fetch(base+'/academics/overview',{headers:{Cookie:cookie}});
 assert.equal(response.status,200);assert.equal((await response.json()).profile.name,'Legacy owned profile');assert.equal(calls.length,8);
});
test('a busy private service does not trigger a second fan-out',async()=>{
 failure=503;const cookie=await account('busy','owner-academic-token');
 const response=await fetch(base+'/academics/overview',{headers:{Cookie:cookie}});
 assert.equal(response.status,503);assert.equal(calls.length,1);
});
