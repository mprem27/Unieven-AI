import test from 'node:test';
import assert from 'node:assert/strict';
import {weightedGpa,semesterGpas,percentageEstimate,resultGradePoints} from '../src/lib/gpa.js';
test('GPA uses course-credit weights and semester totals rather than averaging GPAs',()=>{
 const rows=[{semester:1,credits:4,gradePoints:9},{semester:1,credits:2,gradePoints:6},{semester:2,credits:2,gradePoints:10}];
 assert.equal(weightedGpa(rows).value,8.5);assert.equal(semesterGpas(rows)[0].value,8);assert.equal(semesterGpas(rows)[1].value,10);assert.equal(weightedGpa(rows).complete,true);
});
test('missing numeric points, aggregate GPA rows, zero credits and malformed inputs never fabricate a CGPA',()=>{
 const total=weightedGpa([{credits:4,grade:'A',gpa:9,cgpa:9},{credits:0,gradePoints:9},{credits:null,gradePoints:8},{credits:'3 credits',gradePoints:8},{credits:2,gradePoints:0}]);
 assert.equal(total.value,0);assert.equal(total.included,1);assert.equal(total.excluded,4);assert.equal(total.complete,false);assert.equal(weightedGpa([]).value,null);
 assert.equal(resultGradePoints({grade:'A+'}),null);assert.equal(resultGradePoints({gradePoints:''}),null);assert.equal(resultGradePoints({gradePoint:'8.5'}),8.5);
});
test('percentage requires an explicit valid user factor and stays within percentage range',()=>{
 assert.equal(percentageEstimate(8.5,''),null);assert.equal(percentageEstimate(8.5,'9.5'),80.75);assert.equal(percentageEstimate(0,10),0);assert.equal(percentageEstimate(11,10),null);assert.equal(percentageEstimate(-1,10),null);assert.equal(percentageEstimate(8,0),null);assert.equal(percentageEstimate('A',9.5),null);
});
test('requested CGPA offset formula gives 79 percent for 8.4 and rejects negative or oversized percentages',()=>{
 assert.equal(percentageEstimate(8.4,10,0.5),79);
 assert.equal(percentageEstimate('8.5',10,0.5),80);
 assert.equal(percentageEstimate(0.5,10,0.5),0);
 assert.equal(percentageEstimate(0.2,10,0.5),null);
 assert.equal(percentageEstimate('',10,0.5),null);
 assert.equal(percentageEstimate(11,10,0.5),null);
});
test('source repeat attempts are excluded rather than counted twice or choosing an unofficial grade',()=>{
 const total=weightedGpa([{courseCode:'CS101',credits:3,gradePoints:5,resultType:'Regular'},{courseCode:'CS101',credits:3,gradePoints:8,resultType:'Arrear'},{courseCode:'CS102',credits:2,gradePoints:9}]);
 assert.equal(total.value,9);assert.equal(total.excluded,2);assert.equal(total.complete,false);
});
