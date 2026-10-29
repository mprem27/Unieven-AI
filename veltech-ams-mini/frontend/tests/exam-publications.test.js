import test from 'node:test';
import assert from 'node:assert/strict';
import * as exams from '../src/lib/exam-publications.js';
const row={courseCode:'22CS-101',courseName:'Foundations',date:'2026-11-05',startTime:'09:00',endTime:'10:30',semester:'3',section:'A'};
const plan=()=>({id:'a'.repeat(24),title:'Mid term I',examType:'Mid term',academicYear:'2026–2027',term:'Odd',department:'CSE',rows:[{...row}],revision:4,publishedRevision:3,status:'published'});
function requireFunction(name){assert.equal(typeof exams[name],'function',`${name} must implement schedule review behavior`);return exams[name];}

test('publication validation accepts complete schedules and rejects missing exact codes',()=>{
 const validate=requireFunction('validateExamDraft');
 assert.deepEqual(validate(plan()),[]);
 const draft=plan();draft.rows[0].courseCode='';
 assert.ok(validate(draft).some(error=>error.row===0 && error.field==='courseCode'));
});
test('publication validation rejects nonexistent dates and reversed sessions',()=>{
 const validate=requireFunction('validateExamDraft'),draft=plan();
 draft.rows[0]={...row,date:'2026-02-30',startTime:'14:00',endTime:'13:00'};
 assert.ok(validate(draft).some(error=>error.field==='date'));
 assert.ok(validate(draft).some(error=>error.field==='endTime'));
});
test('overlapping sessions for the same exact course and overlapping audience require correction',()=>{
 const validate=requireFunction('validateExamDraft'),draft=plan();
 draft.rows.push({...row,courseCode:'22cs101',startTime:'10:00',endTime:'11:00',section:''});
 assert.ok(validate(draft).some(error=>error.row===1 && /overlap|conflict/i.test(error.message)));
 draft.rows[1].section='B';assert.deepEqual(validate(draft),[]);
});
test('review requires metadata and at least one schedule row',()=>{
 const validate=requireFunction('validateExamDraft'),draft=plan();draft.title='';draft.rows=[];
 assert.ok(validate(draft).some(error=>error.field==='title'));
 assert.ok(validate(draft).some(error=>error.field==='rows'));
});
test('saving a draft sends only editable metadata and rows with the current revision',()=>{
 const payload=requireFunction('examDraftPayload')(plan());
 assert.equal(payload.revision,4);assert.equal(payload.rows[0].courseCode,row.courseCode);
 assert.equal('status' in payload,false);assert.equal('publishedRevision' in payload,false);assert.equal('id' in payload,false);
});
test('publication persists the reviewed draft before publishing its returned revision',async()=>{
 const publish=requireFunction('publishExamDraft'),calls=[],saved=[];
 const result=await publish({plan:plan(),reviewed:true,onSaved:value=>saved.push(value),request:async(path,options)=>{calls.push({path,options});return {plan:{...plan(),revision:5,...(path.endsWith('/publish')?{publishedRevision:5}:{} )}};}});
 assert.equal(calls[0].options.method,'PUT');assert.equal(calls[0].options.body.revision,4);
 assert.equal(calls[1].path,`/exam-plans/${plan().id}/publish`);assert.deepEqual(calls[1].options.body,{revision:5,reviewed:true});
 assert.equal(saved[0].revision,5);assert.equal(result.publishedRevision,5);
});
test('publication cannot send a request without explicit review or valid rows',async()=>{
 const publish=requireFunction('publishExamDraft');let calls=0;const request=async()=>{calls++;};
 await assert.rejects(publish({plan:plan(),reviewed:false,request}),/review/i);
 const draft=plan();draft.rows[0].courseCode='';
 await assert.rejects(publish({plan:draft,reviewed:true,request}),/course code/i);
 assert.equal(calls,0);
});
test('a stale draft save aborts publication and surfaces the server error',async()=>{
 const publish=requireFunction('publishExamDraft'),calls=[];
 await assert.rejects(publish({plan:plan(),reviewed:true,request:async(path)=>{calls.push(path);throw new Error('Revision conflict. Reload the schedule.');}}),/Revision conflict/);
 assert.deepEqual(calls,[`/exam-plans/${plan().id}`]);
});

test('a published revision of zero is saved and republished using the new returned revision',async()=>{
 const calls=[],draft={...plan(),revision:0,publishedRevision:0};
 const result=await exams.publishExamDraft({plan:draft,reviewed:true,request:async(path,options)=>{calls.push(options.body);return {plan:{...draft,revision:1,publishedRevision:path.endsWith('/publish')?1:0}};}});
 assert.equal(calls[0].revision,0);assert.deepEqual(calls[1],{revision:1,reviewed:true});assert.equal(result.publishedRevision,1);
});

test('registry date ranges use the list API summary when full rows are omitted',()=>{
 const format=requireFunction('examScheduleDateRange');
 assert.equal(format({startDate:'2026-11-05',endDate:'2026-11-09'},value=>value),'2026-11-05 – 2026-11-09');
 assert.equal(format({rows:[{date:'2026-11-09'},{date:'2026-11-05'}]},value=>value),'2026-11-05 – 2026-11-09');
 assert.equal(format({startDate:'2026-11-05',endDate:'2026-11-05'},value=>value),'2026-11-05');
 assert.equal(format({},value=>value),'Dates not added');
});
test('publication review flags malformed course codes before a server request',()=>{
 const value=plan();value.rows[0].courseCode='Course 1 ?';
 assert.ok(exams.validateExamDraft(value).some(error=>error.field==='courseCode'));
});
