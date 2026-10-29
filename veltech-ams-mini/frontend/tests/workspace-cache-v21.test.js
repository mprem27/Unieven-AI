import test from 'node:test';
import assert from 'node:assert/strict';
import {indexedDB} from 'fake-indexeddb';
import {browserFixture} from './helpers/jsx.js';
const cache=await import('../src/lib/workspace-cache.js').catch(()=>({}));
const student={profile:{id:'a',accountRole:'student',campusRole:'department_coordinator',name:'Fixture Student',studentId:'VTU100',fatherName:'PRIVATE FAMILY',aadhaarNumber:'GOVERNMENT ID',csrfToken:'SECRET'},subjects:[{code:'CS',name:'Algorithms',present:9,total:10}],academic:{results:[{courseCode:'CS',source:'ams',grade:'A',token:'SECRET'}],fees:[{name:'Tuition',amount:500,status:'Paid',source:'ams'}]},timetable:[]};
test('automatic cache encrypts whitelisted academic fields with a nonextractable device key and owner/expiry binding',async()=>{
 assert.equal(typeof cache.rememberVerifiedWorkspace,'function');
 const browser=browserFixture();globalThis.indexedDB=indexedDB;
 try{
  await cache.clearWorkspaceCache();await cache.rememberVerifiedWorkspace('a',student);
  const restored=await cache.readRememberedWorkspace();assert.equal(restored.owner,'a');assert.equal(restored.data.subjects[0].present,9);assert.equal(restored.data.academic.fees[0].amount,500);
  assert.equal(restored.data.profile.accountRole,'student');assert.equal(restored.data.profile.campusRole,'student');assert.ok(!JSON.stringify(restored).includes('SECRET'));assert.ok(!JSON.stringify(restored).includes('PRIVATE FAMILY'));assert.ok(!JSON.stringify(restored).includes('GOVERNMENT ID'));
  const db=await new Promise((resolve,reject)=>{const request=indexedDB.open('veltech-ams-mini:workspace:v1');request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);});
  const entries=await new Promise(resolve=>{const tx=db.transaction('private','readonly'),request=tx.objectStore('private').getAll();request.onsuccess=()=>resolve(request.result);});db.close();
  const key=entries.find(entry=>entry?.type==='secret');assert.ok(key);assert.equal(key.extractable,false);await assert.rejects(crypto.subtle.exportKey('raw',key));
  assert.ok(!JSON.stringify(entries).includes('Fixture Student'));assert.ok(!JSON.stringify(entries).includes('Algorithms'));
  assert.equal(await cache.readWorkspaceResource('other','/academics/faculty-exams'),null);
  assert.equal(await cache.readRememberedWorkspace(Date.now()+8*86400000),null);
 }finally{await cache.clearWorkspaceCache();browser.restore();delete globalThis.indexedDB;}
});
test('only approved student GET resources persist and switching owners revokes the previous workspace',async()=>{
 assert.equal(typeof cache.saveWorkspaceResource,'function');const browser=browserFixture();globalThis.indexedDB=indexedDB;
 try{
  await cache.clearWorkspaceCache();await cache.rememberVerifiedWorkspace('a',student);
  await cache.saveWorkspaceResource('a','/academics/faculty-exams',{examinations:[{id:'exam',title:'Fixture exam',date:'2026-10-30',password:'SECRET'}]});
  const file={name:'Own.pdf',mime:'application/pdf',size:20,url:'/api/campus/academics/campus-documents/own/file'};await cache.saveWorkspaceResource('a','/academics/campus-documents',{documents:[{id:'own',title:'Own document',file}]});assert.deepEqual((await cache.readWorkspaceResource('a','/academics/campus-documents')).documents[0].file,file);
  assert.equal((await cache.readWorkspaceResource('a','/academics/faculty-exams')).examinations[0].title,'Fixture exam');
  assert.ok(!JSON.stringify(await cache.readWorkspaceResource('a','/academics/faculty-exams')).includes('SECRET'));
  await cache.saveWorkspaceResource('a','/admin/directory',{accounts:[{name:'PRIVATE'}]});assert.equal(await cache.readWorkspaceResource('a','/admin/directory'),null);
  await cache.rememberVerifiedWorkspace('b',{...student,profile:{id:'b',accountRole:'student',name:'New owner'}});
  assert.equal(await cache.readWorkspaceResource('a','/academics/faculty-exams'),null);assert.equal((await cache.readRememberedWorkspace()).owner,'b');
  await cache.clearWorkspaceCache();await cache.rememberVerifiedWorkspace('staff',{...student,profile:{id:'staff',accountRole:'admin'}});assert.equal(await cache.readRememberedWorkspace(),null);
 }finally{await cache.clearWorkspaceCache();browser.restore();delete globalThis.indexedDB;}
});
test('local logout survives reload and prevents a pending late save from restoring records',async()=>{
 assert.equal(typeof cache.markLocalLogout,'function');const browser=browserFixture();globalThis.indexedDB=indexedDB;
 try{
  await cache.clearWorkspaceCache();await cache.rememberVerifiedWorkspace('a',student);
  const late=cache.saveWorkspaceResource('a','/schedules',{schedules:[{title:'Late'}]});await cache.markLocalLogout();await late;
  assert.equal(cache.hasLocalLogout(),true);assert.equal(await cache.readRememberedWorkspace(),null);
  assert.equal(await cache.readWorkspaceResource('a','/schedules'),null);
 }finally{cache.clearLocalLogout();await cache.clearWorkspaceCache();browser.restore();delete globalThis.indexedDB;}
});
test('source report identity, academic download identifiers and room selectors survive the academic whitelist',async()=>{
 const browser=browserFixture();globalThis.indexedDB=indexedDB;
 try{
  const academic={results:[{courseCode:'CS',source:'ams',sourceReport:'Semester report',examinationSession:'APR-2026',sgpa:8.7,grade:'A'}],documents:[{name:'Transcript',source:'ams',downloadId:'1234567890abcdef12345678'}],credits:[{rowType:'category',requiredCredits:20,creditPoints:180,sourceColumns:{requiredCredits:'Credits required'}}]};
  await cache.rememberVerifiedWorkspace('a',{...student,academic,roomOverrides:[{source:'administrator',sourceRoom:'Old',room:'New',faculty:'Teacher',courseCode:'CS'}]});
  const value=(await cache.readRememberedWorkspace()).data;assert.deepEqual(value.academic,academic);assert.equal(value.roomOverrides[0].sourceRoom,'Old');assert.equal(value.profile.officialProfile.studentId,'VTU100');assert.equal(value.profile.officialProfile.fatherName,undefined);
 }finally{await cache.clearWorkspaceCache();browser.restore();delete globalThis.indexedDB;}
});
