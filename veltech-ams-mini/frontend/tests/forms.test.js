import test from 'node:test';
import assert from 'node:assert/strict';
import {unzipSync,strFromU8} from 'fflate';
import {parseTicketPayload,locationReading,createSampleForms,buildFormPayload,canAuthorForms,formShareUrl,captureCameraFrame,formResponsesXlsx} from '../src/lib/forms.js';
test('camera/manual check-in rejects wrong events and incomplete or oversized QR payloads',()=>{
 const ticket={eventId:'a'.repeat(24),registrationId:'b'.repeat(24),qrToken:'c'.repeat(64)};
 assert.deepEqual(parseTicketPayload(JSON.stringify(ticket),ticket.eventId),ticket);
 for(const raw of ['not json',JSON.stringify({...ticket,eventId:'d'.repeat(24)}),JSON.stringify({...ticket,qrToken:''}),'x'.repeat(5000)])assert.throws(()=>parseTicketPayload(raw,ticket.eventId));
});
test('browser location preserves timestamp and accuracy for server validation',()=>{
 assert.deepEqual(locationReading({coords:{latitude:13,longitude:80,accuracy:12},timestamp:1234}),{latitude:13,longitude:80,accuracy:12,capturedAt:1234});
});
test('form builder serializes typed options and empty conditions without proof bytes',()=>{
 const draft={title:'Feedback',description:'',scope:'department',department:'CSE',club:'',fields:[{id:'choice',label:'Choose',type:'select',required:true,options:'A\nB'}],state:'published',eventId:'',opensAt:'',closesAt:'',requireProof:true,requireRegistration:false,checkIn:false,locationEnabled:false};
 const result=buildFormPayload(draft);assert.deepEqual(result.fields[0].choices,['A','B']);assert.equal(result.geofence,null);assert.equal(result.eventId,null);
 const samples=createSampleForms();assert.ok(samples.every(x=>x.demo));assert.ok(samples[0].fields.length>1);
});
test('form author affordances follow faculty account role even with a student campus role',()=>{
 assert.equal(canAuthorForms({accountRole:'faculty',campusRole:'student'}),true);
 assert.equal(canAuthorForms({accountRole:'admin',campusRole:'student'}),true);
 for(const campusRole of ['club_organizer','department_coordinator','college_event_manager','admin'])assert.equal(canAuthorForms({accountRole:'student',campusRole}),false);
 assert.equal(formShareUrl('form123','https://campus.example'), 'https://campus.example/#/forms/form123');
 assert.equal(formShareUrl('form123','https://campus.example/preview/?token=discard#/forms'), 'https://campus.example/preview/#/forms/form123');
});
test('camera capture reads a ready live video frame, bounds dimensions and rejects absent frames',async()=>{
 await assert.rejects(captureCameraFrame({readyState:1,videoWidth:0,videoHeight:0}),/live camera preview/);
 const video={readyState:2,videoWidth:2400,videoHeight:1800},blob=new Blob(['synthetic-camera'],{type:'image/jpeg'}),calls=[];
 const canvas={getContext:()=>({drawImage:(...args)=>calls.push(args)}),toBlob:(callback,mime)=>{assert.equal(mime,'image/jpeg');callback(blob);}};
 assert.equal(await captureCameraFrame(video,()=>canvas),blob);assert.equal(canvas.width,1600);assert.equal(canvas.height,1200);assert.equal(calls[0][0],video);
});
test('Excel form exports are actual XLSX archives and keep hostile answers as literal text',()=>{
 const rows=Array.from({length:105},(_,i)=>[i,'=SUM(1,2)','தமிழ் & <proof>']);
 const files=unzipSync(formResponsesXlsx({title:'Test form',exportedAt:'2026-10-15',columns:['Number','Answer','Note'],rows}));
 assert.ok(files['[Content_Types].xml']);const sheet=strFromU8(files['xl/worksheets/sheet1.xml']);
 assert.match(sheet,/=SUM\(1,2\)/);assert.match(sheet,/தமிழ் &amp; &lt;proof&gt;/);assert.doesNotMatch(sheet,/<f[ >]/);assert.equal((sheet.match(/<row /g) || []).length,109);
 assert.throws(()=>formResponsesXlsx({columns:['A'],rows:Array(10001).fill([])}),/supported size/);
});
