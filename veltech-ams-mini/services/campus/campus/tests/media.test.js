import test,{before,after,beforeEach} from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import mongoose from 'mongoose';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {registerMedia} from '../routes/media.js';
import {CampusMedia,mediaUrl,requireOwnedMedia,inspectMedia,restrictOrphanedMedia} from '../services/media-store.js';
import {CampusPost} from '../models.js';
import User from '../../models/User.js';
import Follow from '../../models/Follow.js';
import Reel from '../../models/Reel.js';
import {canManageEvent} from '../policy.js';
let server,base,directory,owner,viewer;
const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9ZvmYAAAAASUVORK5CYII=','base64');
before(async()=>{
 await mongoose.connect(`mongodb://127.0.0.1:27017/campus_test_media_${process.pid}`);await Promise.all([User.init(),CampusMedia.init(),Follow.init()]);
 directory=await fs.mkdtemp(path.join(os.tmpdir(),'campus-media-'));
 const app=express();app.use((req,res,next)=>{req.user=req.headers['x-test-user']?{_id:req.headers['x-test-user']}:null;next();});
 const router=express.Router();registerMedia(router,{mediaDirectory:directory,auth(req,res,next){if(!req.user)return res.status(401).json({message:'Sign in'});next();}});app.use('/api/campus',router);app.use((error,req,res,next)=>res.status(error.status || 500).json({message:error.message}));
 server=app.listen(0);await new Promise(resolve=>server.once('listening',resolve));base=`http://127.0.0.1:${server.address().port}/api/campus`;
});
after(async()=>{await new Promise(resolve=>server.close(resolve));await mongoose.connection.dropDatabase();await mongoose.disconnect();await fs.rm(directory,{recursive:true,force:true});});
beforeEach(async()=>{await Promise.all([User.deleteMany({}),CampusMedia.deleteMany({}),CampusPost.deleteMany({}),Reel.deleteMany({}),Follow.deleteMany({})]);owner=await User.create({username:'owner',email:'owner@example.edu',password:'unused'});viewer=await User.create({username:'viewer',email:'viewer@example.edu',password:'unused'});});
async function upload(bytes=png,type='image/png',user=owner){const body=new FormData();body.append('file',new Blob([bytes],{type}),'test.png');body.append('visibility','public');const response=await fetch(base+'/media/upload',{method:'POST',headers:user?{'x-test-user':user.id}:{},body});return {status:response.status,body:await response.json()};}
const get=(id,user=owner,headers={})=>fetch(base+'/media/'+id,{headers:{...(user?{'x-test-user':user.id}:{}),...headers}});
test('uploads store checked binary contents privately and unauthenticated calls fail',async()=>{
 assert.equal((await upload(png,'image/png',null)).status,401);
 const uploaded=await upload();assert.equal(uploaded.status,201);assert.equal(uploaded.body.kind,'image');assert.equal(uploaded.body.mime,'image/png');assert.equal(uploaded.body.size,png.length);
 const response=await get(uploaded.body.id);assert.equal(response.status,200);assert.deepEqual(Buffer.from(await response.arrayBuffer()),png);assert.equal(response.headers.get('x-content-type-options'),'nosniff');
 assert.equal((await get(uploaded.body.id,viewer)).status,404);assert.equal((await get(uploaded.body.id,null)).status,401);
});
test('spoofed MIME, SVG, unsupported contents and oversized images are rejected',async()=>{
 assert.equal((await upload(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script/></svg>'))).status,400);
 assert.equal((await upload(Buffer.alloc(30))).status,400);
 const oversized=Buffer.concat([png,Buffer.alloc(8*1024*1024)]);assert.equal((await upload(oversized)).status,413);
});
test('media follows active post visibility and accepted connections, including privacy changes',async()=>{
 const uploaded=await upload(),post=await CampusPost.create({user:owner.id,text:'Photo',image:uploaded.body.url});
 assert.equal((await get(uploaded.body.id,viewer)).status,200);
 await User.updateOne({_id:owner.id},{$set:{isPrivate:true}});assert.equal((await get(uploaded.body.id,viewer)).status,404);
 await Follow.create({from:viewer.id,to:owner.id,status:'requested'});assert.equal((await get(uploaded.body.id,viewer)).status,404);
 await Follow.updateOne({from:viewer.id,to:owner.id},{$set:{status:'accepted'}});assert.equal((await get(uploaded.body.id,viewer)).status,200);
 await CampusPost.deleteOne({_id:post.id});await restrictOrphanedMedia(uploaded.body.url,owner);assert.equal((await get(uploaded.body.id,viewer)).status,404);
});
test('range requests support playback, suffixes and reject invalid ranges',async()=>{
 const uploaded=await upload();let response=await get(uploaded.body.id,owner,{Range:'bytes=0-7'});assert.equal(response.status,206);assert.equal(response.headers.get('content-range'),`bytes 0-7/${png.length}`);assert.deepEqual(Buffer.from(await response.arrayBuffer()),png.subarray(0,8));
 response=await get(uploaded.body.id,owner,{Range:'bytes=-4'});assert.equal(response.status,206);assert.deepEqual(Buffer.from(await response.arrayBuffer()),png.subarray(-4));
 assert.equal((await get(uploaded.body.id,owner,{Range:'bytes=999-1000'})).status,416);assert.equal((await get(uploaded.body.id,owner,{Range:'bytes=0-1,3-4'})).status,416);
 response=await fetch(base+'/media/'+uploaded.body.id,{method:'HEAD',headers:{'x-test-user':owner.id}});assert.equal(response.status,200);assert.equal((await response.arrayBuffer()).byteLength,0);
});
test('attachment helpers reject another user media, external URLs and wrong kinds',async()=>{
 const uploaded=await upload();assert.equal((await requireOwnedMedia(owner,uploaded.body.url,{kind:'image'})).id,uploaded.body.id);
 await assert.rejects(requireOwnedMedia(viewer,uploaded.body.id),error=>error.status===403);await assert.rejects(requireOwnedMedia(owner,'https://example.org/photo.png'),error=>error.status===400);await assert.rejects(requireOwnedMedia(owner,uploaded.body.id,{kind:'video'}),error=>error.status===400);
 assert.equal(mediaUrl(uploaded.body.id),uploaded.body.url);
});
test('reel thumbnails are protected by the same private item rules as their videos',async()=>{
 const uploaded=await upload();await Reel.collection.insertOne({user:owner._id,video:'existing-video',thumbnail:uploaded.body.url,visibility:'private',isArchived:false});
 assert.equal((await get(uploaded.body.id,viewer)).status,404);await Reel.collection.updateMany({},{$set:{visibility:'public'}});assert.equal((await get(uploaded.body.id,viewer)).status,200);await Reel.deleteMany({});assert.equal((await get(uploaded.body.id,viewer)).status,404);
});
test('only supported media signatures determine the served MIME and no user filename reaches disk',async()=>{
 const uploaded=await upload(png,'text/html');assert.equal(uploaded.status,201);assert.equal(uploaded.body.mime,'image/png');const stored=await CampusMedia.findById(uploaded.body.id);assert.match(stored.key,/^[a-f0-9]{48}$/);assert.equal(inspectMedia(png).kind,'image');
});
test('uploaded profile photos obey account privacy and disappear when their owner is disabled',async()=>{
 const uploaded=await upload();await User.updateOne({_id:owner.id},{$set:{image:uploaded.body.url}});assert.equal((await get(uploaded.body.id,viewer)).status,200);
 await User.updateOne({_id:owner.id},{$set:{isPrivate:true}});assert.equal((await get(uploaded.body.id,viewer)).status,404);
 await Follow.create({from:viewer.id,to:owner.id,status:'accepted'});assert.equal((await get(uploaded.body.id,viewer)).status,200);
 await User.collection.updateOne({_id:owner._id},{$set:{isActive:false}});assert.equal((await get(uploaded.body.id,viewer)).status,404);
});
test('event posters are visible only while attached to an active event owned by the uploader',async()=>{
 const uploaded=await upload();const inserted=await mongoose.connection.db.collection('events').insertOne({createdBy:owner._id,image:uploaded.body.url,status:'upcoming',archivedAt:null});assert.equal((await get(uploaded.body.id,viewer)).status,200);
 await mongoose.connection.db.collection('events').updateOne({_id:inserted.insertedId},{$set:{archivedAt:new Date()}});assert.equal((await get(uploaded.body.id,viewer)).status,404);await mongoose.connection.db.collection('events').deleteMany({});
});
test('an authorized same-scope organizer can replace another organizer event poster and students can read it',async()=>{
 await User.updateOne({_id:owner.id},{$set:{campusRole:'department_coordinator',department:'CSE'}});
 const editor=await User.create({username:'editor',email:'editor@example.edu',password:'unused',campusRole:'department_coordinator',department:'CSE'});
 const original=await upload(),replacement=await upload(png,'image/png',editor);
 const event={createdBy:owner._id,scope:'department',department:'CSE',image:original.body.url,status:'upcoming',archivedAt:null};
 const inserted=await mongoose.connection.db.collection('events').insertOne(event);
 assert.equal(canManageEvent(editor,event),true);
 const checked=await requireOwnedMedia(editor,replacement.body.url,{kind:'image'});
 await mongoose.connection.db.collection('events').updateOne({_id:inserted.insertedId},{$set:{image:mediaUrl(checked._id)}});
 const response=await get(replacement.body.id,viewer);assert.equal(response.status,200);assert.deepEqual(Buffer.from(await response.arrayBuffer()),png);
 assert.equal((await get(original.body.id,viewer)).status,404);
 await mongoose.connection.db.collection('events').updateOne({_id:inserted.insertedId},{$set:{archivedAt:new Date()}});
 assert.equal((await get(replacement.body.id,viewer)).status,404);
 await mongoose.connection.db.collection('events').deleteMany({});
});
