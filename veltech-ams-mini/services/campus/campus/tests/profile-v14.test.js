import test,{before,after,beforeEach} from 'node:test';
import assert from 'node:assert/strict';
import {registerCommunityExtras} from '../routes/community-extra.js';
import {registerAuth} from '../routes/auth.js';
import {publicUser} from '../policy.js';
import {harness,member,clearCollections} from './support/social-harness.js';
import User from '../../models/User.js';

let app,owner,other;
before(async()=>{app=await harness('profile_v14',(router,config)=>{registerCommunityExtras(router,config);registerAuth(router,config);});});
after(async()=>app.close());
beforeEach(async()=>{
 await clearCollections();
 owner=await member('owner',{name:'Social display',department:'CSE',club:'coding',studentId:'AMS-ONLY',phone:'PRIVATE-PHONE',gender:'Female',dob:new Date('2004-01-02')});
 other=await member('other');
});
const call=(path,body,actor=owner,method='PATCH')=>app.call(path,{user:actor,method,body});

test('social department and links persist independently from authorization and official records',async()=>{
 const links=[{label:'Portfolio',url:'https://example.test/work'},{label:'GitHub',url:'https://github.com/example'}];
 const result=await call('/members/me',{name:'New social name',username:'new.owner',socialDepartment:'Creative computing',socialLinks:links,bio:'Building together',isPrivate:true});
 assert.equal(result.status,200);assert.equal(result.body.user.socialDepartment,'Creative computing');assert.deepEqual(result.body.user.socialLinks,links);
 const saved=await User.findById(owner.id);
 assert.equal(saved.name,'New social name');assert.equal(saved.department,'CSE');assert.equal(saved.club,'coding');assert.equal(saved.role,'student');assert.equal(saved.campusRole,'student');assert.equal(saved.studentId,'AMS-ONLY');assert.equal(saved.phone,'PRIVATE-PHONE');assert.equal(saved.dob.toISOString().slice(0,10),'2004-01-02');
});

test('official and privilege fields are explicitly rejected without partial social updates',async()=>{
 for(const field of ['department','branch','role','accountRole','campusRole','club','studentId','email','phone','phoneNumber','gender','dob','dateOfBirth','section','semester','parentName','portalPrincipal','officialProfile','id','_id']){
  const result=await call('/members/me',{bio:'Should not persist',[field]:'changed'});
  assert.equal(result.status,400,field);
 }
 assert.equal((await User.findById(owner.id)).bio,'');
 for(const body of [{phone:'changed'},{department:'changed'},{role:'admin'}])assert.equal((await call('/profile',body)).status,400);
 assert.equal((await User.findById(owner.id)).phone,'PRIVATE-PHONE');
 assert.equal((await call('/profile',{bio:'A safe introduction'})).status,200);
});

test('only the authenticated owner can update a social profile',async()=>{
 assert.equal((await call('/members/me',{bio:'Owned edit'})).status,200);
 assert.equal((await call('/members/owner',{bio:'Intrusion'},other)).status,403);
 assert.equal((await call('/members/me',{bio:'Unsigned'},null)).status,401);
 assert.equal((await User.findById(owner.id)).bio,'Owned edit');assert.equal((await User.findById(other.id)).bio,'');
});

test('public and own social DTOs exclude official and private student information',async()=>{
 await User.updateOne({_id:owner._id},{$set:{socialDepartment:'Product design',socialLinks:[{label:'Work',url:'https://example.test'}]}});
 const own=await call('/members/me',undefined,owner,'GET'),publicProfile=await call('/members/owner',undefined,other,'GET'),directory=await call('/members',undefined,other,'GET');
 for(const result of [own,publicProfile,directory]){
  assert.equal(result.status,200);
  assert.doesNotMatch(JSON.stringify(result.body),/AMS-ONLY|PRIVATE-PHONE|owner@example|2004-01|"department"|"gender"|"dob"|"role"|"campusRole"|"club"|"studentId"/);
 }
 assert.equal(publicProfile.body.member.socialDepartment,'Product design');assert.equal(publicProfile.body.member.socialLinks[0].label,'Work');
 assert.equal(publicUser({...owner.toObject(),role:'faculty'}).accountRole,'faculty');
});

test('links allow only bounded HTTP or HTTPS addresses and reject unsafe or malformed input',async()=>{
 for(const value of ['javascript:alert(1)','data:text/html,test','ftp://example.test','https://user:password@example.test','/relative','https://']){
  assert.equal((await call('/members/me',{socialLinks:[{label:'Link',url:value}]})).status,400,value);
 }
 for(const socialLinks of ['https://example.test',[{url:'https://example.test'}],[{label:'x'.repeat(41),url:'https://example.test'}],Array.from({length:6},()=>({label:'Link',url:'https://example.test'})),[{label:'Link',url:'https://example.test',role:'admin'}]]){
  assert.equal((await call('/members/me',{socialLinks})).status,400);
 }
 assert.equal((await call('/members/me',{socialDepartment:'x'.repeat(101)})).status,400);
 assert.equal((await call('/members/me',{socialLinks:[{label:'Website',url:'http://example.test'}]})).status,200);
 assert.equal((await call('/members/me',{socialLinks:[]})).status,200);
});

test('public profile filters unsafe links even if stored outside the validated editor',async()=>{
 await User.collection.updateOne({_id:owner._id},{$set:{socialLinks:[{label:'Unsafe',url:'javascript:alert(1)'},{label:'Safe',url:'https://example.test'}]}});
 const result=await call('/members/owner',undefined,other,'GET');assert.equal(result.status,200);assert.deepEqual(result.body.member.socialLinks,[{label:'Safe',url:'https://example.test'}]);
});
test('unchanged legacy avatar does not block a social text edit, but arbitrary replacement is rejected',async()=>{
 const existing='https://example.test/legacy-avatar.png';await User.updateOne({_id:owner.id},{$set:{image:existing}});
 assert.equal((await call('/members/me',{image:existing,bio:'An updated introduction'})).status,200);
 assert.equal((await call('/members/me',{image:'https://example.test/replacement.png'})).status,400);
 assert.equal((await User.findById(owner.id)).image,existing);
});
