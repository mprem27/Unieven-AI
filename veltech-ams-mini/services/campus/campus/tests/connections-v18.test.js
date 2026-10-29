import test,{before,after,beforeEach} from 'node:test';
import assert from 'node:assert/strict';
import {registerCommunityExtras} from '../routes/community-extra.js';
import {harness,member,clearCollections} from './support/social-harness.js';
import User from '../../models/User.js';
import Follow from '../../models/Follow.js';

let app,owner,target;
before(async()=>{app=await harness('connections_v18',registerCommunityExtras);await Follow.init();});
after(async()=>app.close());
beforeEach(async()=>{await clearCollections();owner=await member('fixture_owner');target=await member('fixture_target');});

test('legacy null social link entries do not break discovery or the connection list',async()=>{
 await User.collection.updateOne({_id:target._id},{$set:{socialLinks:[null,{label:'Project',url:'https://example.test/project'}]}});
 await Follow.create({from:owner._id,to:target._id,status:'accepted'});
 for(const path of ['/members','/connections']){
  const result=await app.call(path,{user:owner});
  assert.equal(result.status,200,JSON.stringify(result.body));
  const person=path==='/members'?result.body[0]:result.body.following[0];
  assert.equal(person.username,target.username);
  assert.deepEqual(person.socialLinks,[{label:'Project',url:'https://example.test/project'}]);
 }
});

test('deactivated members do not appear in existing connections or receive new follows',async()=>{
 await Follow.create({from:owner._id,to:target._id,status:'accepted'});
 await User.updateOne({_id:target._id},{$set:{isActive:false}});
 const result=await app.call('/connections',{user:owner});
 assert.equal(result.status,200);assert.deepEqual(result.body.following,[]);
 assert.equal((await app.call(`/connections/${target.id}`,{user:owner,method:'POST',body:{}})).status,404);
});
