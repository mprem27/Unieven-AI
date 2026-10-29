import test,{before,after,beforeEach} from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import mongoose from 'mongoose';
import {MongoWindowRateStore,createCampusTrafficControls} from '../services/traffic-controls.js';

const servers=[];let clock=1700000000000;
before(async()=>{await mongoose.connect(`mongodb://127.0.0.1:27017/campus_test_traffic_${process.pid}`);});
after(async()=>{for(const server of servers)await new Promise(resolve=>server.close(resolve));await mongoose.connection.dropDatabase();await mongoose.disconnect();});
beforeEach(async()=>{clock=1700000000000;await mongoose.connection.db.collection('campus_rate_limits').deleteMany({});});
async function api(options={}) {
  const controls=createCampusTrafficControls({production:true,env:{CAMPUS_API_RATE_LIMIT:'2'},now:()=>clock,...options}),app=express();
  app.use((req,_res,next)=>{if(req.headers['x-fixture-user'])req.user={_id:req.headers['x-fixture-user']};next();});app.use(controls.general);app.get('/health',(_req,res)=>res.json({status:'ok'}));app.get('/resource',(_req,res)=>res.json({ok:true}));
  app.use((error,_req,res,_next)=>res.status(error.status || 500).json({message:error.message}));
  const server=app.listen(0);servers.push(server);await new Promise(resolve=>server.once('listening',resolve));return `http://127.0.0.1:${server.address().port}`;
}
test('separate app replicas share one allowance and health checks do not consume it',async()=>{
  const left=await api(),right=await api();
  for(let i=0;i<3;i++)assert.equal((await fetch(left+'/health')).status,200);
  assert.equal((await fetch(left+'/resource')).status,200);
  assert.equal((await fetch(right+'/resource')).status,200);
  const denied=await fetch(left+'/resource');assert.equal(denied.status,429);assert.ok(denied.headers.get('retry-after'));
  const rows=await mongoose.connection.db.collection('campus_rate_limits').find({}).toArray();assert.equal(rows.length,1);assert.equal(rows[0].count,3);assert.ok(rows[0].expiresAt instanceof Date);assert.doesNotMatch(rows[0]._id,/127\.0\.0\.1/);
});
test('concurrent increments from distinct stores preserve every hit and window rollover resets',async()=>{
  const left=new MongoWindowRateStore({bucket:'concurrent',now:()=>clock}),right=new MongoWindowRateStore({bucket:'concurrent',now:()=>clock});
  left.init({windowMs:60000});right.init({windowMs:60000});
  const values=await Promise.all(Array.from({length:24},(_,index)=>(index%2?left:right).increment('client')));
  assert.deepEqual(values.map(value=>value.totalHits).sort((a,b)=>a-b),Array.from({length:24},(_,i)=>i+1));
  clock+=60000;assert.equal((await right.increment('client')).totalHits,1);
  const index=await mongoose.connection.db.collection('campus_rate_limits').indexes();assert.ok(index.some(value=>value.name==='traffic_expiry' && value.expireAfterSeconds===0));
});
test('MongoDB errors fail closed with 503 rather than granting an independent allowance',async()=>{
  const base=await api({db:()=>{throw new Error('sensitive database detail');}}),response=await fetch(base+'/resource');
  assert.equal(response.status,503);assert.doesNotMatch(await response.text(),/sensitive/);
});
test('bucket scopes stay separate and decrement/reset affect only the current bucket',async()=>{
  const left=new MongoWindowRateStore({bucket:'left',now:()=>clock}),right=new MongoWindowRateStore({bucket:'right',now:()=>clock});
  left.init({windowMs:60000});right.init({windowMs:60000});
  await left.increment('client');await left.increment('client');assert.equal((await right.increment('client')).totalHits,1);
  await left.decrement('client');assert.equal((await left.increment('client')).totalHits,2);await left.resetKey('client');assert.equal((await left.increment('client')).totalHits,1);assert.equal((await right.increment('client')).totalHits,2);
});
test('invalid limit configuration is rejected rather than silently weakening limits',()=>{
  assert.throws(()=>createCampusTrafficControls({env:{CAMPUS_RATE_LIMIT_STORE:'unknown'}}));
  assert.throws(()=>createCampusTrafficControls({env:{CAMPUS_API_RATE_LIMIT:'0'}}));
  assert.throws(()=>new MongoWindowRateStore({bucket:'a.b'}));
});

test('authenticated students behind the same campus NAT receive independent API allowances',async()=>{
 const base=await api();
 for(const user of ['fixture-a','fixture-b'])for(let index=0;index<2;index++)assert.equal((await fetch(base+'/resource',{headers:{'x-fixture-user':user}})).status,200);
 assert.equal((await fetch(base+'/resource',{headers:{'x-fixture-user':'fixture-a'}})).status,429);
});
