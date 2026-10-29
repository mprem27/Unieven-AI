import test from 'node:test';
import assert from 'node:assert/strict';
import {unzipSync,strFromU8} from 'fflate';
import * as results from '../src/lib/academic-results.js';

const rows=[
 {courseCode:'CS101',courseName:'Data structures',semester:'I',resultType:'Regular',sourceReport:'Published May',examinationSession:'May 2026',grade:'A',credits:4,gradePoints:9},
 {courseCode:'CS101',courseName:'Data structures',semester:'I',resultType:'Regular',sourceReport:'Revised May',examinationSession:'May 2026',grade:'B',credits:4,gradePoints:8},
 {courseCode:'CS102',courseName:'தமிழ் & logic',semester:'II',resultType:'Mid-test marks',midTestMark1:'0',midTestMark2:'Absent'},
 {courseCode:'CS103',courseName:'Networks',semester:'II',resultType:'Test marks',testMark1:'18',testMark2:'22',assignmentMark:'5'},
];
test('distinct source reports retain both attempts even when type, semester and exam session match',()=>{
 const groups=results.resultReportGroups(rows.slice(0,2));
 assert.equal(groups.length,2);
 assert.deepEqual(groups.map(group=>group.sourceReport),['Published May','Revised May']);
 assert.deepEqual(groups.flatMap(group=>group.rows).map(row=>row.grade),['A','B']);
});
test('one selection pipeline applies subject, semester, report, examination and individual assessment filters',()=>{
 assert.equal(typeof results.filterResults,'function','results must expose one filter pipeline');
 assert.deepEqual(results.filterResults(rows,{semester:'II',query:'  தமிழ் ',assessment:'midTestMark1'}),[rows[2]]);
 assert.deepEqual(results.filterResults(rows,{semester:'II',assessment:'testMark2',query:'cs103'}),[rows[3]]);
 assert.deepEqual(results.filterResults(rows,{report:'Regular · Published May',session:'May 2026'}),[rows[0]]);
 assert.deepEqual(results.filterResults(rows,{semester:'I',assessment:'labMark'}),[]);
});
test('a result row containing grades and marks remains available in both independent views',()=>{
 const prepared=results.prepareResults([{courseCode:'MIX',grade:'A',testMark1:'0'}]);
 assert.equal(prepared.grades.length,1);assert.equal(prepared.assessments.length,1);
});
test('overall CGPA and percentage require unambiguous explicit summaries and ignore semester totals',()=>{
 assert.equal(typeof results.publishedResultSummary,'function','summary must use explicitly published values');
 assert.deepEqual(results.publishedResultSummary([{label:'CGPA',value:'8.75'},{label:'Overall Percentage',value:'82.4%'}]),{cgpa:8.75,percentage:82.4});
 assert.deepEqual(results.publishedResultSummary([{label:'GPA',value:8},{label:'CGPA',value:8,semester:'I'},{label:'Credits earned',value:44}]),{cgpa:null,percentage:null});
 assert.deepEqual(results.publishedResultSummary([{label:'CGPA',value:8},{label:'CGPA',value:9},{label:'Percentage',value:101}]),{cgpa:null,percentage:null});
});
test('assessment trends retain zero, leave unavailable marks as gaps and never combine assessment scales',()=>{
 const graph=results.resultTrend(rows.slice(2),'II','midTestMark1');
 assert.deepEqual(graph.map(point=>point.value),[0,null]);
 assert.equal(results.resultTrend(rows.slice(2),'II','midTestMark2')[0].value,null);
});

const exports=await import('../src/lib/results-export.js').catch(()=>null);
test('report model captures exactly selected data, separate divisions and filter metadata without private identity',()=>{
 assert.equal(typeof exports?.createResultsReport,'function','a results report exporter is required');
 const report=exports.createResultsReport({rows:rows.slice(0,2),filters:{semester:'I',query:'CS101'},summary:[{label:'CGPA',value:'8.7'}],mode:'demo',profile:{studentId:'PRIVATE'},generatedAt:'2026-10-19T12:00:00Z'});
 assert.equal(report.groups.length,2);assert.equal(report.recordCount,2);assert.equal(report.filters.semester,'I');
 assert.equal(report.summary.cgpa,8.7);assert.ok(!JSON.stringify(report).includes('PRIVATE'));
});
test('Excel export is an OOXML workbook with summary and separate source sheets, literal text and Unicode',()=>{
 assert.equal(typeof exports?.resultsXlsx,'function','Excel export is required');
 const report=exports.createResultsReport({rows:[...rows,{...rows[3],courseName:'=HYPERLINK("https://example.org")'}],filters:{semester:'all'},generatedAt:'2026-10-19'});
 const files=unzipSync(exports.resultsXlsx(report));
 assert.ok(files['[Content_Types].xml']);
 const workbook=strFromU8(files['xl/workbook.xml']);
 assert.equal((workbook.match(/<sheet /g)||[]).length,report.groups.length+1);
 const sheets=Object.entries(files).filter(([name])=>name.startsWith('xl/worksheets/')).map(([,bytes])=>strFromU8(bytes)).join('\n');
 assert.match(sheets,/தமிழ் &amp; logic/);assert.match(sheets,/mid-test 1/i);assert.match(sheets,/HYPERLINK/);assert.doesNotMatch(sheets,/<f[ >]/);
 assert.match(sheets,/Published May/);assert.match(sheets,/Revised May/);
});
test('selected semester PDF has real pages and valid object offsets, escapes data and rejects all-semester scope',()=>{
 assert.equal(typeof exports?.resultsPdf,'function','actual PDF export is required');
 const many=Array.from({length:95},(_,index)=>({...rows[0],courseCode:`CS(${index})`,courseName:'A long course name about data structures and programming'}));
 const report=exports.createResultsReport({rows:many,filters:{semester:'I'},generatedAt:'2026-10-19'});
 const pdf=new TextDecoder().decode(exports.resultsPdf(report));
 assert.ok(pdf.startsWith('%PDF-1.4'));assert.ok(pdf.endsWith('%%EOF\n'));
 assert.match(pdf,/Semester I/);assert.match(pdf,/CS\\\(0\\\)/);assert.ok((pdf.match(/\/Type \/Page\b/g)||[]).length>1);
 const start=Number(pdf.match(/startxref\n(\d+)/)[1]);assert.equal(pdf.slice(start,start+4),'xref');
 const xref=pdf.slice(start).split('\n'),count=Number(xref[1].split(' ')[1]);
 for(let index=1;index<count;index++){const offset=Number(xref[index+2].slice(0,10));assert.ok(pdf.slice(offset).startsWith(`${index} 0 obj`));}
 assert.throws(()=>exports.resultsPdf(exports.createResultsReport({rows,filters:{semester:'all'}})),/Select a semester/);
 assert.throws(()=>exports.createResultsReport({rows,filters:{semester:'I'}}),/outside the selected semester/);
});
test('an individual assessment export omits marks from other assessment scales',()=>{
 const report=exports.createResultsReport({rows:[rows[3]],view:'assessments',filters:{semester:'II',assessment:'testMark2'}});
 assert.equal(report.groups[0].rows[0].testMark2,'22');
 assert.equal(report.groups[0].rows[0].testMark1,undefined);
 assert.equal(report.groups[0].rows[0].assignmentMark,undefined);
 const sheets=Object.entries(unzipSync(exports.resultsXlsx(report))).filter(([name])=>name.startsWith('xl/worksheets/')).map(([,bytes])=>strFromU8(bytes)).join('');
 assert.match(sheets,/Test 2/);assert.doesNotMatch(sheets,/Test 1|Assignment/);
});
