import test,{before,after,beforeEach} from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import {registerMediaSocial,initializeMediaSocialIndexes,expireAndArchiveStories,archiveStory} from '../routes/media-social.js';
import {harness,member,clearCollections} from './support/social-harness.js';
import Story from '../../models/Story.js';
import StoryArchive from '../../models/StoryArchive.js';
import Reel from '../../models/Reel.js';
import Comment from '../../models/Comment.js';
import Follow from '../../models/Follow.js';
import Event from '../../models/Event.js';
import {CampusMedia,mediaUrl,canAccessMedia} from '../services/media-store.js';
let app,owner,viewer,outsider;
before(async()=>{app=await harness('media_social',registerMediaSocial);await initializeMediaSocialIndexes();await Follow.init();});
after(async()=>app.close());
beforeEach(async()=>{await clearCollections();owner=await member('owner');viewer=await member('viewer');outsider=await member('outsider');});
async function upload(kind='video',user=owner){return CampusMedia.create({owner:user._id,key:Math.random().toString(36).slice(2),mime:kind==='video'?'video/mp4':'image/png',kind,size:30});}
const call=(path,user=viewer,method='GET',body)=>app.call(path,{user,method,body});
async function reel(fields={}){const media=await upload();return Reel.create({user:owner._id,video:mediaUrl(media._id),...fields});}
async function event(){return Event.create({createdBy:owner._id,title:'Technical symposium',image:'poster',date:new Date(Date.now()+86400000),time:'12:00',location:'Hall'});}
test('text stories persist original styling fields and expire after 24 hours',async()=>{
  const start=Date.now();const result=await call('/stories',owner,'POST',{type:'text',text:'Showcase time',textFont:'typewriter',textStyle:'neon',textSize:48,textX:0.2,textY:0.8,textColor:'#ffffff',bgGradient:'ocean',visibility:'followers'});
  assert.equal(result.status,201);const story=await Story.findById(result.body.id);assert.equal(story.textFont,'typewriter');assert.equal(story.textStyle,'neon');assert.equal(story.textX,0.2);assert.equal(story.visibility,'followers');assert.ok(story.expiresAt.getTime()>=start+86400000-1000);
  assert.equal((await call('/stories',viewer)).body.length,0);await Follow.create({from:viewer._id,to:owner._id,status:'accepted'});assert.equal((await call('/stories',viewer)).body.length,1);
});
test('image and video stories require an owned upload and reject unsafe style input',async()=>{
  const image=await upload('image'),other=await upload('image',viewer);
  assert.equal((await call('/stories',owner,'POST',{type:'image',mediaId:image.id})).status,201);
  for(const body of [{type:'image',media:'https://example.org/image.png'},{type:'image',mediaId:other.id},{type:'text',text:'x',textX:4},{type:'text',text:'x',bgGradient:'url(javascript:alert(1))'},{type:'text',text:'x',link:'javascript:alert(1)'}])assert.ok((await call('/stories',owner,'POST',body)).status>=400);
});
test('only accepted followers see private account stories and viewer lists stay author-only',async()=>{
  owner.isPrivate=true;await owner.save();const story=await Story.create({user:owner._id,type:'text',text:'Only followers'});
  await Follow.create({from:viewer._id,to:owner._id,status:'requested'});
  assert.equal((await call(`/stories/${story.id}/view`,viewer,'POST',{})).status,403);assert.equal((await call(`/stories/${story.id}/views`,viewer)).status,403);
  await Follow.updateOne({from:viewer._id,to:owner._id},{$set:{status:'accepted'}});
  assert.equal((await call(`/stories/${story.id}/view`,viewer,'POST',{})).status,200);assert.equal((await call(`/stories/${story.id}/view`,viewer,'POST',{})).status,200);assert.equal((await Story.findById(story.id)).views.length,1);
  const result=await call(`/stories/${story.id}/views`,owner);assert.equal(result.body[0].username,'viewer');assert.equal(result.body[0].email,undefined);
});
test('expiry archives safely before delete, is retry-safe, and never exposes archives to others',async()=>{
  const story=await Story.create({user:owner._id,type:'text',text:'Keep this memory',textFont:'marker',visibility:'private',expiresAt:new Date(Date.now()-1000)});
  const snapshot=story.toObject();assert.equal(await expireAndArchiveStories(),1);await Promise.all([archiveStory(snapshot),archiveStory(snapshot)]);
  assert.equal(await Story.countDocuments(),0);assert.equal(await StoryArchive.countDocuments(),1);const archived=await StoryArchive.findOne();assert.equal(String(archived.originalStory),story.id);assert.equal(archived.textFont,'marker');
  assert.equal((await call('/stories/archive',viewer)).body.length,0);assert.equal((await call('/stories/archive',owner)).body.length,1);
  assert.equal((await call(`/stories/archive/${archived.id}`,viewer,'DELETE')).status,404);assert.equal((await call(`/stories/archive/${archived.id}`,owner,'DELETE')).status,200);
  const indexes=await Story.collection.indexes();assert.ok(indexes.every(index=>index.expireAfterSeconds===undefined));
});
test('archive and delete operations require the author',async()=>{
  const story=await Story.create({user:owner._id,type:'text',text:'Owned story'});
  assert.equal((await call(`/stories/${story.id}/archive`,viewer,'POST',{})).status,403);assert.equal((await call(`/stories/${story.id}`,viewer,'DELETE')).status,404);
  assert.equal((await call(`/stories/${story.id}/archive`,owner,'POST',{})).status,200);assert.equal(await Story.countDocuments(),0);
});
test('reel uploads persist event linkage, overlay metadata and saved state',async()=>{
  const media=await upload(),ev=await event();
  const result=await call('/reels',owner,'POST',{videoId:media.id,caption:'Register for the symposium',eventId:ev.id,overlayText:'Join us',textFont:'impact',textStyle:'outline',textSize:54,textX:0.3,textY:0.7,filter:'vivid',link:'https://example.org/event'});
  assert.equal(result.status,201);const stored=await Reel.findById(result.body.id);assert.equal(String(stored.eventId),ev.id);assert.equal(stored.textFont,'impact');
  const feed=await call(`/reels?eventId=${ev.id}`);assert.equal(feed.body.length,1);assert.equal(feed.body[0].eventId,ev.id);assert.equal(feed.body[0].overlayText,'Join us');
  assert.equal((await call(`/reels/${stored.id}/save`,viewer,'PUT',{saved:true})).status,200);assert.equal((await call(`/reels/${stored.id}/save`,viewer,'PUT',{saved:true})).status,200);
  assert.equal((await call('/reels')).body[0].saved,true);assert.equal((await call(`/reels?eventId=${new mongoose.Types.ObjectId()}`)).body.length,0);
});
test('reels reject missing, foreign, wrong-kind media and nonexistent or cancelled events',async()=>{
  const video=await upload(),image=await upload('image'),foreign=await upload('video',viewer),ev=await event();ev.status='cancelled';await ev.save();
  for(const body of [{video:'https://example.org/video.mp4'},{videoId:foreign.id},{videoId:image.id},{videoId:video.id,eventId:String(new mongoose.Types.ObjectId())},{videoId:video.id,eventId:ev.id}])assert.ok((await call('/reels',owner,'POST',body)).status>=400);
  assert.equal(await Reel.countDocuments(),0);
});
test('reel views count unique playback only and likes are idempotent',async()=>{
  const item=await reel();assert.equal((await call('/reels')).body[0].views,0);assert.equal((await call(`/reels/${item.id}/view`,viewer,'POST',{})).status,400);assert.equal((await call(`/reels/${item.id}/view`,viewer,'POST',{playedSeconds:1})).status,400);
  await Promise.all([call(`/reels/${item.id}/view`,viewer,'POST',{playedSeconds:3}),call(`/reels/${item.id}/view`,viewer,'POST',{playedSeconds:4})]);
  assert.equal((await Reel.findById(item.id)).views,1);await call(`/reels/${item.id}/view`,owner,'POST',{playedSeconds:3});assert.equal((await Reel.findById(item.id)).views,1);
  await call(`/reels/${item.id}/like`,viewer,'PUT',{liked:true});await call(`/reels/${item.id}/like`,viewer,'PUT',{liked:true});assert.equal((await Reel.findById(item.id)).likes.length,1);
});
test('private reel media, interactions, and recommendations cannot be bypassed using known IDs',async()=>{
  const item=await reel({visibility:'private'}),storedMedia=await CampusMedia.findOne();
  assert.equal((await call('/reels')).body.length,0);assert.equal(await canAccessMedia(viewer,storedMedia),false);
  for(const [action,method,body] of [['like','PUT',{liked:true}],['save','PUT',{saved:true}],['view','POST',{playedSeconds:3}],['comments','POST',{text:'Hi'}]])assert.equal((await call(`/reels/${item.id}/${action}`,viewer,method,body)).status,403);
});
test('reel comments support likes and replies, with comment or reel author deletion only',async()=>{
  const item=await reel(),comment=await call(`/reels/${item.id}/comments`,viewer,'POST',{text:'Great event'});assert.equal(comment.status,201);
  await call(`/reels/comments/${comment.body.id}/like`,outsider,'PUT',{liked:true});await call(`/reels/comments/${comment.body.id}/like`,outsider,'PUT',{liked:true});assert.equal((await Comment.findById(comment.body.id)).likes.length,1);
  assert.equal((await call(`/reels/${item.id}/comments`,owner,'POST',{text:'Thank you',parentComment:comment.body.id})).status,201);
  assert.equal((await call(`/reels/comments/${comment.body.id}`,outsider,'DELETE')).status,403);assert.equal((await call(`/reels/comments/${comment.body.id}`,owner,'DELETE')).status,200);
  assert.equal((await call('/reels')).body[0].comments.length,1);
});
test('only reel authors can edit or archive and deleted references stop exposing media',async()=>{
  const item=await reel(),media=await CampusMedia.findOne();assert.equal(await canAccessMedia(viewer,media),true);
  assert.equal((await call(`/reels/${item.id}`,viewer,'PATCH',{caption:'Altered'})).status,403);assert.equal((await call(`/reels/${item.id}`,viewer,'DELETE')).status,404);
  assert.equal((await call(`/reels/${item.id}`,owner,'PATCH',{caption:'Updated',visibility:'private'})).status,200);assert.equal((await Reel.findById(item.id)).caption,'Updated');assert.equal(await canAccessMedia(viewer,media),false);
  assert.equal((await call(`/reels/${item.id}`,owner,'DELETE')).status,200);assert.equal((await call('/reels',owner)).body.length,0);
});

