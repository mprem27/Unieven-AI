import test from 'node:test';
import assert from 'node:assert/strict';
import * as feedback from '../src/lib/sync-feedback.js';
test('partial sync data changes advance the snapshot key while unchanged polling does not',()=>{
 assert.equal(typeof feedback.syncProgressKey,'function');
 const source={state:'syncing',modules:[{id:'results',state:'available',recordCount:4,lastSuccessAt:'2026-10-19T10:00:00Z'}]};
 assert.equal(feedback.syncProgressKey(source),feedback.syncProgressKey(structuredClone(source)));
 for(const patch of [{recordCount:5},{lastSuccessAt:'2026-10-19T10:01:00Z'},{state:'error'}])assert.notEqual(feedback.syncProgressKey(source),feedback.syncProgressKey({...source,modules:[{...source.modules[0],...patch}]}));
 assert.notEqual(feedback.syncProgressKey(source),feedback.syncProgressKey({...source,state:'idle'}));
});
