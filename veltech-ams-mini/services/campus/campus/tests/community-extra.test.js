import test,{before,after,beforeEach} from 'node:test';
import assert from 'node:assert/strict';
import {registerCommunityExtras} from '../routes/community-extra.js';
import {registerNotifications} from '../routes/notifications.js';
import {harness,member,clearCollections} from './support/social-harness.js';
import User from '../../models/User.js';
import Follow from '../../models/Follow.js';
import Post from '../../models/Post.js';
import Reel from '../../models/Reel.js';
import Comment from '../../models/Comment.js';
import Notification from '../../models/Notification.js';
import {CampusPost} from '../models.js';
import {CampusMedia,mediaUrl} from '../services/media-store.js';
let app,user,target,third;
before(async()=>{app=await harness('community',(router,config)=>{registerNotifications(router,config);registerCommunityExtras(router,config);});await Follow.init();});
after(async()=>app.close());
beforeEach(async()=>{await clearCollections();user=await member('reader');target=await member('creator',{name:'Creator',email:'secret@example.test',dob:new Date('2005-01-01'),phone:'PRIVATE-PHONE',studentId:'PRIVATE-STUDENT',department:'CSE'});third=await member('third');});
const call=(path,actor=user,method='GET',body)=>app.call(path,{user:actor,method,body});
test('public members and profiles never expose contact, DOB or academic records',async()=>{
  await CampusPost.create({user:target._id,text:'Public project'});
  const list=await call('/members?q=creator'),profile=await call('/members/creator');assert.equal(list.status,200);assert.equal(profile.status,200);assert.equal(profile.body.posts.length,1);
  for(const payload of [list.body,profile.body])assert.doesNotMatch(JSON.stringify(payload),/secret@example|PRIVATE-PHONE|PRIVATE-STUDENT|2005-01|"department"|"password"/);
  assert.equal((await call('/members/me',target)).body.dob,undefined);
});
test('own social profile edits preserve privilege fields and accept owned images only',async()=>{
  const image=await CampusMedia.create({owner:user._id,key:'image1',mime:'image/png',kind:'image',size:50});
  const updated=await call('/members/me',user,'PATCH',{name:'Reader New',bio:'Building campus projects',username:'reader.new',image:mediaUrl(image._id),isPrivate:true});
  assert.equal(updated.status,200);assert.equal(updated.body.user.username,'reader.new');assert.equal(updated.body.user.isPrivate,true);
  const stored=await User.findById(user.id);assert.equal(stored.role,'student');assert.equal(stored.campusRole,'student');assert.equal(stored.studentId,'');
  const foreign=await CampusMedia.create({owner:target._id,key:'image2',mime:'image/png',kind:'image',size:50});assert.equal((await call('/members/me',user,'PATCH',{image:mediaUrl(foreign._id)})).status,403);
  for(const fields of [{dob:'2050-01-01'},{dob:'2005-02-31'},{gender:'Female'},{username:'x'},{isPrivate:'false'},{bio:'x'.repeat(301)}])assert.equal((await call('/members/me',user,'PATCH',fields)).status,400);
});
test('public following is persisted idempotently in the original Follow and User records',async()=>{
  const first=await call(`/connections/${target.id}`,user,'POST',{}),again=await call(`/connections/${target.id}`,user,'POST',{});
  assert.equal(first.status,200);assert.equal(first.body.status,'accepted');assert.equal(again.body.id,first.body.id);assert.equal(await Follow.countDocuments(),1);
  assert.deepEqual((await User.findById(user.id)).following.map(String),[target.id]);assert.deepEqual((await User.findById(target.id)).followers.map(String),[user.id]);
  assert.equal((await call('/connections')).body.following[0].username,'creator');
  assert.equal((await call(`/connections/${target.id}`,user,'DELETE')).status,200);assert.equal(await Follow.countDocuments(),0);assert.equal((await User.findById(target.id)).followers.length,0);
});
test('private requests grant no content access until the recipient accepts',async()=>{
  target.isPrivate=true;await target.save();await CampusPost.create({user:target._id,text:'Private post'});await Reel.create({user:target._id,video:'/private.mp4',caption:'Private video'});
  const request=await call(`/connections/${target.id}`,user,'POST',{});assert.equal(request.body.status,'requested');assert.equal((await call('/members/creator')).body.canViewContent,false);assert.equal((await call('/members/creator')).body.posts.length,0);
  assert.equal((await call(`/connections/${request.body.id}/accept`,third,'POST',{})).status,403);
  const inbox=await call('/connections',target);assert.equal(inbox.body.incoming[0].from.username,'reader');
  assert.equal((await call(`/connections/${request.body.id}/accept`,target,'POST',{})).status,200);const profile=await call('/members/creator');assert.equal(profile.body.canViewContent,true);assert.equal(profile.body.posts.length,1);assert.equal(profile.body.reels.length,1);
  assert.equal((await call(`/members/${target.id}/followers`)).body[0].username,'reader');
});
test('private requests can be rejected or cancelled without leaving access arrays behind',async()=>{
  target.isPrivate=true;await target.save();let request=await call(`/connections/${target.id}`,user,'POST',{});
  assert.equal((await call(`/connections/${request.body.id}/reject`,target,'POST',{})).status,200);assert.equal(await Follow.countDocuments(),0);assert.equal((await User.findById(target.id)).followRequests.length,0);
  request=await call(`/connections/${target.id}`,user,'POST',{});assert.equal((await call(`/connections/${target.id}`,user,'DELETE')).status,200);assert.equal((await User.findById(user.id)).following.length,0);assert.equal(await Notification.countDocuments(),0);
});
test('private connection lists remain hidden and public directory search treats regex literally',async()=>{
  target.isPrivate=true;await target.save();await Follow.create({from:third._id,to:target._id,status:'accepted'});
  assert.equal((await call(`/members/${target.id}/followers`)).status,403);assert.deepEqual((await call('/members?q=.*')).body,[]);assert.equal((await call('/search?q='+encodeURIComponent('x'.repeat(65)))).status,400);
  assert.equal((await call('/connections')).body.incoming.length,0);
});
test('search covers original posts and reels while filtering private and archived content',async()=>{
  await CampusPost.create({user:target._id,text:'Robotics project'});await Post.create({user:target._id,media:'/poster.jpg',caption:'Robotics legacy'});await Reel.create({user:target._id,video:'/robotics.mp4',caption:'Robotics reel'});
  const privateUser=await member('private',{isPrivate:true});await CampusPost.create({user:privateUser._id,text:'Robotics secret'});await Post.create({user:target._id,media:'/archived.jpg',caption:'Robotics archived',isArchived:true});
  const result=await call('/search?q=robotics');assert.equal(result.body.posts.length,2);assert.equal(result.body.reels.length,1);assert.doesNotMatch(JSON.stringify(result.body),/Robotics secret|archived.jpg/);
});
test('social notifications are owner-scoped and never serialize stored private message bodies',async()=>{
  const own=await Notification.create({toUser:user._id,fromUser:target._id,type:'follow',message:'PRIVATE-SOURCE-TEXT'}),foreign=await Notification.create({toUser:third._id,fromUser:target._id,type:'follow'});
  const result=await call('/social/notifications');assert.equal(result.body.length,1);assert.equal(result.body[0].id,own.id);assert.doesNotMatch(JSON.stringify(result.body),/PRIVATE-SOURCE-TEXT|secret@example/);
  assert.equal((await call(`/social/notifications/${foreign.id}/read`,user,'PATCH',{})).status,404);assert.equal((await call(`/social/notifications/${foreign.id}`,user,'DELETE')).status,404);
  assert.equal((await call('/social/notifications/read-all',user,'PATCH',{})).status,200);assert.equal((await Notification.findById(own.id)).isRead,true);assert.equal((await Notification.findById(foreign.id)).isRead,false);
});
test('original and embedded comment likes and deletes persist with post privacy checks',async()=>{
  const original=await Post.create({user:target._id,media:'/image.png',caption:'Original'}),legacyComment=await Comment.create({user:user._id,targetId:original._id,targetType:'post',post:original._id,text:'Hello'});original.comments=[legacyComment._id];await original.save();
  const campus=await CampusPost.create({user:target._id,text:'New post',comments:[{user:user._id,text:'New hello',createdAt:new Date()}]});
  for(const [post,id,legacy] of [[original,legacyComment.id,true],[campus,String(campus.comments[0]._id),false]]){
    assert.equal((await call(`/feed/${post.id}/comments/${id}/like`,third,'PUT',{liked:true})).status,200);assert.equal((await call(`/feed/${post.id}/comments/${id}/like`,third,'PUT',{liked:true})).status,200);
    assert.equal(legacy?(await Comment.findById(id)).likes.length:(await CampusPost.findById(post.id)).comments.id(id).likes.length,1);
    assert.equal((await call(`/feed/${post.id}/comments/${id}`,third,'DELETE')).status,403);assert.equal((await call(`/feed/${post.id}/comments/${id}`,target,'DELETE')).status,200);
  }
});

