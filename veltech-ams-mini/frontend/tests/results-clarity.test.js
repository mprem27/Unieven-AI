import test from 'node:test';
import assert from 'node:assert/strict';
import * as results from '../src/lib/academic-results.js';

const rows=[
 {courseCode:'CS101',courseName:'Algorithms',semester:'II',resultType:'Internal marks',sourceReport:'AMS midterm',testMark1:'0',midTestMark1:'36',internalMark:'82'},
 {courseCode:'CS102',courseName:'Networks',semester:'II',resultType:'Internal marks',sourceReport:'AMS midterm',testMark1:'Absent',midTestMark1:'41',internalMark:'75'},
 {courseCode:'CS103',courseName:'Databases',semester:'III',resultType:'Internal marks',sourceReport:'AMS midterm',testMark1:'19',midTestMark1:'Not published',internalMark:'91'},
];

test('all-assessment graph offers separate raw-mark series without combining field scales',()=>{
 assert.equal(typeof results.resultAssessmentTrends,'function');
 const series=results.resultAssessmentTrends(rows);
 assert.deepEqual(series.map(line=>line.field),['testMark1','midTestMark1','internalMark']);
 assert.deepEqual(series.map(line=>line.points.map(point=>point.value)),[[0,null,19],[36,41,null],[82,75,91]]);
 for(const line of series){
  assert.equal(line.points.length,rows.length);
  assert.equal(line.unit,'Raw marks');
  assert.equal(Object.hasOwn(line,'maximum'),false,'source maxima must not be invented');
  assert.equal(Object.hasOwn(line,'percentage'),false,'raw marks must not become percentage');
 }
});

test('assessment graph labels identify the source course, semester and selected mark field',()=>{
 const point=results.resultTrend(rows,'all','midTestMark1')[0];
 assert.equal(point.label,'CS101');
 assert.equal(point.shortLabel,'CS101');
 assert.equal(point.contextLabel,'Sem II');
 assert.match(point.detail,/Algorithms/);
 assert.match(point.detail,/Semester II/);
 assert.match(point.detail,/Mid-test 1/);
 assert.match(point.detail,/AMS midterm/);
});

test('selected assessment graph has exactly the same filtered rows and retains absent gaps',()=>{
 const selected=results.filterResults(rows,{semester:'II',query:'CS10',assessment:'testMark1'});
 const graph=results.resultAssessmentTrends(selected).find(series=>series.field==='testMark1');
 assert.deepEqual(graph.points.map(point=>point.label),selected.map(row=>row.courseCode));
 assert.deepEqual(graph.points.map(point=>point.value),[0,null]);
 const subject=results.filterResults(rows,{semester:'II',query:'Networks',assessment:'midTestMark1'});
 assert.deepEqual(results.resultAssessmentTrends(subject).find(series=>series.field==='midTestMark1').points.map(point=>point.value),[41]);
});
