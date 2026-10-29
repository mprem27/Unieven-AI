import {duplicateKey} from '../security.js';
import crypto from 'node:crypto';
import mongoose from 'mongoose';
import {rateLimit,ipKeyGenerator} from 'express-rate-limit';

const collectionName='campus_rate_limits';
const unavailable=()=>Object.assign(new Error('Traffic checks are temporarily unavailable. Please retry shortly.'),{status:503});

// Fixed windows share their counters across campus processes. Only hashed client
// keys reach storage; expired windows are reclaimed by MongoDB's TTL monitor.
export class MongoWindowRateStore {
  localKeys=false;
  constructor({bucket,db=()=>mongoose.connection.db,now=Date.now}={}) {
    if(!/^[a-z][a-z0-9_-]{0,40}$/.test(bucket || ''))throw new Error('A distinct traffic bucket is required');
    this.prefix=`${bucket}:`;this.db=db;this.now=now;
  }
  init({windowMs}) {
    if(!Number.isSafeInteger(windowMs) || windowMs<1000)throw new Error('Invalid traffic window');
    this.windowMs=windowMs;
  }
  async collection() {
    try {
      const collection=this.db()?.collection(collectionName);
      if(!collection)throw unavailable();
      // Retry initialization on the next request after a transient DB failure.
      this.ready ??= collection.createIndex({expiresAt:1},{expireAfterSeconds:0,name:'traffic_expiry'}).catch(error=>{this.ready=undefined;throw error;});
      await this.ready;return collection;
    }catch{throw unavailable();}
  }
  window(key) {
    const start=Math.floor(this.now()/this.windowMs)*this.windowMs;
    return {_id:`${this.prefix}${start}:${crypto.createHash('sha256').update(String(key)).digest('hex')}`,resetTime:new Date(start+this.windowMs)};
  }
  async increment(key) {
    const {_id,resetTime}=this.window(key),collection=await this.collection();
    try {
      let row;
      try {row=await collection.findOneAndUpdate({_id},{$inc:{count:1},$setOnInsert:{expiresAt:resetTime}},{upsert:true,returnDocument:'after'});}
      catch(error) {
        // Two replicas may both insert a previously unseen bucket. The unique
        // _id prevents duplicates; the losing insert must still count its hit.
        if(!duplicateKey(error))throw error;
        row=await collection.findOneAndUpdate({_id},{$inc:{count:1}},{returnDocument:'after'});
      }
      if(!Number.isSafeInteger(row?.count) || row.count<1)throw unavailable();
      return {totalHits:row.count,resetTime};
    }catch{throw unavailable();}
  }
  async decrement(key) {
    const {_id}=this.window(key),collection=await this.collection();
    try {await collection.updateOne({_id,count:{$gt:0}},{$inc:{count:-1}});}catch{throw unavailable();}
  }
  async resetKey(key) {
    const {_id}=this.window(key),collection=await this.collection();
    try {await collection.deleteOne({_id});}catch{throw unavailable();}
  }
}

function positive(value,fallback) {
  const result=Number(value ?? fallback);
  if(!Number.isSafeInteger(result) || result<1 || result>100000)throw new Error('Traffic limits must be integers between 1 and 100000');
  return result;
}

export function createCampusTrafficControls({production=process.env.NODE_ENV==='production',env=process.env,db,now,loginLimit,identityRateLimit}={}) {
  const mode=env.CAMPUS_RATE_LIMIT_STORE || (production?'mongo':'memory');
  if(!['mongo','memory'].includes(mode))throw new Error('CAMPUS_RATE_LIMIT_STORE must be mongo or memory');
  const make=(bucket,windowMs,limit,message,extra={})=>rateLimit({
    windowMs,limit,standardHeaders:'draft-8',legacyHeaders:false,passOnStoreError:false,
    ...(mode==='mongo'?{store:new MongoWindowRateStore({bucket,db,now})}:{}),message:{message},...extra,
  });
  return {
    mode,
    general:make('api',60000,positive(env.CAMPUS_API_RATE_LIMIT,120),'Too many requests. Wait a minute before retrying.',{keyGenerator:req=>req.user?`user:${req.user._id}`:`ip:${ipKeyGenerator(req.ip)}`,skip:req=>req.method==='GET' && req.path==='/health'}),
    portal:make('portal',15*60000,positive(env.CAMPUS_PORTAL_RATE_LIMIT,30),'Too many portal attempts. Please wait.',{keyGenerator:req=>`${ipKeyGenerator(req.ip)}:${String(req.body?.username || '').trim().toLowerCase().slice(0,100)}`}),
    login:make('login',15*60000,positive(loginLimit ?? env.CAMPUS_LOGIN_RATE_LIMIT,15),'Too many sign-in attempts. Please wait.',{keyGenerator:req=>`${ipKeyGenerator(req.ip)}:${String(req.body?.identity || '').trim().toLowerCase().slice(0,200)}`}),
    identity:make('identity',15*60000,positive(identityRateLimit ?? env.CAMPUS_IDENTITY_RATE_LIMIT,35),'Too many verification attempts. Please wait before retrying.'),
    formWrites:make('form-writes',60000,positive(env.CAMPUS_FORM_RATE_LIMIT,30),'Too many form changes. Please wait a minute.',{keyGenerator:req=>String(req.user._id)}),
  };
}
