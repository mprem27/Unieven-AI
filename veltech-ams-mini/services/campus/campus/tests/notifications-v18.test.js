import test,{before,after,beforeEach} from 'node:test';
import assert from 'node:assert/strict';
import {harness,member,clearCollections} from './support/social-harness.js';
import {registerNotifications,initializeNotificationModels} from '../routes/notifications.js';
import {registerSocial} from '../routes/social.js';
import {registerCommunityExtras} from '../routes/community-extra.js';
import {registerMediaSocial} from '../routes/media-social.js';
import {createNotification,notifyMentions,syncRelevantNotifications} from '../services/notifications.js';
import Follow from '../../models/Follow.js';
import Reel from '../../models/Reel.js';
import Comment from '../../models/Comment.js';
import Notification from '../../models/Notification.js';
import User from '../../models/User.js';
import Event from '../../models/Event.js';
import Registration from '../../models/EventRegistration.js';
import {CampusPost,Notice} from '../models.js';
let app,owner,actor,other;
before(async()=>{app=await harness('notifications_v18',(router,config)=>{registerNotifications(router,config);registerSocial(router,config);registerCommunityExtras(router,config);registerMediaSocial(router,config);});await initializeNotificationModels();});
after(async()=>app.close());
beforeEach(async()=>{await clearCollections();owner=await member('owner',{department:'CSE'});actor=await member('actor');other=await member('other',{department:'ECE'});});
const call=(path,user=owner,method='GET',body)=>app.call(path,{user,method,body});
test('inbox and read/dismiss actions remain bound to the signed-in owner',async()=>{
 const own=await createNotification({toUser:owner,fromUser:actor,type:'follow',eventKey:'own'});
 const foreign=await createNotification({toUser:other,fromUser:actor,type:'follow',eventKey:'foreign'});
 assert.equal((await call('/notifications/inbox',null)).status,401);
 const inbox=await call('/notifications/inbox');assert.equal(inbox.status,200);assert.equal(inbox.body.length,1);assert.equal(inbox.body[0].link,'/members/actor');
 for(const [suffix,method]of [['/read','PATCH'],['','DELETE']])assert.equal((await call(`/notifications/${foreign.id}${suffix}`,owner,method,{})).status,404);
 assert.equal((await call(`/notifications/${own.id}/read`,owner,'PATCH',{})).body.read,true);
 await call('/notifications/read-all',owner,'PATCH',{});assert.equal((await Notification.findById(foreign.id)).isRead,false);
 await call(`/notifications/${own.id}`,owner,'DELETE');await createNotification({toUser:owner,fromUser:actor,type:'follow',eventKey:'own'});
 assert.equal((await call('/notifications/inbox')).body.length,0);assert.equal(await Notification.countDocuments({toUser:owner.id}),1);
});
test('parallel retries deduplicate without resetting read state and no self notification is emitted',async()=>{
 const payload={toUser:owner,fromUser:actor,type:'follow',eventKey:'one'};
 await Promise.all(Array.from({length:8},()=>createNotification(payload)));assert.equal(await Notification.countDocuments(),1);
 await Notification.updateOne({toUser:owner.id},{$set:{isRead:true}});await createNotification(payload);assert.equal((await Notification.findOne()).isRead,true);
 assert.equal(await createNotification({...payload,toUser:actor}),null);
});
test('post likes, comments, replies and visible mentions notify only relevant recipients',async()=>{
 const post=await CampusPost.create({user:owner.id,text:'A project',comments:[{user:other.id,text:'Question',createdAt:new Date()}]});
 await call(`/feed/${post.id}/like`,actor,'PUT',{liked:true});await call(`/feed/${post.id}/like`,actor,'PUT',{liked:true});
 assert.equal(await Notification.countDocuments({type:'like'}),1);
 const reply=await call(`/feed/${post.id}/comments`,actor,'POST',{text:'A reply @owner',parentComment:String(post.comments[0]._id)});assert.equal(reply.status,201);
 assert.equal(await Notification.countDocuments({toUser:other.id,type:'reply'}),1);assert.equal(await Notification.countDocuments({toUser:owner.id,type:'comment'}),1);
 const inbox=(await call('/notifications/inbox')).body;assert.ok(inbox.some(item=>item.link.includes(`/community/posts/${post.id}?comment=`)));
 const privateContent={user:actor,visibility:'private',mentions:['owner']};await notifyMentions({actor,content:privateContent,post:post.id,eventKey:'private'});
 assert.equal(await Notification.countDocuments({eventKey:'private:'+owner.id}),0);
 await User.updateOne({_id:owner.id},{$set:{isPrivate:true}});
 assert.equal((await call('/notifications/inbox',other)).body.length,0,'reply source no longer visible after profile privacy changes');
});
test('authorized notices and real event registrations persist once and dismissals survive refresh',async()=>{
 await Notice.create({title:'CSE notice',department:'CSE',createdBy:actor.id});await Notice.create({title:'ECE private notice',department:'ECE',createdBy:actor.id});
 const event=await Event.create({createdBy:actor.id,title:'Registered workshop',date:new Date(Date.now()+2*86400000),time:'10:00',image:'/poster.png',location:'Hall'});
 await Registration.create({user:owner.id,event:event.id,studentId:'test',email:'owner@example.test',phone:'0000000000',department:'CSE'});
 const first=(await call('/notifications/inbox')).body;assert.ok(first.some(item=>item.type==='event_registration'));assert.ok(first.some(item=>item.title==='CSE notice'));assert.ok(!first.some(item=>item.title.includes('ECE')));
 assert.equal((await call('/notifications/inbox',other)).body.some(item=>item.type==='event_registration'),false);
 await call('/notifications/read-all',owner,'PATCH',{});await call('/notifications/inbox');assert.equal(await Notification.countDocuments({toUser:owner.id,isRead:false}),0);
 await Event.updateOne({_id:event.id},{$set:{location:'New hall'}});const next=(await call('/notifications/inbox')).body;assert.equal(next.filter(item=>item.type==='event_update').length,1);
 const notice=first.find(item=>item.type==='campus_notice');await call(`/notifications/${notice.id}`,owner,'DELETE');assert.equal((await call('/notifications/inbox')).body.some(item=>item.id===notice.id),false);
});
test('stored private social bodies are excluded and feedback replies use the safe destination',async()=>{
 await Notification.create({toUser:owner.id,fromUser:actor.id,type:'follow',message:'PRIVATE-SOURCE-TEXT'});
 await createNotification({toUser:owner,fromUser:actor,type:'app_feedback_reply',eventKey:'feedback:1',message:'An administrator replied to your app feedback',link:'/settings/feedback',category:'system'});
 const inbox=(await call('/notifications/inbox')).body;assert.doesNotMatch(JSON.stringify(inbox),/PRIVATE-SOURCE-TEXT|@example.test/);assert.equal(inbox.find(item=>item.type==='app_feedback_reply').link,'/settings/feedback');
});

