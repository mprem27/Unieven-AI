import test from 'node:test';
import assert from 'node:assert/strict';
import {prepareResults,overallResultOverview} from '../src/lib/academic-results.js';

test('blank result fields use matching source credits and explicit ledger grade points',()=>{
 const prepared=prepareResults([{courseCode:' ab101 ',semester:'II',grade:'A',credits:'',gradePoints:''}],
  [{courseCode:'AB101',semester:'2',credits:'4',gradePoints:'9',grade:'A'}]);
 assert.equal(Number(prepared.grades[0].credits),4);
 assert.equal(Number(prepared.grades[0].gradePoints),9);
});

test('published GPA and latest cumulative values in AMS result rows are not ignored',()=>{
 const overview=overallResultOverview([
  {courseCode:'A',semester:'I',grade:'A',gpa:'8.20',cgpa:'8.20',overallPercentage:'82'},
  {courseCode:'B',semester:'II',grade:'A',gpa:'8.60',cgpa:'8.40',overallPercentage:'84'},
 ]);
 assert.equal(overview.cgpa,8.4);assert.equal(overview.cgpaSource,'published');assert.equal(overview.percentage,84);
 assert.deepEqual(overview.points.map(point=>point.value),[8.2,8.6]);
});

test('summary-only semesters can draw a graph without invented course grade points',()=>{
 const overview=overallResultOverview([], [{label:'SGPA',semester:'I',value:'8.4'},{label:'SGPA',semester:'II',value:'8.8'}, {label:'CGPA',value:'8.6'}]);
 assert.equal(overview.cgpa,8.6);assert.deepEqual(overview.points.map(point=>point.value),[8.4,8.8]);
});

test('requested percentage factor is calculated and labelled while published percentage takes precedence',()=>{
 const rows=[{courseCode:'A',semester:'I',credits:4,gradePoints:9}];
 const estimated=overallResultOverview(rows,[],{percentageFactor:10});
 assert.equal(estimated.percentage,90);assert.equal(estimated.percentageSource,'calculated');
 const published=overallResultOverview(rows,[{label:'Percentage',value:82}],{percentageFactor:10});
 assert.equal(published.percentage,82);assert.equal(published.percentageSource,'published');
});

test('conflicting published semester GPA values leave a gap rather than choosing one',()=>{
 const overview=overallResultOverview([{semester:'I',grade:'A',gpa:8},{semester:'I',grade:'B',gpa:9}]);
 assert.equal(overview.points[0].value,null);
});

const calculation=await import('../src/lib/result-calculation.js').catch(()=>null);
test('selected ten-point calculation fills letter grades without changing AMS values',()=>{
 assert.equal(typeof calculation?.calculationScale,'function');
 const scale=calculation.calculationScale({scheme:'sab'});
 const rows=prepareResults([{courseCode:'A',semester:'I',grade:'A'}],[{courseCode:'A',credits:4}],[],scale).grades;
 assert.equal(rows[0].grade,'A');assert.equal(rows[0].gradePoints,9);assert.equal(rows[0].gradePointSource,'calculation');
 assert.equal(overallResultOverview(rows,[],{percentageFactor:10}).percentage,90);
 assert.equal(prepareResults([{grade:'A',gradePoints:8}],[],[],scale).grades[0].gradePoints,8);
 assert.equal(prepareResults([{grade:'WH'}],[],[],scale).grades[0].gradePoints,undefined);
});

test('calculation settings persist per account and reject unsupported values',()=>{
 assert.equal(typeof calculation?.saveCalculation,'function');
 const values=new Map(),storage={setItem:(k,v)=>values.set(k,v),getItem:k=>values.get(k) || null};
 calculation.saveCalculation('owner-a',{scheme:'ugc',percentageFactor:9.5},storage);
 assert.equal(calculation.readCalculation('owner-a',storage).scheme,'ugc');
 assert.equal(calculation.readCalculation('owner-b',storage).scheme,'sab');
 assert.throws(()=>calculation.saveCalculation('owner-a',{scheme:'unknown',percentageFactor:10},storage));
 assert.throws(()=>calculation.saveCalculation('owner-a',{scheme:'sab',percentageFactor:-1},storage));
});

test('overall stock-style CGPA line uses cumulative credit weights, not semester GPA averages',()=>{
 const overview=overallResultOverview([{courseCode:'A',semester:'I',credits:4,gradePoints:8},{courseCode:'B',semester:'II',credits:2,gradePoints:10}],[],{percentageFactor:10});
 assert.deepEqual(overview.cgpaPoints.map(point=>point.value),[8,52/6]);
});

test('identical report copies and zero-credit courses do not suppress a valid overall calculation',()=>{
 const row={courseCode:'A',semester:'I',credits:4,gradePoints:9};
 const overview=overallResultOverview([row,{...row,resultType:'Duplicate view'},{courseCode:'AUDIT',semester:'I',credits:0,grade:'P'}]);
 assert.equal(overview.cgpa,9);
});
