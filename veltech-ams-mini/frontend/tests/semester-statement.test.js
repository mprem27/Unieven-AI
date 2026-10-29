import test from 'node:test';
import assert from 'node:assert/strict';
import {createResultsReport,resultsPdf,resultsXlsx} from '../src/lib/results-export.js';
import {unzipSync,strFromU8} from 'fflate';
const statement=await import('../src/lib/semester-statement.js').catch(()=>null);
const rows=[
 {courseCode:'QA101',courseName:'Environmental Science',semester:'III',grade:'A',credits:3,gradePoints:9,resultType:'Regular',examinationSession:'NOVEMBER 2024',source:'ams'},
 {courseCode:'QA102',courseName:'Discrete Mathematics',semester:'III',grade:'B',credits:4,gradePoints:8,resultType:'Regular',examinationSession:'NOVEMBER 2024',source:'ams'},
];
const make=(extra={})=>createResultsReport({rows,filters:{semester:'III'},generatedAt:'2026-10-21T08:00:00Z',...extra});
test('statement identity uses official college fields and keeps registration separate from the AMS number',()=>{
 assert.equal(typeof statement?.statementStudent,'function');
 const value=statement.statementStudent({name:'Social alias',department:'Edited',officialProfile:{name:'Fictional Student',rollNumber:'QA-REG-001',vtuNumber:'VTU-DEMO',degree:'B.Tech',department:'Computer Science',email:'private@example.org',fatherName:'PRIVATE',photo:'PRIVATE'}},'connected');
 assert.equal(value.name,'Fictional Student');assert.equal(value.registrationNumber,'QA-REG-001');assert.equal(value.rollNumber,'VTU-DEMO');
 assert.ok(!JSON.stringify(value).includes('PRIVATE'));assert.ok(!JSON.stringify(value).includes('Social alias'));
 assert.deepEqual(statement.statementStudent({name:'Social alias'},'connected'),{});
});
test('semester statement carries only explicitly requested identity fields',()=>{
 const report=make({student:{name:'Fictional Student',registrationNumber:'QA-REG-001',rollNumber:'VTU-DEMO',degree:'B.Tech',department:'Computer Science',password:'PRIVATE',email:'PRIVATE',photo:'PRIVATE'}});
 assert.equal(report.student?.name,'Fictional Student');assert.ok(!JSON.stringify(report).includes('PRIVATE'));
});
test('semester PDF has the reference header, six-column subject grid and semester summary',()=>{
 const pdf=new TextDecoder().decode(resultsPdf(make({student:{name:'Fictional Student',registrationNumber:'QA-REG-001',rollNumber:'VTU-DEMO',degree:'B.Tech',department:'Computer Science'}})));
 for(const text of ['Statement of Marks/Grade','III SEMESTER','NOVEMBER 2024','Reg No.','Roll No.','Fictional Student','QA-REG-001','VTU-DEMO','College/Department Name','Subject/Papers','Grade Points','SGPA','Total Credit Points','Student-generated copy'])assert.ok(pdf.includes(text),text);
 assert.match(pdf,/\/BaseFont \/Times-Roman/);assert.match(pdf,/\/Subtype \/Image/);assert.doesNotMatch(pdf,/PRIVATE/);
});
test('summary totals use complete listed source credits and points, with published GPA taking priority',()=>{
 assert.equal(typeof statement?.statementSummary,'function');
 const report=make({summary:[{label:'SGPA',value:'8.43',semester:'III'},{label:'CGPA',value:'8.12',semester:'III'}]});
 const value=statement.statementSummary(report.groups[0],report.sourceSummary);
 assert.equal(value.totalCredits,7);assert.equal(value.totalCreditPoints,59);assert.equal(value.sgpa,8.43);assert.equal(value.cgpa,8.12);assert.equal(value.year,'2024');
 assert.equal(value.totalMarks,'');assert.equal(value.division,'');
});
test('missing points, incomplete credits and conflicting published summaries stay blank',()=>{
 const report=make({rows:[{...rows[0],credits:undefined,gradePoints:undefined}],summary:[{label:'SGPA',value:'8',semester:'III'},{label:'SGPA',value:'9',semester:'III'},{label:'CGPA',value:'9.9'}]});
 const value=statement.statementSummary(report.groups[0],report.sourceSummary);
 assert.equal(value.totalCredits,'');assert.equal(value.totalCreditPoints,'');assert.equal(value.sgpa,'');assert.equal(value.cgpa,'');
});
test('different examination attempts remain separate and a filtered PDF identifies its scope',()=>{
 const report=make({rows:[...rows,{...rows[0],resultType:'Arrear',examinationSession:'MAY 2025',grade:'S'}],filters:{semester:'III',query:'QA10'}});
 assert.equal(report.groups.length,2);
 const pdf=new TextDecoder().decode(resultsPdf(report));assert.match(pdf,/Regular/);assert.match(pdf,/Arrear/);assert.match(pdf,/Filtered selection/);assert.match(pdf,/QA10/);
});
test('long values and many courses generate continued pages with valid binary PDF offsets',()=>{
 const report=make({rows:Array.from({length:95},(_,i)=>({...rows[0],courseCode:`QA(${i})`,courseName:'An unusually long course name with data structures and mathematical applications '.repeat(3)}))});
 const bytes=resultsPdf(report),pdf=new TextDecoder('latin1').decode(bytes);
 assert.ok((pdf.match(/\/Type \/Page\b/g)||[]).length>1);assert.match(pdf,/continued/);assert.match(pdf,/QA\\\(0\\\)/);
 const marker=new TextDecoder().decode(bytes.slice(-100)),start=Number(marker.match(/startxref\n(\d+)/)[1]);assert.equal(new TextDecoder().decode(bytes.slice(start,start+4)),'xref');
});
test('Excel remains a literal source workbook without student identity',()=>{
 const files=unzipSync(resultsXlsx(make({student:{name:'Private identity for PDF'}})));
 const sheet=Object.entries(files).filter(([path])=>path.startsWith('xl/worksheets/')).map(([,data])=>strFromU8(data)).join('');
 assert.ok(!sheet.includes('Private identity for PDF'));assert.match(sheet,/QA101/);assert.match(sheet,/Environmental Science/);
});
test('explicit published zero totals take priority over a calculated value',()=>{
 const report=make({summary:[{semester:'III',label:'Total Credit',value:'0'},{semester:'III',label:'Total Credit Points',value:'0'}]});
 const value=statement.statementSummary(report.groups[0],report.sourceSummary);assert.equal(value.totalCredits,0);assert.equal(value.totalCreditPoints,0);
});
