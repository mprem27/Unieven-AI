import test from 'node:test';
import assert from 'node:assert/strict';
import {officialStudentProfile,socialProfileDraft,socialProfileBody,applyDemoSocialProfile,safeSocialLinks} from '../src/lib/social-profile.js';

test('official student details use AMS data exclusively in connected mode',()=>{
 const account={name:'Campus nickname',department:'Campus department',studentId:'Unverified',officialProfile:{name:'AMS name',department:'AMS branch',section:'B'}};
 assert.equal(officialStudentProfile(account,'connected').name,'AMS name');
 assert.deepEqual(officialStudentProfile({...account,officialProfile:undefined},'connected'),{});
 assert.equal(officialStudentProfile(account,'demo').section,'B');
});

test('demo social edits cannot overwrite official identity, department, contact or account privileges',()=>{
 const state={profile:{id:'me',name:'Official name',department:'CSE',role:'student',club:'coding',phone:'Official phone',officialProfile:{name:'Official name'}}};
 applyDemoSocialProfile(state,{name:'Social name',username:'social.name',bio:'Hello',image:'photo',socialDepartment:'Design',socialLinks:[],isPrivate:true,department:'Other',role:'admin',phone:'Changed'});
 assert.equal(state.profile.name,'Official name');assert.equal(state.profile.socialName,'Social name');assert.equal(state.profile.department,'CSE');assert.equal(state.profile.socialDepartment,'Design');assert.equal(state.profile.role,'student');assert.equal(state.profile.club,'coding');assert.equal(state.profile.phone,'Official phone');assert.equal(state.profile.officialProfile.name,'Official name');
 assert.equal(socialProfileDraft(state.profile,true).name,'Social name');
});

test('editor submits only social details, trims input, and omits unused blank links',()=>{
 const body=socialProfileBody({...socialProfileDraft({name:'Social name',username:'person.name'}),socialDepartment:'  Design  ',socialLinks:[{label:' Portfolio ',url:' https://example.test/work '},{label:'',url:''}],dob:'2004-01-02',gender:'Female',department:'CSE'});
 assert.equal(body.socialDepartment,'Design');assert.deepEqual(body.socialLinks,[{label:'Portfolio',url:'https://example.test/work'}]);
 assert.equal(body.department,undefined);assert.equal(body.dob,undefined);assert.equal(body.gender,undefined);
});

test('unsafe saved links stay hidden and invalid links cannot be submitted',()=>{
 const good={label:'Portfolio',url:'https://example.test'};
 assert.deepEqual(safeSocialLinks([good,{label:'Bad',url:'javascript:alert(1)'}]),[good]);
 for(const url of ['javascript:alert(1)','data:text/html,hello','https://user:password@example.test','/relative']){
  assert.throws(()=>socialProfileBody({name:'Name',username:'person',socialLinks:[{label:'Bad',url}]}),/HTTP or HTTPS/);
 }
});