test('connection notifications are idempotent and acceptance informs only the requester',async()=>{
 await User.updateOne({_id:owner.id},{$set:{isPrivate:true}});
 const request=await call(`/connections/${owner.id}`,actor,'POST',{});assert.equal(request.status,200);
 await call(`/connections/${owner.id}`,actor,'POST',{});
 let inbox=(await call('/notifications/inbox')).body;assert.equal(inbox.filter(row=>row.type==='follow_request').length,1);
 const row=inbox.find(row=>row.type==='follow_request');assert.equal(row.requestId,request.body.id);
 await call(`/notifications/${row.id}`,owner,'DELETE');await call(`/connections/${owner.id}`,actor,'POST',{});
 assert.equal((await call('/notifications/inbox')).body.length,0,'a repeated request must not restore a dismissed notification');
 assert.equal((await call(`/connections/${request.body.id}/accept`,owner,'POST',{})).status,200);
 const requester=(await call('/notifications/inbox',actor)).body;assert.equal(requester.filter(row=>row.type==='follow_accepted').length,1);
 await call(`/connections/${request.body.id}/accept`,owner,'POST',{});assert.equal(await Notification.countDocuments({toUser:actor.id,type:'follow_accepted'}),1);
 assert.equal((await call('/notifications/inbox',other)).body.length,0);
});
test('legacy follow hook emits an owner-only notification once',async()=>{
 await call(`/people/${owner.id}/follow`,actor,'PUT',{following:true});await call(`/people/${owner.id}/follow`,actor,'PUT',{following:true});
 assert.equal(await Notification.countDocuments({toUser:owner.id,type:'follow'}),1);
});
test('blocks suppress new social notifications and hide existing activity in either direction',async()=>{
 const post=await CampusPost.create({user:owner.id,text:'Visible project'});
 await call(`/feed/${post.id}/like`,actor,'PUT',{liked:true});assert.equal((await call('/notifications/inbox')).body.length,1);
 await User.collection.updateOne({_id:owner._id},{$set:{blockedUsers:[actor._id]}});
 assert.equal((await call('/notifications/inbox')).body.length,0);
 await call(`/feed/${post.id}/comments`,actor,'POST',{text:'Blocked comment'});assert.equal(await Notification.countDocuments({type:'comment'}),0);
 await User.collection.updateOne({_id:owner._id},{$unset:{blockedUsers:''}});await User.collection.updateOne({_id:actor._id},{$set:{blockedUsers:[owner._id]}});
 assert.equal((await call('/notifications/inbox')).body.length,0);
 await notifyMentions({actor,content:{user:actor,visibility:'account',mentions:['owner']},post:post.id,eventKey:'blocked-mention'});assert.equal(await Notification.countDocuments({type:'mention'}),0);
});
test('deleted comments and removed registrations no longer disclose notification targets',async()=>{
 const post=await CampusPost.create({user:owner.id,text:'A post'});const response=await call(`/feed/${post.id}/comments`,actor,'POST',{text:'Comment'});
 assert.equal(response.status,201);assert.equal((await call('/notifications/inbox')).body.length,1);
 await CampusPost.updateOne({_id:post.id},{$set:{comments:[]}});assert.equal((await call('/notifications/inbox')).body.length,0);
 const event=await Event.create({createdBy:actor.id,title:'Owned event',date:new Date(Date.now()+86400000),time:'10:00',image:'/poster.png',location:'Hall'});
 const ticket=await Registration.create({user:owner.id,event:event.id,studentId:'test',email:'owner@example.test',phone:'0000000000',department:'CSE'});
 assert.ok((await call('/notifications/inbox')).body.some(row=>row.type==='event_registration'));
 await Registration.deleteOne({_id:ticket.id});assert.equal((await call('/notifications/inbox')).body.some(row=>row.eventId===event.id),false);
});
test('comment likes and reel replies have safe content destinations',async()=>{
 const post=await CampusPost.create({user:owner.id,text:'Project',comments:[{user:other.id,text:'Question',createdAt:new Date()}]});
 await call(`/feed/${post.id}/comments/${post.comments[0].id}/like`,actor,'PUT',{liked:true});
 assert.equal(await Notification.countDocuments({toUser:other.id,type:'like',comment:post.comments[0]._id}),1);
 const reel=await Reel.create({user:owner.id,video:'/test.mp4'});const comment=await Comment.create({user:other.id,reel:reel.id,targetId:reel.id,targetType:'reel',text:'Question'});await Reel.updateOne({_id:reel.id},{$push:{comments:comment.id}});
 const reply=await call(`/reels/${reel.id}/comments`,actor,'POST',{text:'Reply @owner',parentComment:comment.id});assert.equal(reply.status,201);
 const inbox=(await call('/notifications/inbox',other)).body;assert.ok(inbox.some(row=>row.type==='reply'&&row.link.startsWith(`/reels/${reel.id}/comments?comment=`)));
});
test('event reminders use real start times and remain limited to active registrations',async()=>{
 const startsAt=new Date(Date.now()+4*3600000);const day=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Kolkata',year:'numeric',month:'2-digit',day:'2-digit'}).format(startsAt);const time=new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Kolkata',hour:'2-digit',minute:'2-digit',hour12:false}).format(startsAt);
 const event=await Event.create({createdBy:actor.id,title:'Soon',date:day,time,startsAt,image:'/poster.png',location:'Hall'});
 const ticket=await Registration.create({user:owner.id,event:event.id,studentId:'test',email:'owner@example.test',phone:'0000000000',department:'CSE'});
 await syncRelevantNotifications(owner);let inbox=(await call('/notifications/inbox')).body;assert.equal(inbox.filter(row=>row.type==='event_reminder').length,1);
 await Registration.updateOne({_id:ticket.id},{$set:{status:'cancelled'}});inbox=(await call('/notifications/inbox')).body;assert.equal(inbox.some(row=>row.type==='event_reminder'),false);
 assert.equal((await call('/notifications/inbox',other)).body.some(row=>row.eventId===event.id),false);
});

