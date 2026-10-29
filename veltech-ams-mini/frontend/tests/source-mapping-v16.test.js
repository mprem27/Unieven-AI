import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeAcademic} from '../src/lib/attendance.js';

test('AMS profile fields survive normalization when supplied under canonical keys',()=>{
 const profile={name:'Synthetic student',studentId:'SAMPLE-01',department:'Computer Science',mentor:'Synthetic mentor',photo:'data:image/png;base64,synthetic',section:'B',batch:'2024–2028'};
 const result=normalizeAcademic({profile});
 for(const [key,value] of Object.entries(profile))assert.equal(result.profile[key],value,key);
});
test('AMS aliases fill missing fields without overwriting explicit source values',()=>{
 const result=normalizeAcademic({profile:{studentId:'SOURCE-ID',vtuNumber:'PORTAL-ID',department:'CSE',branch:'Computer Science',mentor:'Advisor',mentorName:'Faculty',photo:'/own-photo',photoUrl:'/alias-photo'}});
 assert.equal(result.profile.studentId,'SOURCE-ID');assert.equal(result.profile.department,'CSE');assert.equal(result.profile.mentor,'Advisor');assert.equal(result.profile.photo,'/own-photo');
});
test('an explicit subject percentage survives without fabricating attendance counts',()=>{
 const result=normalizeAcademic({summary:[{subjectCode:'SYN101',subjectName:'Synthetic course',percentage:82.5,source:'ams'}]});
 assert.equal(result.subjects[0].percent,82.5);assert.equal(result.subjects[0].total,0);assert.equal(result.subjects[0].present,0);
});
