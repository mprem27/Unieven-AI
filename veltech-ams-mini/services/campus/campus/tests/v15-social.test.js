import test,{before,after,beforeEach} from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import {harness,member,clearCollections} from './support/social-harness.js';
import {registerSocial} from '../routes/social.js';
import {registerCommunityExtras} from '../routes/community-extra.js';
import {registerMediaSocial} from '../routes/media-social.js';
import {registerRecommendations} from '../routes/recommendations.js';
import {registerCommunityReports} from '../routes/community-reports.js';
import {CampusPost} from '../models.js';
import Post from '../../models/Post.js';
import Reel from '../../models/Reel.js';
import Comment from '../../models/Comment.js';
import Follow from '../../models/Follow.js';
let app,owner,author,other,admin;
before(async()=>{app=await harness('v15_social',(router,config)=>{registerSocial(router,config);registerCommunityExtras(router,config);registerMediaSocial(router,config);registerRecommendations(router,config);registerCommunityReports(router,config);});await Follow.init();});
after(async()=>app.close());
beforeEach(async()=>{await clearCollections();owner=await member('commenter');author=await member('creator',{department:'OFFICIAL-SECRET',socialDepartment:'Public makers'});other=await member('other');admin=await member('admin',{role:'admin',campusRole:'admin'});});
const call=(path,user=owner,method='GET',body)=>app.call(path,{user,method,body});
async function target(kind,createdAt=new Date()){
  if(kind==='campus'){
    const post=await CampusPost.create({user:author._id,text:'Campus post',comments:[{user:owner._id,text:'Original comment',createdAt}]});
    return {item:post,id:String(post.comments[0]._id),path:`/feed/${post.id}/comments`,kind};
  }
  const item=kind==='post'?await Post.create({user:author._id,caption:'Legacy post',media:'/poster.png'}):await Reel.create({user:author._id,caption:'Reel',video:'/video.mp4'});
  const comment=await Comment.create({user:owner._id,text:'Original comment',targetType:kind,targetId:item._id,[kind]:item._id,createdAt});
  item.comments=[comment._id];await item.save();
  return {item,id:comment.id,path:kind==='post'?`/feed/${item.id}/comments`:`/reels/${item.id}/comments`,kind};
}
async function comments(row,user=owner){
  const result=await call(row.kind==='reel'?'/reels':'/feed',user);
  return result.body.find(item=>item.id===row.item.id).comments;
}
async function stored(row){return row.kind==='campus'?(await CampusPost.findById(row.item.id)).comments.id(row.id):Comment.findById(row.id);}
test('new comments return an immediately usable owned comment for each supported content type',async()=>{
 for(const kind of ['campus','post','reel']){
  const row=await target(kind),created=await call(row.path,owner,'POST',{text:'Immediate comment'});
  assert.equal(created.status,201);assert.ok(created.body.comment,'A full comment DTO is required');
  assert.equal(created.body.comment.text,'Immediate comment');assert.equal(created.body.comment.author.id,owner.id);assert.equal(created.body.comment.canEdit,true);
 }
});
test('shared post lookup reads an owned accessible item without relying on the current feed window',async()=>{
 const row=await target('campus'),read=await call('/feed/'+row.item.id);assert.equal(read.status,200);assert.equal(read.body.id,row.item.id);
 await CampusPost.updateOne({_id:row.item.id},{$set:{visibility:'private'}});
 assert.equal((await call('/feed/'+row.item.id,other)).status,404);assert.equal((await call('/feed/'+row.item.id,author)).status,200);
});
for(const kind of ['campus','post','reel']){
  test(`${kind} comment DTO permits owner edits for five minutes and exposes only social authors`,async()=>{
    const row=await target(kind);const own=(await comments(row))[0],foreign=(await comments(row,author))[0];
    assert.equal(own.canEdit,true);assert.equal(own.canDelete,true);assert.equal(own.editedAt,null);assert.equal(new Date(own.editableUntil)-new Date(own.createdAt),300000);
    assert.equal(foreign.canEdit,false);assert.equal(foreign.canDelete,true);
    const direct=await call(row.path);assert.equal(direct.status,200);assert.deepEqual(direct.body,[own]);assert.doesNotMatch(JSON.stringify(own.author),/OFFICIAL-SECRET|"department"|"email"/);
    const edited=await call(`${row.path}/${row.id}`,owner,'PATCH',{text:'  Updated by commenter  '});
    assert.equal(edited.status,200);assert.equal(edited.body.comment.text,'Updated by commenter');assert.ok(edited.body.comment.editedAt);assert.equal(edited.body.comment.canEdit,true);
    assert.equal((await stored(row)).text,'Updated by commenter');assert.ok((await stored(row)).editedAt);
    assert.equal((await comments(row))[0].text,'Updated by commenter');
  });
  test(`${kind} comment edits reject other authors, invalid text and expired server timestamps`,async()=>{
    const row=await target(kind);
    assert.equal((await call(`${row.path}/${row.id}`,author,'PATCH',{text:'Unauthorized'})).status,403);
    assert.equal((await call(`${row.path}/${row.id}`,other,'PATCH',{text:'Unauthorized'})).status,403);
    for(const text of ['', '  ', 'x'.repeat(kind==='campus'?501:301),{}])assert.equal((await call(`${row.path}/${row.id}`,owner,'PATCH',{text})).status,400);
    const expired=await target(kind,new Date(Date.now()-300001));
    assert.equal((await comments(expired))[0].canEdit,false);
    assert.equal((await call(`${expired.path}/${expired.id}`,owner,'PATCH',{text:'Late edit',createdAt:new Date(),editableUntil:'2099-01-01'})).status,409);
    assert.equal((await stored(expired)).text,'Original comment');
    assert.equal((await call(`${expired.path}/${expired.id}`,owner,'DELETE')).status,200);
    assert.equal((await comments(expired)).length,0);
  });
  test(`${kind} canonical comment likes are idempotent and IDs stay scoped to readable content`,async()=>{
    const row=await target(kind),second=await target(kind);
    assert.equal((await call(`${row.path}/${second.id}`,owner,'PATCH',{text:'Wrong context'})).status,404);
    assert.equal((await call(`${row.path}/${row.id}/like`,other,'PUT',{liked:true})).status,200);
    assert.equal((await call(`${row.path}/${row.id}/like`,other,'PUT',{liked:true})).status,200);
    assert.equal((await stored(row)).likes.length,1);
    assert.equal((await comments(row,other))[0].liked,true);
    await Follow.create({from:owner._id,to:author._id,status:'requested'});author.isPrivate=true;await author.save();
    assert.equal((await call(`${row.path}/${row.id}`,owner,'PATCH',{text:'Private'})).status,403);
    assert.equal((await call(`${row.path}/${row.id}/like`,owner,'PUT',{liked:true})).status,403);
    assert.equal((await call(`${row.path}/${row.id}`,owner,'DELETE')).status,403);
  });
}
test('reports persist privately without copying content or official identity into responses',async()=>{
  const post=await CampusPost.create({user:author._id,text:'Reported content'}),reel=await Reel.create({user:author._id,video:'/reported.mp4'});
  for(const [targetType,targetId] of [['post',post.id],['reel',reel.id],['user',author.id]]){
    const result=await call('/community/reports',owner,'POST',{targetType,targetId,reason:'privacy',details:'Private report details'});
    assert.equal(result.status,201);assert.equal(result.body.status,'pending');assert.ok(result.body.id);
    assert.deepEqual(Object.keys(result.body).sort(),['id','status']);
    const stored=await mongoose.connection.collection('campuscommunityreports').findOne({_id:new mongoose.Types.ObjectId(result.body.id)});
    assert.equal(String(stored.reporter),owner.id);assert.equal(String(stored.targetId),targetId);assert.equal(stored.details,'Private report details');
  }
  assert.equal((await call('/community/reports/admin')).status,403);
  assert.equal((await call('/community/reports/admin',author)).status,403);
  const review=await call('/community/reports/admin',admin);assert.equal(review.status,200);assert.equal(review.body.length,3);
  assert.doesNotMatch(JSON.stringify(review.body),/OFFICIAL-SECRET|Reported content|reported.mp4|"email"|"department"/);
  const id=review.body[0].id;
  assert.equal((await call(`/community/reports/admin/${id}`,owner,'PATCH',{status:'reviewed',reviewNote:'Spoofed'})).status,403);
  assert.equal((await call(`/community/reports/admin/${id}`,admin,'PATCH',{status:'reviewed',reviewNote:'Reviewed safely'})).status,200);
  const updated=await mongoose.connection.collection('campuscommunityreports').findOne({_id:new mongoose.Types.ObjectId(id)});assert.equal(updated.status,'reviewed');assert.equal(String(updated.reviewedBy),admin.id);assert.ok(updated.reviewedAt);
});
test('report validation and private targets cannot be bypassed with known IDs or body privileges',async()=>{
  const hidden=await CampusPost.create({user:author._id,text:'SECRET-HIDDEN',visibility:'private'}),archived=await Post.create({user:author._id,media:'/old.png',isArchived:true});
  for(const body of [{targetType:'post',targetId:hidden.id,reason:'spam'},{targetType:'post',targetId:archived.id,reason:'spam'},{targetType:'post',targetId:String(new mongoose.Types.ObjectId()),reason:'spam'},{targetType:'unknown',targetId:author.id,reason:'spam'},{targetType:'user',targetId:'bad',reason:'spam'},{targetType:'user',targetId:author.id,reason:'bad'},{targetType:'user',targetId:author.id,reason:'spam',details:'x'.repeat(1001)}])assert.ok((await call('/community/reports',owner,'POST',body)).status>=400);
  assert.equal(await mongoose.connection.collection('campuscommunityreports').countDocuments(),0);
  assert.equal((await call('/community/reports/admin?role=admin')).status,403);
});
test('refresh keys diversify a genuinely mixed feed while preserving private filtering and bounded input',async()=>{
  for(let index=0;index<6;index++){
    const creator=await member(`creator${index}`);
    await CampusPost.create({_id:new mongoose.Types.ObjectId((100+index).toString(16).padStart(24,'0')),user:creator._id,text:`Public project ${index}`,createdAt:new Date('2026-10-15')});
    await Reel.create({_id:new mongoose.Types.ObjectId((200+index).toString(16).padStart(24,'0')),user:creator._id,video:`/public${index}.mp4`,createdAt:new Date('2026-10-15')});
  }
  await CampusPost.create({user:author._id,text:'SECRET-HIDDEN',visibility:'private',image:'/secret.png'});
  const first=await call('/recommendations?refreshKey=first'),again=await call('/recommendations?refreshKey=first'),fresh=await call('/recommendations?refreshKey=second');
  assert.equal(first.status,200);assert.deepEqual(first.body.items.map(row=>row.item.id),again.body.items.map(row=>row.item.id));
  assert.notDeepEqual(first.body.items.map(row=>row.item.id),fresh.body.items.map(row=>row.item.id));
  assert.deepEqual(new Set(first.body.items.map(row=>row.kind)),new Set(['post','reel']));
  assert.ok(first.body.items.every(row=>row.reasons.length));assert.doesNotMatch(JSON.stringify(fresh.body),/SECRET-HIDDEN|secret.png|OFFICIAL-SECRET|"department"/);
  for(const value of ['x'.repeat(65),'bad.key','%5Bobject%20Object%5D'])assert.equal((await call(`/recommendations?refreshKey=${value}`)).status,400);
  assert.equal((await call('/recommendations?refreshKey[unsafe]=1')).status,400);
});

