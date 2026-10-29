import test from 'node:test';
import assert from 'node:assert/strict';
const summary=await import('../src/lib/academic-summary.js').catch(()=>({}));
const input={results:[{courseCode:'A',semester:'I',grade:'A',credits:4}],studentProfile:{officialProfile:{degree:'B.Tech',batch:'2025-2029'}},mode:'connected'};

test('the shared summary keeps source calculations apart from the labelled 10-point estimate',()=>{
 assert.equal(typeof summary.academicSummary,'function');
 const value=summary.academicSummary(input);
 assert.equal(value.overall.cgpa,9);
 assert.equal(value.estimatedPoints,true);
 assert.equal(value.sourcePrepared.grades[0].gradePoints,undefined);
 assert.equal(value.prepared.grades[0].gradePointSource,'calculation');
 assert.equal(value.percentage.source,'project-rule');
 assert.equal(value.percentage.value,85);
});

test('published numeric values win over source scales, verified regulations and project estimates',()=>{
 assert.equal(typeof summary.academicSummary,'function');
 const value=summary.academicSummary({...input,results:[{...input.results[0],gradePoints:7}],gradeScale:[{grade:'A',points:8}],creditSummary:[{label:'CGPA',value:'8.43'},{label:'Overall Percentage',value:'77.2%'}]});
 assert.equal(value.prepared.grades[0].gradePoints,7);
 assert.equal(value.overall.cgpa,8.43);assert.equal(value.overall.cgpaSource,'published');
 assert.equal(value.percentage.value,77.2);assert.equal(value.percentage.source,'published');
});

test('unofficial credits and editable profile regulation cannot choose a connected-account scale',()=>{
 assert.equal(typeof summary.academicSummary,'function');
 const value=summary.academicSummary({...input,results:[{courseCode:'A',grade:'A'}],credits:[{courseCode:'A',credits:4,source:'manual'}],studentProfile:{degree:'B.Tech',regulation:'UGE2025',officialProfile:{degree:'B.Tech',batch:'2025-2029'}}});
 assert.equal(value.prepared.grades[0].gradePoints,9,'no regulation inferred from admission batch or editable profile');
 assert.equal(value.overall.cgpa,null);
});

test('verified regulation grades are distinct from estimates and cannot replace even invalid source scale entries',()=>{
 const official={officialProfile:{degree:'B.Tech',regulation:'UGE2025'}};
 const documented=summary.academicSummary({...input,studentProfile:official});
 assert.equal(documented.prepared.grades[0].gradePoints,8);
 assert.equal(documented.prepared.grades[0].gradePointSource,'official-regulation');
 assert.equal(documented.estimatedPoints,false);
 const conflicting=summary.academicSummary({...input,studentProfile:official,gradeScale:[{grade:'A',points:'unknown'}]});
 assert.equal(conflicting.prepared.grades[0].gradePoints,undefined,'an unresolved source scale must not be overwritten');
 assert.equal(conflicting.overall.cgpa,null);
});