test('saved posts and reels preserve bookmarks without exposing content that became private',async()=>{
  const post=await CampusPost.create({user:target._id,text:'Bookmarked',savedBy:[user._id]}),legacy=await Post.create({user:target._id,caption:'Saved original',media:'/old.png'}),reel=await Reel.create({user:target._id,caption:'Saved reel',video:'/old.mp4'});
  user.savedPosts=[legacy._id];user.savedReels=[reel._id];await user.save();
  let result=await call('/community/saved');assert.equal(result.body.posts.length,2);assert.equal(result.body.reels.length,1);
  target.isPrivate=true;await target.save();result=await call('/community/saved');assert.equal(result.body.posts.length,0);assert.equal(result.body.reels.length,0);
  assert.equal((await User.findById(user._id)).savedPosts.length,1);
});
test('username availability excludes the current account and validates literal input',async()=>{
  assert.equal((await call('/members/check-username?username=reader')).body.available,true);assert.equal((await call('/members/check-username?username=creator')).body.available,false);assert.equal((await call('/members/check-username?username=brandnew')).body.available,true);assert.equal((await call('/members/check-username?username=.*')).status,400);
});

test('search discovers hashtags and overlays without interpreting search syntax',async()=>{
  await CampusPost.create({user:target._id,text:'A new project',hashtags:['robotics']});await Reel.create({user:target._id,caption:'Watch this',video:'/video.mp4',hashtags:['robotics']});
  const result=await call('/search?q=robotics');assert.equal(result.body.posts.length,1);assert.equal(result.body.reels.length,1);
  const literal=await call('/search?q=.*');assert.equal(literal.body.posts.length,0);assert.equal(literal.body.reels.length,0);
});
