import test from 'node:test';
import assert from 'node:assert/strict';
import {overallResultOverview} from '../src/lib/academic-results.js';

const rows=[
 {courseCode:'A',semester:'I',credits:4,gradePoints:9},
 {courseCode:'B',semester:'I',credits:2,gradePoints:8},
 {courseCode:'C',semester:'II',credits:4,gradePoints:10},
];

test('overall overview weights every source course and keeps every semester independent of detail filters',()=>{
 const overview=overallResultOverview(rows);
 assert.equal(overview.cgpa,9.2);
 assert.equal(overview.cgpaSource,'calculated');
 assert.equal(overview.percentage,null,'no university percentage conversion may be guessed');
 assert.deepEqual(overview.points.map(point=>point.label),['Semester I','Semester II']);
 assert.deepEqual(overview.points.map(point=>point.value),[52/6,10]);
});

test('published overall values take precedence; incomplete or repeated records cannot become calculated CGPA',()=>{
 const published=overallResultOverview(rows,[{label:'CGPA',value:'8.70'},{label:'Overall percentage',value:'82.40%'}]);
 assert.equal(published.cgpa,8.7);assert.equal(published.cgpaSource,'published');assert.equal(published.percentage,82.4);
 for(const invalid of [[...rows,{courseCode:'D',credits:4}],[...rows,{...rows[0],semester:'III',gradePoints:10}]]){
  const overview=overallResultOverview(invalid);
  assert.equal(overview.cgpa,null);assert.equal(overview.cgpaSource,'unavailable');assert.equal(overview.percentage,null);
 }
});
