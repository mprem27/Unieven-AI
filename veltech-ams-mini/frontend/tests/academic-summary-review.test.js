import test from 'node:test';import assert from 'node:assert/strict';
import {academicSummary} from '../src/lib/academic-summary.js';
import {workspaceSnapshot} from '../src/lib/workspace-cache.js';
import {act,create} from 'react-test-renderer';import React from 'react';
import {loadJsx,moduleUrl,browserFixture} from './helpers/jsx.js';
globalThis.IS_REACT_ACT_ENVIRONMENT=true;
const official={degree:'B.Tech',branch:'CSE',regulation:'UGE2025',batch:'2025-2029',vtuNumber:'VTU10000'};
const input={results:[{source:'ams',courseCode:'C',semester:'I',grade:'A',credits:4}],studentProfile:{id:'u',officialProfile:official},mode:'connected',accountKey:'u'};
const policy={scopeVersion:2,batch:'2025-2029',programme:'B.Tech',regulation:'UGE2025',departmentScope:'all',department:'',factor:9,offset:0,sourceUrl:'https://www.veltech.edu.in/fixture.pdf',sourceClause:'Fixture conflicting rule',verifiedAt:'2026-10-29'};
test('official programme, branch and verified principal survive snapshot without changing numeric academic meaning',()=>{
 const before=academicSummary(input);const saved=workspaceSnapshot({profile:input.studentProfile,academic:{results:input.results}},'u');
 assert.equal(saved.profile.officialProfile.degree,'B.Tech');assert.equal(saved.profile.officialProfile.branch,'CSE');assert.equal(saved.profile.officialProfile.vtuNumber,'VTU10000');
 const after=academicSummary({...input,studentProfile:saved.profile,results:saved.academic.results});assert.equal(before.overall.cgpa,8);assert.equal(after.overall.cgpa,before.overall.cgpa);assert.equal(after.percentage.value,before.percentage.value);
});
test('unknown administrator policy availability withholds derived conversion but retains published percentages',()=>{
 for(const policyStatus of ['loading','unavailable']){const s=academicSummary({...input,policyStatus});assert.equal(s.percentage.value,null);assert.equal(s.percentage.source,'unavailable');assert.equal(s.overall.cgpa,8);}
 const s=academicSummary({...input,policyStatus:'unavailable',creditSummary:[{label:'Overall percentage',value:'79'}]});assert.equal(s.percentage.value,79);assert.equal(s.percentage.source,'published');
});
test('known non-credit grades cannot fall through a project scale or complete a contradictory credited average',()=>{
 for(const [grade,scheme] of [['P','ugc'],['F','sab']]){
  const s=academicSummary({...input,calculation:{scheme},results:[...input.results,{source:'ams',courseCode:'N',semester:'I',grade,credits:1}]});
  assert.equal(s.prepared.grades[1].gradePoints,undefined);assert.equal(s.overall.cgpa,null);assert.equal(s.creditConflict,true);
 }
 const numeric=academicSummary({...input,results:[...input.results,{source:'ams',courseCode:'N',semester:'I',grade:'P',credits:1,gradePoints:4}]});assert.equal(numeric.prepared.grades[1].gradePoints,4,'original source numeric value is retained');assert.equal(numeric.overall.cgpa,null,'contradictory credit classification is not averaged');
 const published=academicSummary({...input,results:[...input.results,{source:'ams',courseCode:'N',grade:'F',credits:1}],creditSummary:[{label:'CGPA',value:'8.5'}]});assert.equal(published.overall.cgpa,8.5);assert.equal(published.overall.cgpaSource,'published');
 const zero=academicSummary({...input,results:[...input.results,{source:'ams',courseCode:'N',grade:'P',credits:0}]});assert.equal(zero.overall.cgpa,8);assert.equal(zero.creditConflict,false);
});
const {default:useSummary}=await loadJsx(new URL('../src/hooks/useAcademicSummary.js',import.meta.url),{'../lib/api':moduleUrl('export const request=(...args)=>globalThis.__policyRead(...args)')});
test('hook distinguishes a successful empty policy list from unavailable remount and malformed response',async()=>{
 const env=browserFixture();let view,latest,pending;
 function Probe(){latest=useSummary(input);return React.createElement('span',null,String(latest.percentage.value));}
 async function mount(){await act(async()=>{view=create(React.createElement(Probe));});}
 try{
  globalThis.__policyRead=()=>new Promise((resolve,reject)=>pending={resolve,reject});await mount();assert.equal(latest.percentage.value,null,'initial pending policies do not mean no policies');await act(async()=>pending.resolve({rules:[policy]}));assert.equal(latest.percentage.value,null);assert.equal(latest.percentage.status,'ambiguous');
  await act(async()=>view.unmount());await mount();await act(async()=>pending.reject(new Error('Network unavailable')));assert.equal(latest.percentage.value,null);assert.equal(latest.policyStatus,'unavailable');
  await act(async()=>view.unmount());await mount();await act(async()=>pending.resolve([]));assert.equal(latest.percentage.value,null,'malformed response must not become empty catalogue');assert.equal(latest.policyStatus,'unavailable');
  await act(async()=>view.unmount());await mount();await act(async()=>pending.resolve({rules:[]}));assert.equal(latest.percentage.value,80);assert.equal(latest.policyStatus,'available');
 }finally{await act(async()=>view?.unmount());delete globalThis.__policyRead;env.restore();}
});
test('an offline summary does not query policy metadata and reconnect checks it again',async()=>{
 const env=browserFixture();navigator.onLine=false;let view,latest,calls=0;
 function Probe(){latest=useSummary(input);return React.createElement('span',null,String(latest.percentage.value));}
 try{globalThis.__policyRead=async()=>{calls++;return {rules:[]};};await act(async()=>{view=create(React.createElement(Probe));});assert.equal(calls,0);assert.equal(latest.policyStatus,'unavailable');navigator.onLine=true;await act(async()=>view.update(React.createElement(Probe)));assert.equal(calls,1);assert.equal(latest.percentage.value,80);}finally{await act(async()=>view?.unmount());delete globalThis.__policyRead;env.restore();}
});
test('legacy snapshots missing programme cannot reinterpret a known regulation through a project grade scale',()=>{
 const legacy={...input,studentProfile:{id:'u',officialProfile:{regulation:'UGE2025',batch:'2025-2029'}}};const value=academicSummary(legacy);assert.equal(value.overall.cgpa,null);assert.equal(value.prepared.grades[0].gradePoints,undefined);assert.equal(value.contextIncomplete,true);
 const published=academicSummary({...legacy,creditSummary:[{label:'CGPA',value:'8.1'}]});assert.equal(published.overall.cgpa,8.1);assert.equal(published.overall.cgpaSource,'published');
});
test('official programme names with an explicit department suffix still identify the degree without inventing dual-degree scope',async()=>{
 const {normalizeProgramme,officialGradeScale}=await import('../../shared/percentage-rules.mjs');
 for(const degree of ['B.Tech (Computer Science & Engineering)','Bachelor of Technology - Information Technology']){assert.equal(normalizeProgramme(degree),'btech');assert.equal(academicSummary({...input,studentProfile:{officialProfile:{...official,degree}}}).prepared.grades[0].gradePoints,8);}
 assert.notEqual(normalizeProgramme('B.Technique'),'btech');assert.deepEqual(officialGradeScale({...official,degree:'B.Tech + M.Tech (Dual Degree)'}),[]);
});
