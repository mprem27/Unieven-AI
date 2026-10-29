import test from 'node:test';
import assert from 'node:assert/strict';
import {unzipSync,strFromU8} from 'fflate';
import {createResultsReport,resultsPdf,resultsXlsx} from '../src/lib/results-export.js';
const marks=await import('../src/lib/academic-marks.js').catch(()=>({}));
const rows=[
 {courseCode:'CS101',courseName:'Networks',semester:'II',resultType:'Test marks',sourceReport:'Original',examinationSession:'May',testMark1:0,midTestMark1:'Absent',labMark:'12',internalMark:40,testMark1Max:30},
 {courseCode:'CS101',courseName:'Networks',semester:'2',resultType:'Test marks',sourceReport:'Revised',examinationSession:'May',testMark1:18,midTestMark1:'Not published',testMark1Maximum:25},
 {courseCode:'CS101',courseName:'Networks',semester:'II',resultType:'Test marks',sourceReport:'Original',examinationSession:'June',testMark1:19},
 {courseCode:'MA201',courseName:'Mathematics',semester:'III',resultType:'Internal marks',internalMark:'Not published'},
 {courseCode:'UNAVAILABLE',courseName:'Source marks pending',semester:'II',resultType:'Test marks'},
];

test('semester controls select Roman and Arabic source labels together without losing raw divisions',()=>{
 assert.equal(typeof marks.selectMarks,'function');
 const selected=marks.selectMarks(rows,{semester:'2',division:'unit'});
 assert.deepEqual(selected.rows,[rows[0],rows[1],rows[2],rows[4]]);
 assert.deepEqual(selected.semesters.map(item=>item.key),['2','3']);
 assert.deepEqual(selected.groups.map(group=>[group.sourceReport,group.semester,group.session]),[['Original','II','May'],['Revised','2','May'],['Original','II','June'],['','II','']]);
});

test('subject, source, session and individual assessment filters operate on the same visible selection',()=>{
 assert.equal(typeof marks.selectMarks,'function');
 const selected=marks.selectMarks(rows,{semester:'II',division:'unit',query:'  networks ',report:'Test marks · Original',session:'May',assessment:'midTestMark1'});
 assert.deepEqual(selected.rows,[rows[0]]);
 assert.deepEqual(marks.selectMarks(rows,{semester:'2',division:'lab'}).rows,[rows[0],rows[4]]);
 assert.deepEqual(marks.selectMarks(rows,{semester:'III',division:'internal'}).rows,[rows[3]]);
});

test('zero, absence and unpublished marks keep honest text; maxima are field-specific source facts',()=>{
 assert.equal(typeof marks.markCell,'function');
 assert.equal(marks.markCell(rows[0],'testMark1').text,'0 / 30');
 assert.equal(marks.markCell(rows[0],'midTestMark1').text,'Absent');
 assert.equal(marks.markCell(rows[1],'midTestMark1').text,'Not published');
 assert.equal(marks.markCell({},'testMark2').text,'Not updated');
 assert.equal(marks.markCell({testMark1:18,maximumMark:30},'testMark1').text,'18');
 assert.equal(marks.markCell({testMark1:18,testMark1Max:30,testMark1Maximum:20},'testMark1').text,'18');
 assert.match(marks.markCell({testMark1:18,testMark1Max:30,testMark1Maximum:20},'testMark1').note,/Conflicting source maxima/);
});

test('conflicting and malformed mark cells never become a made-up numeric score',()=>{
 assert.equal(typeof marks.markCell,'function');
 const conflict=marks.markCell({testMark1:[18,19]},'testMark1');
 assert.equal(conflict.state,'conflict');assert.match(conflict.text,/18.*19/);
 assert.equal(marks.markCell({testMark1:0,testMark1Max:'bad'},'testMark1').text,'0');
 assert.equal(marks.markCell({testMark1:31,testMark1Max:30},'testMark1').text,'31 / 30');
 assert.match(marks.markCell({testMark1:31,testMark1Max:30},'testMark1').note,/exceeds/);
});

test('PDF and Excel use exactly the visible source records and selected mark division',()=>{
 assert.equal(typeof marks.marksExportSelection,'function');
 const selected=marks.selectMarks(rows,{semester:'2',division:'unit',query:'Networks'});
 const selection=marks.marksExportSelection(selected);
 const report=createResultsReport({...selection,view:'assessments'});
 assert.equal(report.recordCount,selected.rows.length);
 assert.equal(report.groups.length,selected.groups.length);
 assert.deepEqual(report.groups.flatMap(group=>group.rows.map(row=>row.courseCode)),selected.rows.map(row=>row.courseCode));
 const sheets=Object.entries(unzipSync(resultsXlsx(report))).filter(([name])=>name.startsWith('xl/worksheets/')).map(([,bytes])=>strFromU8(bytes)).join('');
 assert.match(sheets,/0 \/ 30/);assert.match(sheets,/18 \/ 25/);assert.match(sheets,/Absent/);
 assert.doesNotMatch(sheets,/Final internal|<t[^>]*>Lab<\/t>/);
 const pdf=new TextDecoder().decode(resultsPdf(report));
 assert.match(pdf,/0 \/ 30/);assert.match(pdf,/Revised/);assert.match(pdf,/June/);
 assert.doesNotMatch(pdf,/Final internal|Lab: 12/);
});

test('a malformed competing maximum withholds the denominator and explains unavailable metadata',()=>{
 const cell=marks.markCell({testMark1:18,testMark1Max:30,testMark1Maximum:'unknown'},'testMark1');
 assert.equal(cell.text,'18');assert.equal(cell.maximum,null);assert.match(cell.note,/Invalid source maximum/);
});

test('saved academic marks keep bounded assessment maxima and strip private or unrelated metadata',async()=>{
 const {workspaceSnapshot}=await import('../src/lib/workspace-cache.js');
 const record={courseCode:'CS1',testMark1:0,midTestMark1:'Absent',testMark2:'Not published',testMark1Max:30,testMark2Maximum:'Unknown',midTestMark1Maximum:'20',labMark:12,labMarkMax:{password:'PRIVATE'},labMarkMaximum:30,internalMarkMax:'https://example.org/private',unrelatedMaximum:99,markMaximums:{testMark3:30,labMark:'Not provided',password:'PRIVATE',url:'https://example.org/private'}};
 const snapshot=workspaceSnapshot({profile:{id:'a'},academic:{results:[record]}},'a').academic.results[0];
 assert.equal(snapshot.testMark1Max,30);assert.equal(snapshot.testMark2Maximum,'Unknown');assert.equal(snapshot.midTestMark1Maximum,'20');
 assert.equal(snapshot.testMark1,0);assert.equal(snapshot.midTestMark1,'Absent');assert.equal(snapshot.testMark2,'Not published');
 assert.deepEqual(snapshot.markMaximums,{testMark3:30,labMark:'Not provided'});
 assert.equal(snapshot.labMarkMax,'Unavailable');assert.equal(snapshot.internalMarkMax,'Unavailable');
 assert.equal(marks.markCell(snapshot,'labMark').maximum,null,'offline records must retain an unresolved competing maximum');assert.equal(snapshot.unrelatedMaximum,undefined);
 assert.doesNotMatch(JSON.stringify(snapshot),/PRIVATE|example\.org/);
});
