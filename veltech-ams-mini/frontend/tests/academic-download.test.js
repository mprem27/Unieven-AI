import test from 'node:test';
import assert from 'node:assert/strict';
import {academicDownloadName} from '../src/lib/download.js';
test('academic files get the extension for their verified MIME type without trusting a misleading title',()=>{
 assert.equal(academicDownloadName('Tuition receipt.pdf','image/png'),'Tuition receipt.png');
 assert.equal(academicDownloadName('Transcript','application/pdf'),'Transcript.pdf');
 assert.equal(academicDownloadName('../My/record.pdf','application/pdf'),'.._My_record.pdf');
});
test('unrecognized file types are not given a fabricated academic extension',()=>{
 assert.equal(academicDownloadName('Document','application/octet-stream'),'Document');
});

test('private seating/template downloads work while external or arbitrary paths never fetch',async()=>{
 const {downloadRemote}=await import('../src/lib/download.js'),{setDownloadOwner}=await import('../src/lib/device-downloads.js');
 const savedFetch=globalThis.fetch,savedDocument=globalThis.document,requests=[],downloads=[];
 setDownloadOwner('fictional-owner');
 globalThis.fetch=async(url,options)=>{requests.push({url,options});return {ok:true,blob:async()=>new Blob(['VTU Number,Room,Seat\nVTU00000,A101,S12'],{type:'text/csv'})};};
 globalThis.document={createElement(){return {click(){downloads.push(this.download);}};}};
 try{
  for(const url of ['/api/campus/academics/exam-seating/'+'a'.repeat(24)+'/file','/api/campus/faculty-exams/'+'b'.repeat(24)+'/seating/template','/api/campus/academics/documents/'+'c'.repeat(24)])await downloadRemote(url,'seating.csv');
  assert.equal(downloads.length,3);assert.ok(requests.every(row=>row.options.credentials==='same-origin'));
  for(const url of ['https://example.test/secret','/api/campus/admin/directory','/api/campus/academics/exam-seating/'+'a'.repeat(24)+'/file?user=other'])await assert.rejects(downloadRemote(url,'bad.csv'));
  assert.equal(requests.length,3);
 }finally{globalThis.fetch=savedFetch;globalThis.document=savedDocument;setDownloadOwner('demo');}
});
