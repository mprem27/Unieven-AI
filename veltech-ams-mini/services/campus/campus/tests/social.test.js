import test,{before,after,beforeEach} from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import {createCampusApp} from '../server.js';
import {CampusPost,Session} from '../models.js';
import {hashToken,newToken} from '../security.js';
import User from '../../models/User.js';
import Post from '../../models/Post.js';
import Comment from '../../models/Comment.js';
import Follow from '../../models/Follow.js';

let server,base,student,author,headers;
const origin='http://localhost:5180';
before(async()=>{
  await mongoose.connect(`mongodb://127.0.0.1:27017/campus_test_social_${process.pid}`);
  await Promise.all([User.init(),Session.init(),Follow.init()]);
  server=createCampusApp({origins:[origin]}).listen(0);
  await new Promise(resolve=>server.once('listening',resolve));
  base=`http://127.0.0.1:${server.address().port}/api/campus`;
});
after(async()=>{
  await new Promise(resolve=>server.close(resolve));
  await mongoose.connection.dropDatabase();
  await mongoose.disconnect();
});
async function sessionFor(user) {
  const token=newToken(),csrfToken=newToken();
  await Session.create({user:user._id,tokenHash:hashToken(token),csrfToken,expiresAt:new Date(Date.now()+60000)});
  return {Origin:origin,Cookie:`campus_session=${token}`,'X-CSRF-Token':csrfToken};
}
async function call(path,method='GET',body,auth=headers) {
  const response=await fetch(base+path,{method,headers:{...auth,...(body?{'Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined});
  return {status:response.status,content:await response.json()};
}
async function legacyPost(user=author,extra={}) {
  return Post.create({user:user._id,caption:'Existing student achievement',media:'https://example.org/campus.jpg',...extra});
}
beforeEach(async()=>{
  await Promise.all([User.deleteMany({}),Post.deleteMany({}),Comment.deleteMany({}),CampusPost.deleteMany({}),Session.deleteMany({}),Follow.deleteMany({})]);
  student=await User.create({username:'student',email:'student@example.edu',password:'unused',name:'Student'});
  author=await User.create({username:'author',email:'author@example.edu',password:'unused',name:'Author'});
  headers=await sessionFor(student);
});

test('legacy post likes persist in the original post collection and remain idempotent',async()=>{
  const post=await legacyPost();
  assert.equal((await call(`/feed/${post.id}/like`,'PUT',{liked:true})).status,200);
  assert.equal((await call(`/feed/${post.id}/like`,'PUT',{liked:true})).status,200);
  assert.deepEqual((await Post.findById(post.id)).likes.map(String),[student.id]);
  let feed=await call('/feed');
  assert.equal(feed.content.find(p=>p.id===post.id).liked,true);
  assert.equal((await call(`/feed/${post.id}/like`,'PUT',{liked:false})).status,200);
  assert.equal((await Post.findById(post.id)).likes.length,0);
});

test('legacy post bookmarks use the original user savedPosts field',async()=>{
  const post=await legacyPost();
  assert.equal((await call(`/feed/${post.id}/save`,'PUT',{saved:true})).status,200);
  assert.equal((await call(`/feed/${post.id}/save`,'PUT',{saved:true})).status,200);
  assert.deepEqual((await User.findById(student.id)).savedPosts.map(String),[post.id]);
  assert.equal((await call('/feed')).content.find(p=>p.id===post.id).saved,true);
  assert.equal((await call(`/feed/${post.id}/save`,'PUT',{saved:false})).status,200);
  assert.equal((await User.findById(student.id)).savedPosts.length,0);
});

test('legacy post comments retain original comment references and appear in the combined feed',async()=>{
  const post=await legacyPost();
  assert.equal((await call(`/feed/${post.id}/comments`,'POST',{text:'  Congratulations!  '})).status,201);
  const stored=await Post.findById(post.id);
  assert.equal(stored.comments.length,1);
  const comment=await Comment.findById(stored.comments[0]);
  assert.equal(comment.text,'Congratulations!');
  assert.equal(String(comment.post),post.id);
  assert.equal(String(comment.targetId),post.id);
  assert.equal(comment.targetType,'post');
  assert.equal(String(comment.user),student.id);
  const item=(await call('/feed')).content.find(p=>p.id===post.id);
  assert.equal(item.comments[0].text,'Congratulations!');
  assert.equal(item.comments[0].author.name,'Student');
  assert.equal(item.comments[0].author.email,undefined);
});

test('legacy comments enforce the original 300-character limit with a useful client error',async()=>{
  const post=await legacyPost();
  const rejected=await call(`/feed/${post.id}/comments`,'POST',{text:'x'.repeat(301)});
  assert.equal(rejected.status,400);
  assert.match(rejected.content.message,/300/);
  assert.equal(await Comment.countDocuments(),0);
  assert.equal((await call(`/feed/${post.id}/comments`,'POST',{text:'x'.repeat(300)})).status,201);
});

test('archived legacy posts are absent from the feed and reject every interaction',async()=>{
  const post=await legacyPost(author,{isArchived:true});
  assert.equal((await call('/feed')).content.some(p=>p.id===post.id),false);
  for(const [action,method,body] of [['like','PUT',{liked:true}],['save','PUT',{saved:true}],['comments','POST',{text:'Hidden'}]]) {
    assert.equal((await call(`/feed/${post.id}/${action}`,method,body)).status,404);
  }
  assert.equal((await Post.findById(post.id)).likes.length,0);
  assert.equal(await Comment.countDocuments(),0);
});

test('private legacy posts are visible to their author and accepted followers only',async()=>{
  await User.updateOne({_id:author.id},{$set:{isPrivate:true}});
  const post=await legacyPost();
  await Follow.create({from:student.id,to:author.id,status:'requested'});
  assert.equal((await call('/feed')).content.some(p=>p.id===post.id),false);
  for(const [action,method,body] of [['like','PUT',{liked:true}],['save','PUT',{saved:true}],['comments','POST',{text:'Private'}]]) {
    assert.equal((await call(`/feed/${post.id}/${action}`,method,body)).status,403);
  }
  assert.equal((await call('/feed','GET',undefined,await sessionFor(author))).content.some(p=>p.id===post.id),true);
  await User.updateOne({_id:student.id},{$addToSet:{following:author.id}});
  await User.updateOne({_id:author.id},{$addToSet:{followers:student.id}});
  await Follow.updateOne({from:student.id,to:author.id},{$set:{status:'accepted'}});
  assert.equal((await call('/feed')).content.some(p=>p.id===post.id),true);
  assert.equal((await call(`/feed/${post.id}/like`,'PUT',{liked:true})).status,200);
  assert.equal((await call(`/feed/${post.id}/save`,'PUT',{saved:true})).status,200);
  assert.equal((await call(`/feed/${post.id}/comments`,'POST',{text:'Visible to followers'})).status,201);
});

test('posts whose author was removed are omitted and return 404 for interactions',async()=>{
  const legacy=await legacyPost();
  const campus=await CampusPost.create({user:author.id,text:'Campus update'});
  await User.deleteOne({_id:author.id});
  assert.deepEqual((await call('/feed')).content,[]);
  for(const post of [legacy,campus]) {
    for(const [action,method,body] of [['like','PUT',{liked:true}],['save','PUT',{saved:true}],['comments','POST',{text:'Hello'}]]) {
      assert.equal((await call(`/feed/${post.id}/${action}`,method,body)).status,404);
    }
  }
});

test('campus comments keep their 500-character allowance',async()=>{
  const campus=await CampusPost.create({user:author.id,text:'New campus update'});
  assert.equal((await call(`/feed/${campus.id}/comments`,'POST',{text:'x'.repeat(500)})).status,201);
  assert.equal((await call(`/feed/${campus.id}/comments`,'POST',{text:'x'.repeat(501)})).status,400);
});

test('following public members creates the original accepted follow relationship',async()=>{
  assert.equal((await call(`/people/${author.id}/follow`,'PUT',{following:true})).status,200);
  assert.equal((await call(`/people/${author.id}/follow`,'PUT',{following:true})).status,200);
  const follow=await Follow.findOne({from:student.id,to:author.id});
  assert.equal(follow?.status,'accepted');
  assert.equal(await Follow.countDocuments(),1);
  assert.deepEqual((await User.findById(student.id)).following.map(String),[author.id]);
});

test('an accepted private connection can be unfollowed without granting pending followers access',async()=>{
  await User.updateOne({_id:author.id},{$set:{isPrivate:true},$addToSet:{followers:student.id}});
  await User.updateOne({_id:student.id},{$addToSet:{following:author.id}});
  await Follow.create({from:student.id,to:author.id,status:'accepted'});
  assert.equal((await call(`/people/${author.id}/follow`,'PUT',{following:true})).status,200);
  assert.equal((await call(`/people/${author.id}/follow`,'PUT',{following:false})).status,200);
  assert.equal(await Follow.countDocuments(),0);
  assert.equal((await User.findById(student.id)).following.length,0);
  assert.equal((await User.findById(author.id)).followers.length,0);
  assert.equal((await call(`/people/${author.id}/follow`,'PUT',{following:true})).status,403);
  assert.equal(await Follow.countDocuments(),0);
});
test('editing and removing campus and legacy posts require the author',async()=>{
 for(const legacy of [false,true]){
  const post=legacy?await legacyPost(author):await CampusPost.create({user:author._id,text:'Author original'});
  assert.equal((await call(`/feed/${post.id}`,'PATCH',{text:'Unauthorized edit'})).status,403);
  assert.equal((await call(`/feed/${post.id}`,'DELETE',{})).status,403);
  const own=await sessionFor(author);
  assert.equal((await call(`/feed/${post.id}`,'PATCH',{text:'Updated by author'},own)).status,200);
  const feed=await call('/feed','GET',undefined,own);assert.equal(feed.content.find(p=>p.id===post.id).text,'Updated by author');
  assert.equal((await call(`/feed/${post.id}`,'DELETE',{},own)).status,200);
  assert.ok(!(await call('/feed','GET',undefined,own)).content.some(p=>p.id===post.id));
 }
});