test('plain-text mentions and comment mentions link to their current source only',async()=>{
 const created=await call('/feed',actor,'POST',{text:'Hello @owner'});assert.equal(created.status,201);
 const mentioned=(await call('/notifications/inbox')).body;assert.equal(mentioned.filter(row=>row.type==='mention').length,1);
 const post=await CampusPost.create({user:actor.id,text:'Conversation'});
 const comment=await call(`/feed/${post.id}/comments`,other,'POST',{text:'Please read @owner'});assert.equal(comment.status,201);
 let inbox=(await call('/notifications/inbox')).body;const row=inbox.find(item=>item.postId===post.id&&item.type==='mention');assert.ok(row?.commentId);assert.ok(row.link.includes('?comment='));
 await CampusPost.updateOne({_id:post.id},{$set:{comments:[]}});inbox=(await call('/notifications/inbox')).body;assert.equal(inbox.some(item=>item.id===row.id),false);
});
test('legacy social read and delete endpoints retain owner-scoped behavior',async()=>{
 const row=await createNotification({toUser:owner,fromUser:actor,type:'follow',eventKey:'legacy'});
 assert.equal((await call(`/social/notifications/${row.id}/read`,owner,'PATCH',{})).status,200);
 assert.equal((await call('/social/notifications')).body[0].read,true);
 assert.equal((await call(`/social/notifications/${row.id}`,owner,'DELETE')).status,200);
 assert.equal((await call('/social/notifications')).body.length,0);
});

test('postponed events hide superseded reminders until the new start is due',async()=>{
 const startsAt=new Date(Date.now()+3*3600000);const event=await Event.create({createdBy:actor.id,title:'Postponed',date:startsAt,time:'10:00',startsAt,image:'/poster.png',location:'Hall'});
 await Registration.create({user:owner.id,event:event.id,studentId:'test',email:'owner@example.test',phone:'0000000000',department:'CSE'});
 assert.equal((await call('/notifications/inbox')).body.filter(row=>row.type==='event_reminder').length,1);
 await Event.updateOne({_id:event.id},{$set:{startsAt:new Date(Date.now()+3*86400000)}});assert.equal((await call('/notifications/inbox')).body.filter(row=>row.type==='event_reminder').length,0);
 await Event.updateOne({_id:event.id},{$set:{startsAt:new Date(Date.now()+8*3600000)}});assert.equal((await call('/notifications/inbox')).body.filter(row=>row.type==='event_reminder').length,1);
});
