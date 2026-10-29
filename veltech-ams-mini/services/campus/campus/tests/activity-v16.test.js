import test,{before,after,beforeEach} from 'node:test';
import assert from 'node:assert/strict';
import {registerActivity} from '../routes/activity.js';
import {registerCommunityExtras} from '../routes/community-extra.js';
import {registerSocial} from '../routes/social.js';
import {registerMediaSocial} from '../routes/media-social.js';
import {registerRecommendations} from '../routes/recommendations.js';
import {registerCommunityReports} from '../routes/community-reports.js';
import {harness,member,clearCollections} from './support/social-harness.js';
import {CampusPost} from '../models.js';
import Post from '../../models/Post.js';
import Reel from '../../models/Reel.js';
import Story from '../../models/Story.js';
import StoryArchive from '../../models/StoryArchive.js';
import Follow from '../../models/Follow.js';
import {CampusMedia,mediaUrl,canAccessMedia} from '../services/media-store.js';
let app,owner,reader;
before(async()=>{app=await harness('activity_v16',(router,config)=>{registerActivity(router,config);registerCommunityExtras(router,config);registerSocial(router,config);registerMediaSocial(router,config);registerRecommendations(router,config);registerCommunityReports(router,config);});});
after(async()=>app?.close());
beforeEach(async()=>{await clearCollections();owner=await member('activity-owner');reader=await member('activity-reader');});
const call=(path,user=owner,method='GET',body)=>app.call(path,{user,method,body});
test('activity requires authentication, validates tabs, and scopes own content without official data',async()=>{
  const own=await CampusPost.create({user:owner._id,text:'Mine',visibility:'private'});
  await CampusPost.create({user:reader._id,text:'Someone else'});
  await Post.create({user:owner._id,media:'/legacy.png',caption:'My original'});
  await Reel.create({user:owner._id,video:'/reel.mp4',caption:'My reel'});
  assert.equal((await app.call('/community/activity')).status,401);
  assert.equal((await call('/community/activity?tab=invalid')).status,400);
  const result=await call('/community/activity?tab=own');
  assert.equal(result.status,200,JSON.stringify(result.body));assert.equal(result.body.posts.length,2);assert.equal(result.body.reels.length,1);
  assert.ok(result.body.posts.some(item=>item.id===own.id));
  assert.doesNotMatch(JSON.stringify(result.body),/password|email|studentId|Someone else/);
});
test('saved and liked activity checks current audience and omits archived original and campus content',async()=>{
  const campus=await CampusPost.create({user:reader._id,text:'Saved campus',savedBy:[owner._id],likes:[owner._id]});
  const legacy=await Post.create({user:reader._id,media:'/legacy.png',caption:'Saved original',likes:[owner._id]});
  const reel=await Reel.create({user:reader._id,video:'/reel.mp4',caption:'Saved reel',likes:[owner._id]});
  owner.savedPosts=[legacy._id];owner.savedReels=[reel._id];await owner.save();
  for(const tab of ['saved','liked']){const result=await call(`/community/activity?tab=${tab}`);assert.equal(result.body.posts.length,2);assert.equal(result.body.reels.length,1);}
  reader.isPrivate=true;await reader.save();
  for(const tab of ['saved','liked']){const result=await call(`/community/activity?tab=${tab}`);assert.equal(result.body.posts.length,0);assert.equal(result.body.reels.length,0);}
  await Follow.create({from:owner._id,to:reader._id,status:'accepted'});
  assert.equal((await call('/community/activity?tab=liked')).body.posts.length,2);
  await CampusPost.updateOne({_id:campus._id},{$set:{isArchived:true}});await Post.updateOne({_id:legacy._id},{$set:{isArchived:true}});await Reel.updateOne({_id:reel._id},{$set:{isArchived:true}});
  for(const tab of ['saved','liked']){const result=await call(`/community/activity?tab=${tab}`);assert.equal(result.body.posts.length,0);assert.equal(result.body.reels.length,0);}
});
test('archive and restore are persisted and idempotent for campus posts, original posts, and reels',async()=>{
  const campus=await CampusPost.create({user:owner._id,text:'Archive campus'}),legacy=await Post.create({user:owner._id,media:'/original.png',caption:'Archive original'}),reel=await Reel.create({user:owner._id,video:'/video.mp4',caption:'Archive reel'});
  for(const [kind,item,Model] of [['post',campus,CampusPost],['post',legacy,Post],['reel',reel,Reel]]){
    const path=`/community/activity/${kind}/${item.id}`;
    assert.equal((await call(path,reader,'PATCH',{archived:true})).status,404);
    for(let repeat=0;repeat<2;repeat++)assert.equal((await call(path,owner,'PATCH',{archived:true})).status,200);
    assert.equal((await Model.findById(item.id)).isArchived,true);
    assert.equal((await call(kind==='post'?`/feed/${item.id}`:`/reels/${item.id}/comments`,reader)).status,404);
    const archived=await call('/community/activity?tab=archive');assert.ok(archived.body[kind==='post'?'posts':'reels'].some(row=>row.id===item.id&&row.isArchived));
    assert.equal((await call(path,owner,'PATCH',{archived:false})).status,200);
    assert.equal((await Model.findById(item.id)).isArchived,false);
    assert.equal((await call(kind==='post'?`/feed/${item.id}`:`/reels/${item.id}/comments`,reader)).status,200);
  }
});
test('archived campus posts disappear from feed, search, profile, bookmarks, comments and attached media access',async()=>{
  const media=await CampusMedia.create({owner:owner._id,key:'archive-image',kind:'image',mime:'image/png',size:50});
  const post=await CampusPost.create({user:owner._id,text:'Archive robot',image:mediaUrl(media._id),savedBy:[reader._id],comments:[{user:reader._id,text:'Hello'}]});
  assert.equal(await canAccessMedia(reader,media),true);
  await call(`/community/activity/post/${post.id}`,owner,'PATCH',{archived:true});
  assert.equal((await call('/feed',reader)).body.length,0);assert.equal((await call('/search?q=robot',reader)).body.posts.length,0);
  assert.equal((await call('/members/activity-owner',reader)).body.posts.length,0);assert.equal((await call('/community/saved',reader)).body.posts.length,0);
  for(const action of ['like','save'])assert.equal((await call(`/feed/${post.id}/${action}`,reader,'PUT',{[action==='like'?'liked':'saved']:true})).status,404);
  assert.equal((await call(`/feed/${post.id}/comments`,reader)).status,404);
  assert.equal((await call('/recommendations',reader)).body.items.length,0);
  assert.equal((await call('/community/reports',reader,'POST',{targetType:'post',targetId:post.id,reason:'spam'})).status,404);
  assert.equal(await canAccessMedia(reader,media),false);assert.equal(await canAccessMedia(owner,media),true);
});
test('archive includes only the signed-in owner story history, including newly expired stories',async()=>{
  await Story.create({user:owner._id,type:'text',text:'Expired own',expiresAt:new Date(Date.now()-1000)});
  await StoryArchive.create({user:reader._id,type:'text',text:'Foreign archive',originalCreatedAt:new Date(),expiredAt:new Date()});
  const archived=await call('/community/activity?tab=archive');assert.equal(archived.status,200);assert.equal(archived.body.stories.length,1);assert.equal(archived.body.stories[0].text,'Expired own');
  assert.equal((await Story.find({user:owner._id})).length,0);
  const other=await call('/community/activity?tab=archive',reader);assert.equal(other.body.stories.length,1);assert.equal(other.body.stories[0].text,'Foreign archive');
});
test('archive rejects malformed ids, kinds, booleans and unrelated fields',async()=>{
  const post=await CampusPost.create({user:owner._id,text:'Mine'});
  for(const [path,body] of [[`/community/activity/post/${post.id}`,{archived:'true'}],[`/community/activity/post/${post.id}`,{archived:true,user:reader.id}],['/community/activity/post/invalid',{archived:true}],[`/community/activity/story/${post.id}`,{archived:true}]])assert.equal((await call(path,owner,'PATCH',body)).status,400);
  assert.equal((await CampusPost.findById(post.id)).isArchived,false);
});
