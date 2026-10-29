import test,{before,after,beforeEach} from 'node:test';
import assert from 'node:assert/strict';
import {rankCandidates,contentTokens} from '../services/recommendations.js';
import {registerRecommendations} from '../routes/recommendations.js';
import {harness,member,clearCollections} from './support/social-harness.js';
import {CampusPost} from '../models.js';
import Post from '../../models/Post.js';
import Reel from '../../models/Reel.js';
import Follow from '../../models/Follow.js';
const now=new Date('2026-10-15T12:00:00Z');
const candidate=(id,fields={})=>({kind:'post',item:{id},authorId:id,createdAt:now,likes:0,comments:0,views:0,tokens:[],...fields});
test('ranking uses persisted connections and interests with understandable reasons',()=>{
  const ranked=rankCandidates([candidate('new'),candidate('friend',{authorId:'friend',tokens:['robotics']}),candidate('old',{createdAt:'2020-01-01'})],{following:new Set(['friend']),interests:new Set(['robotics']),now});
  assert.equal(ranked[0].item.id,'friend');assert.match(ranked[0].reasons.join(' '),/connection.*liked/);assert.ok(ranked[1].score>ranked[2].score);
});
test('author and content diversity prevent one creator occupying every top slot',()=>{
  const candidates=[candidate('a1',{authorId:'a'}),candidate('a2',{authorId:'a'}),candidate('a3',{authorId:'a'}),candidate('b',{authorId:'b',kind:'reel'})];
  const ranked=rankCandidates(candidates,{now});assert.equal(ranked[0].item.id,'a1');assert.equal(ranked[1].item.id,'b');assert.equal(ranked.length,4);
});
test('engagement is bounded and a future timestamp does not outrank a fresh equal item',()=>{
  const fresh=rankCandidates([candidate('fresh')],{now})[0],future=rankCandidates([candidate('future',{createdAt:'2030-01-01'})],{now})[0];assert.equal(fresh.score,future.score);
  const huge=rankCandidates([candidate('huge',{likes:1e20})],{now})[0];assert.equal(huge.score,42);
  assert.deepEqual(contentTokens('The #Robotics robotics and Python'),['robotics','python']);
});
let app,user,author;
before(async()=>{app=await harness('recommendations',registerRecommendations);await Follow.init();});
after(async()=>app.close());
beforeEach(async()=>{await clearCollections();user=await member('reader',{department:'CSE'});author=await member('creator',{department:'CSE'});});
test('recommendations require authentication and validate bounded filters',async()=>{
  assert.equal((await app.call('/recommendations')).status,401);
  for(const query of ['limit=500','kind=unknown','eventId=bad'])assert.equal((await app.call(`/recommendations?${query}`,{user})).status,400);
});
test('private, archived and orphan content never enters suggestions or their media URLs',async()=>{
  const hidden=await member('hidden',{isPrivate:true});
  await CampusPost.create({user:hidden._id,text:'Secret research',image:'/secret.jpg'});
  await Post.create({user:author._id,media:'/archived.jpg',caption:'Archived',isArchived:true});
  await Reel.create({user:hidden._id,video:'/secret.mp4',caption:'Hidden video'});
  await Reel.create({user:author._id,video:'/mine.mp4',caption:'Only me',visibility:'private'});
  await Follow.create({from:user._id,to:hidden._id,status:'requested'});
  const result=await app.call('/recommendations',{user});assert.equal(result.status,200);assert.equal(result.body.items.length,0);assert.doesNotMatch(JSON.stringify(result.body),/secret\.jpg|secret\.mp4|mine\.mp4/);
  assert.equal(result.body.model,'campus-weighted-v1');assert.match(result.body.description,/rules-based/);
});
test('accepted follow makes private-account content readable and metadata stays allowlisted',async()=>{
  author.isPrivate=true;author.email='private@example.test';author.phone='9999999999';author.studentId='DO-NOT-LEAK';await author.save();
  await CampusPost.create({user:author._id,text:'Robotics seminar'});
  await Follow.create({from:user._id,to:author._id,status:'accepted'});
  const result=await app.call('/recommendations',{user});assert.equal(result.body.items.length,1);assert.equal(result.body.items[0].item.author.username,'creator');
  assert.doesNotMatch(JSON.stringify(result.body),/private@example|9999999999|DO-NOT-LEAK|"department"/);
});
