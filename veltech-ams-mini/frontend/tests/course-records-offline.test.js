import test from 'node:test';import assert from 'node:assert/strict';
const courses=await import('../src/lib/course-records.js').catch(()=>({}));
test('saved registration retains only university course rows and their original timestamp',()=>{
 assert.equal(typeof courses.savedCourseRegistration,'function');
 const a={updatedAt:'2026-10-15T10:00:00Z',courses:[{code:'CS1',source:'ams'},{code:'OTHER',source:'student-import'},{code:'UNKNOWN'}]};
 const s=courses.savedCourseRegistration(a);assert.deepEqual(s.registeredCourses,[{code:'CS1',source:'ams'}]);assert.equal(s.updatedAt,a.updatedAt);assert.equal(s.saved,true);
});
test('saved registered records never become new offerings or an active registration window',()=>{
 const s=courses.savedCourseRegistration({courses:[{code:'CS1',source:'ams'}],offerings:[{code:'CS2'}],registrationWindow:{start:'2026-10-01'}});assert.deepEqual(s.offerings,[]);assert.equal(s.registrationWindow,undefined);assert.equal(s.submissionSupported,false);
});
test('unknown or absent source rows stay unavailable without fabricated sync dates',()=>{
 const s=courses.savedCourseRegistration({courses:[{code:'CS1',source:'student-import'}]});assert.equal(s.source,'unavailable');assert.deepEqual(s.registeredCourses,[]);assert.equal(s.updatedAt,undefined);
});
