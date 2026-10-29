import test from 'node:test';
import assert from 'node:assert/strict';
import {createDeviceSnapshot,sealSnapshot,openSnapshot} from '../src/lib/device-storage.js';
test('snapshot excludes profiles, contact, family, credentials, document details and file bytes',()=>{
 const snapshot=createDeviceSnapshot({profile:{name:'Private Student',studentId:'Private ID',officialProfile:{fatherName:'Private',phone:'Private'}},subjects:[{id:'s',name:'Math',present:9,total:10,token:'secret'}],classes:[],records:[{password:'secret'}],academic:{documents:[{name:'Private document',fileData:'secret'}],fees:[{name:'Private receipt',reference:'secret'}]}},'connected');
 assert.equal(snapshot.subjects[0].name,'Math');assert.equal(snapshot.subjects[0].percentage,90);assert.ok(!snapshot.profile);assert.ok(!JSON.stringify(snapshot).includes('Private'));assert.ok(!JSON.stringify(snapshot).includes('secret'));assert.ok(!snapshot.academic.documents);assert.ok(!snapshot.academic.fees);
});
test('AES device envelope unlocks only with correct passphrase and contains no plaintext records',async()=>{
 const payload={subjects:[{name:'Mathematics'}],source:'connected'},envelope=await sealSnapshot(payload,'DevicePassphrase123',1,1000);
 assert.ok(!JSON.stringify(envelope).includes('Mathematics'));assert.deepEqual(await openSnapshot(envelope,'DevicePassphrase123',2000),payload);await assert.rejects(openSnapshot(envelope,'wrong-password',2000));
});
test('expiry and tampered metadata cannot be bypassed',async()=>{
 const envelope=await sealSnapshot({subjects:[]},'DevicePassphrase123',1,1000);await assert.rejects(openSnapshot(envelope,'DevicePassphrase123',envelope.expiresAt+1),/expired/);await assert.rejects(openSnapshot({...envelope,expiresAt:envelope.expiresAt+1},'DevicePassphrase123',2000));
});
test('only selected sections are saved and unsupported section names cannot select private data',()=>{
 const data={profile:{name:'Private'},subjects:[{name:'Math',total:10,present:9}],records:[{subjectCode:'MA1',date:'2026-10-15',status:'present',token:'secret'}],timetable:[{day:'Thursday',subjectCode:'CS101',password:'secret'}],academic:{courses:[{code:'CS101',name:'Algorithms',credits:3}],results:[{courseCode:'CS101',grade:'A',credits:3,gradePoints:9,source:'ams',token:'secret'}]}};
 const snapshot=createDeviceSnapshot(data,'connected',['records','results','profile','documents']);assert.deepEqual(snapshot.selectedSections,['records','results']);assert.ok(!snapshot.subjects);assert.ok(!snapshot.timetable);assert.equal(snapshot.records[0].status,'present');assert.equal(snapshot.academic.results[0].gradePoints,9);assert.ok(!snapshot.academic.courses);assert.ok(!JSON.stringify(snapshot).includes('secret'));
});
test('connected offline results preserve source filtering and source-only percentages need no invented totals',()=>{
 const snapshot=createDeviceSnapshot({subjects:[{name:'Math',percent:82.5,total:0,present:0}],academic:{results:[{courseCode:'PRIVATE',source:'student-import',grade:'A'},{courseCode:'AMS',source:'ams',gradePoints:8}]},timetable:[],classes:[]},'connected');assert.deepEqual(snapshot.academic.results.map(row=>row.courseCode),['AMS']);assert.equal(snapshot.subjects[0].percentage,82.5);assert.equal(snapshot.subjects[0].total,0);
});
