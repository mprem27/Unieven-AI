import test from 'node:test';
import assert from 'node:assert/strict';
const nav=await import('../src/lib/student-navigation.js').catch(()=>({}));
test('academic entry opens the overview while every existing section stays addressable',()=>{
 assert.equal(typeof nav.academicSection,'function');
 for(const id of ['courses','results','marks','credits','examinations','fees','documents','rules'])assert.equal(nav.academicSection(id),id);
 assert.equal(nav.academicSection(''),'overview');assert.equal(nav.academicSection('untrusted-section'),'overview');
});
test('legacy assessment and course destinations resolve to their canonical academic pages',()=>{
 assert.equal(typeof nav.academicHref,'function');
 assert.equal(nav.academicHref('assessment'),'\/academics?section=marks');
 assert.equal(nav.academicHref('course-registration'),'\/academics?section=courses');
 assert.equal(nav.academicHref('overview'),'\/academics');
});
