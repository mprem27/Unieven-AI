import test from 'node:test';
import assert from 'node:assert/strict';
import {academicIssueSummary,syncMutationFeedback} from '../src/lib/sync-feedback.js';
test('partial sync stays visibly incomplete without repeating raw source diagnostics',()=>{
 const result=syncMutationFeedback({partial:true,errors:Array(5).fill('no supported labeled rows')},'All updated');
 assert.equal(result.type,'error');assert.match(result.text,/unavailable/);assert.doesNotMatch(result.text,/All updated|labeled rows/);
});
test('a failed academic section is named once and successful status remains distinct',()=>{
 assert.equal(academicIssueSummary({}), '');assert.match(academicIssueSummary({summary:'private diagnostic',records:'private diagnostic'}),/attendance totals, attendance dates/);
 assert.doesNotMatch(academicIssueSummary({summary:'private diagnostic'}),/private diagnostic/);
 assert.deepEqual(syncMutationFeedback({partial:false},'Synced'),{text:'Synced',type:'success'});
});
