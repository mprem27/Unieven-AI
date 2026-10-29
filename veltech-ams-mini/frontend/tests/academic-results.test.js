import test from 'node:test';
import assert from 'node:assert/strict';
import {prepareResults,resultSemesters,resultMetrics,resultReportGroups,resultTrend,creditReportSections,creditColumnLabel} from '../src/lib/academic-results.js';
test('final grades and assessment reports remain separate and source semester labels survive',()=>{
 const data=prepareResults([{courseCode:'CS101',semester:'II',grade:'A',resultType:'Regular'},{courseCode:'CS101',semester:'SS2526',testMark1:'20',resultType:'Test marks'}],[],[]);
 assert.equal(data.grades.length,1);assert.equal(data.assessments.length,1);assert.deepEqual(resultSemesters(data.grades),['II']);
});
test('GPA uses explicitly sourced credits and grade definitions, without a built-in university conversion',()=>{
 const grades=[{courseCode:'CS101',semester:'II',grade:'A',resultType:'Regular'},{courseCode:'CS102',semester:'II',grade:'B',resultType:'Regular'}];
 const credits=[{courseCode:'CS101',semester:'II',credits:'4'},{courseCode:'CS102',semester:'II',credits:'2'}];
 const data=prepareResults(grades,credits,[{grade:'A',points:9},{grade:'B',points:8}]);
 assert.equal(resultMetrics(data.grades).value,52/6);assert.equal(resultMetrics(prepareResults(grades,credits,[]).grades).value,null);
});
test('conflicting credit definitions and repeated course attempts cannot fabricate a CGPA',()=>{
 const grades=[{courseCode:'CS101',semester:'II',grade:'A'},{courseCode:'CS101',semester:'II',grade:'B'}];
 const data=prepareResults(grades,[{courseCode:'CS101',credits:'3'},{courseCode:'CS101',credits:'4'}],[{grade:'A',points:9}]);
 assert.equal(resultMetrics(data.grades).complete,false);assert.equal(resultMetrics(data.grades).value,null);
});
test('report groups preserve report, source semester and examination session without mixing assessments',()=>{
 const rows=[{courseCode:'CS101',semester:'II',resultType:'Regular',examinationSession:'May 2026',grade:'A'},{courseCode:'CS102',semester:'I',resultType:'Regular',examinationSession:'Nov 2025',grade:'B'},{courseCode:'CS101',semester:'II',resultType:'Arrear',examinationSession:'May 2026',grade:'B'},{courseCode:'CS101',semester:'SS2526',resultType:'Final internal',internalMark:'35'}];
 const prepared=prepareResults(rows),groups=resultReportGroups(prepared.grades);
 assert.equal(groups.length,3);assert.deepEqual(groups.map(group=>[group.report,group.semester,group.session]),[['Regular','I','Nov 2025'],['Regular','II','May 2026'],['Arrear','II','May 2026']]);
 assert.equal(resultReportGroups(prepared.assessments)[0].semester,'SS2526');
});
test('numeric trend uses only selected source rows and leaves incomplete semesters as gaps',()=>{
 const rows=[{courseCode:'CS101',semester:'I',grade:'A',credits:4,gradePoints:9},{courseCode:'CS102',semester:'I',grade:'B',credits:2,gradePoints:6},{courseCode:'CS201',semester:'II',grade:'A',credits:4},{courseCode:'CS301',semester:'III',grade:'S',credits:2,gradePoints:10}];
 const trend=resultTrend(rows);
 assert.deepEqual(trend.map(point=>point.value),[8,null,10]);
 assert.deepEqual(resultTrend(rows.filter(row=>row.semester==='III')).map(point=>point.value),[10]);
 assert.deepEqual(resultTrend([{semester:'I',grade:'A'}]).map(point=>point.value),[null]);
 assert.equal(resultTrend([{courseCode:'CS101',grade:'A',gradePoints:'',credits:4}],'I')[0].value,null);
 assert.deepEqual(resultTrend([{courseCode:'CS101',semester:'I',grade:'A',credits:4,gradePoints:9},{courseCode:'CS101',semester:'II',grade:'B',credits:4,gradePoints:8}]).map(point=>point.value),[null,null]);
});
test('credit course ledger, category summaries and semester summaries never share a section or calculated total',()=>{
 const rows=[{courseCode:'CS101',semester:'I',credits:'4',earnedCredits:'4'},{category:'Core',earnedCredits:'28',requiredCredits:'40'},{semester:'I',earnedCredits:'20',rowType:'semester'},{label:'Total credits',earnedCredits:'48',rowType:'summary'},{courseCode:'CS102',semester:'II',category:'Core',credits:'3'}];
 const groups=creditReportSections(rows);
 assert.deepEqual(groups.map(group=>group.kind),['course','course','category','semester','summary']);
 assert.deepEqual(groups.filter(group=>group.kind==='course').map(group=>group.rows.length),[1,1]);
 assert.equal(groups.find(group=>group.kind==='category').rows[0].earnedCredits,'28');
 assert.equal(groups.reduce((count,group)=>count+group.rows.length,0),rows.length);
 assert.equal(Object.hasOwn(groups[0],'total'),false);
});
test('credit headings use exact source labels only when the section agrees on the label',()=>{
 const rows=[{sourceColumns:{credits:'Credit Registered'}},{sourceColumns:{credits:'Credit Registered'}}];
 assert.equal(creditColumnLabel('credits',rows),'Credit Registered');
 assert.equal(creditColumnLabel('credits',[...rows,{sourceColumns:{credits:'Course Credits'}}]),'Credits');
 assert.equal(creditColumnLabel('earnedCredits',[{}]),'Credits earned');
});