test('startup migrates the original expiry TTL to an archive-safe ordinary index',async()=>{
  await Story.collection.dropIndex('expiresAt_1');await Story.collection.createIndex({expiresAt:1},{expireAfterSeconds:0});
  await initializeMediaSocialIndexes();const indexes=await Story.collection.indexes();assert.ok(indexes.some(index=>index.key.expiresAt===1));assert.ok(indexes.every(index=>index.expireAfterSeconds===undefined));
});

test('current composer gradients, hashtag aliases and mentions persist through archive with owner-only viewers',async()=>{
  const created=await call('/stories',owner,'POST',{type:'text',text:'College showcase',bgGradient:'linear-gradient(135deg,#122a48,#087c79)',filter:'contrast',tags:['robotics','#Showcase'],mentions:['@viewer'],textFont:'classic',textStyle:'highlight',textSize:28,textColor:'#ffffff',textX:0.5,textY:0.5});
  assert.equal(created.status,201);const story=await Story.findById(created.body.id);assert.deepEqual(story.hashtags,['robotics','showcase']);assert.deepEqual(story.mentions,['viewer']);assert.equal(story.tags.length,0);
  await call(`/stories/${story.id}/view`,viewer,'POST',{});const archived=await call(`/stories/${story.id}/archive`,owner,'POST',{});
  assert.equal((await call(`/stories/archive/${archived.body.id}/views`,viewer)).status,404);assert.equal((await call(`/stories/archive/${archived.body.id}/views`,owner)).body[0].username,'viewer');
  const snapshot=await StoryArchive.findById(archived.body.id);assert.deepEqual(snapshot.hashtags,['robotics','showcase']);assert.deepEqual(snapshot.mentions,['viewer']);
});
