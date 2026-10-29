import test from 'node:test';
import assert from 'node:assert/strict';
import {feedbackPayload} from '../src/components/app-feedback.js';

test('feedback payload includes only the authored text and optional rating',()=>{
 assert.deepEqual(feedbackPayload({category:'idea',subject:'  Improve events  ',message:'  Keep the filters\nvisible on mobile.  ',rating:'4',studentId:'PRIVATE',records:[1],owner:'other'}),{category:'idea',subject:'Improve events',message:'Keep the filters\nvisible on mobile.',rating:4});
 assert.deepEqual(feedbackPayload({category:'experience',subject:'My experience',message:'Useful app',rating:''}),{category:'experience',subject:'My experience',message:'Useful app'});
});
test('feedback rejects empty and oversized submissions without silently truncating',()=>{
 const base={category:'bug',subject:'Problem',message:'Details'};
 for(const changes of [{subject:'  '},{message:'\n '},{subject:'a'.repeat(121)},{message:'a'.repeat(3001)}])assert.throws(()=>feedbackPayload({...base,...changes}));
 assert.equal(feedbackPayload({...base,subject:'a'.repeat(120),message:'a'.repeat(3000)}).message.length,3000);
});
test('feedback rejects unsupported categories and nonintegral or out-of-range ratings',()=>{
 const base={category:'bug',subject:'Problem',message:'Details'};
 assert.throws(()=>feedbackPayload({...base,category:'admin'}));
 for(const rating of [0,6,1.5,'invalid'])assert.throws(()=>feedbackPayload({...base,rating}));
});