test('five-minute policy rejects the exact deadline, invalid timestamps and future timestamps',async()=>{
  const {canEditComment,COMMENT_EDIT_WINDOW_MS}=await import('../services/comment-policy.js');
  const now=new Date('2026-10-15T12:00:00Z'),comment={user:owner._id,createdAt:new Date(now.getTime()-COMMENT_EDIT_WINDOW_MS)};
  assert.equal(canEditComment(comment,owner,now),false);
  assert.equal(canEditComment({...comment,createdAt:new Date(comment.createdAt.getTime()+1)},owner,now),true);
  for(const createdAt of [undefined,null,'invalid',new Date(now.getTime()+1)])assert.equal(canEditComment({...comment,createdAt},owner,now),false);
});
test('direct post and reel feeds accept bounded refresh keys without exposing hidden items',async()=>{
  for(let index=0;index<8;index++){
    await CampusPost.create({_id:new mongoose.Types.ObjectId((300+index).toString(16).padStart(24,'0')),user:author._id,text:`Visible post ${index}`});
    await Reel.create({_id:new mongoose.Types.ObjectId((400+index).toString(16).padStart(24,'0')),user:author._id,video:`/visible${index}.mp4`});
  }
  await CampusPost.create({user:author._id,text:'Hidden post',visibility:'private'});await Reel.create({user:author._id,video:'/hidden.mp4',visibility:'private'});
  for(const path of ['/feed','/reels']){
    const first=await call(`${path}?refreshKey=first`),again=await call(`${path}?refreshKey=first`),fresh=await call(`${path}?refreshKey=second`);
    assert.equal(first.status,200);assert.deepEqual(first.body.map(item=>item.id),again.body.map(item=>item.id));assert.notDeepEqual(first.body.map(item=>item.id),fresh.body.map(item=>item.id));
    assert.equal(first.body.length,8);assert.doesNotMatch(JSON.stringify(fresh.body),/Hidden post|hidden.mp4|OFFICIAL-SECRET|"department"/);
    assert.equal((await call(`${path}?refreshKey=${'x'.repeat(65)}`)).status,400);assert.equal((await call(`${path}?refreshKey[bad]=1`)).status,400);
  }
});
