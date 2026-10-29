import test from 'node:test';
import assert from 'node:assert/strict';
import {batchPercentage} from '../src/lib/batch-percentage.js';
const shared=await import('../../shared/percentage-rules.mjs').catch(()=>({}));
const profile={batch:'2023–2027',degree:'B.Tech',department:'Computer Science',regulation:'VTR UGE 2021'};
const policy={scopeVersion:2,batch:'2023-2027',programme:'B.Tech',departmentScope:'department',department:'CSE',factor:9,offset:0,regulation:'VTR UGE 2021',sourceUrl:'https://www.veltech.edu.in/fixture.pdf',sourceClause:'Fictional test clause',verifiedAt:'2026-10-21'};
const calculate=(p=profile,policies=[],cgpa=8)=>batchPercentage({cgpa,percentage:null,percentageSource:'unavailable'},p,policies);

test('administrator rules require the stated programme, batch, regulation and department',()=>{
 assert.equal(calculate(profile,[policy]).value,72);
 assert.equal(calculate(profile,[policy]).source,'batch-rule');
 for(const changed of [{batch:'2024-2028'},{degree:'M.Tech'},{regulation:'VTR PGE 2023'},{department:'ECE'},{department:''},{regulation:''},{batch:''},{degree:''}]){
  const result=calculate({...profile,...changed},[policy]);assert.equal(result.value,75);assert.equal(result.source,'project-rule');
 }
});
test('only documented programme and explicit regulation select a catalogue formula',()=>{
 const p={...profile,batch:'unmapped',regulation:'VTR UGE - 2025'};
 const matched=calculate(p);assert.equal(matched.value,80);assert.equal(matched.source,'official-rule');assert.match(matched.rule.sourceClause,/25\.23\.3/);
 assert.equal(calculate({...p,degree:'M.Tech'}).source,'project-rule');
 assert.equal(calculate({...p,regulation:'2025'}).source,'project-rule');
 assert.equal(calculate({...p,regulation:'',batch:'2025-2029'}).source,'project-rule');
 assert.equal(calculate({...p,regulation:'Regulations 2013'},[],6.75).value,60.75);
 assert.equal(calculate({degree:'B.Com',regulation:'VTR UGAS 2026'}).value,80);
 assert.equal(calculate({...profile,regulation:'VTR UGAS 2026'}).source,'project-rule');
});
test('published finite percentages win including zero; malformed values cannot masquerade as published',()=>{
 for(const value of [0,77,100])assert.deepEqual(batchPercentage({cgpa:8,percentage:value,percentageSource:'published'},profile,[policy,{...policy,factor:10}]),{value,source:'published',rule:null});
 for(const value of [101,-1,NaN,Infinity,'77',null])assert.equal(batchPercentage({cgpa:8,percentage:value,percentageSource:'published'},profile,[]).source,'project-rule');
});
test('overlapping departments and duplicate rules block official and project fallback',()=>{
 for(const candidates of [[policy,{...policy,factor:10}],[policy,{...policy,departmentScope:'all',department:'',factor:9}]]){
  const result=calculate(profile,candidates);assert.equal(result.value,null);assert.equal(result.source,'unavailable');assert.equal(result.status,'ambiguous');
 }
 const p={...profile,regulation:'VTR UGE 2025'};
 const conflict=calculate(p,[{...policy,regulation:p.regulation,factor:9}]);assert.equal(conflict.value,null);assert.equal(conflict.status,'ambiguous');
 assert.equal(calculate(p,[{...policy,regulation:p.regulation,factor:10}]).value,80);
});
test('all-department rules are explicit and malformed matching rules block fallback',()=>{
 assert.equal(calculate({...profile,department:''},[{...policy,departmentScope:'all',department:''}]).value,72);
 for(const change of [{factor:'9'},{factor:NaN},{factor:0},{offset:null},{offset:'0'},{sourceUrl:'javascript:alert(1)'},{sourceClause:''},{departmentScope:'all',department:'CSE'},{departmentScope:'all',department:[]},{departmentScope:'all',department:null},{department:''},{departmentScope:'unknown'}]){
  const result=calculate(profile,[{...policy,...change}]);assert.equal(result.value,null,JSON.stringify(change));assert.equal(result.source,'unavailable');
 }
 for(const policies of [[],[{...policy,verifiedAt:null}],[null]])assert.equal(calculate(profile,policies).source,'project-rule');
 assert.equal(calculate(profile,{}).source,'unavailable');
});
test('legacy cohort rules remain labelled and never override a conflicting explicit regulation',()=>{
 const {scopeVersion,departmentScope,department,...legacy}=policy;
 assert.equal(calculate({...profile,regulation:''},[legacy]).source,'legacy-rule');
 assert.equal(calculate(profile,[legacy]).value,72);
 assert.equal(calculate({...profile,regulation:'VTR UGE 2025'},[legacy]).value,80);
 assert.equal(calculate({...profile,regulation:'Unknown regulation'},[legacy]).source,'project-rule');
 assert.equal(calculate(profile,[legacy,policy]).status,'ambiguous');
});
test('project estimate stays explicit, accepts genuine zero and rejects malformed CGPA',()=>{
 assert.equal(calculate().source,'project-rule');assert.equal(calculate().rule.regulation,'Project estimate');
 assert.equal(calculate(profile,[],8.4).value,79);assert.equal(calculate(profile,[],.5).value,0);
 assert.equal(calculate(profile,[{...policy,factor:10}],0).value,0);
 for(const value of [undefined,null,'8',NaN,Infinity,-1,11,.2])assert.equal(calculate(profile,[],value===undefined?null:value).value,null);
});
test('regulation grade scale changes meaning without inferring a cohort or guessing other programmes',()=>{
 assert.equal(typeof shared.officialGradeScale,'function');
 const old=shared.officialGradeScale(profile),current=shared.officialGradeScale({...profile,regulation:'VTR UGE2025'});
 assert.equal(old.find(row=>row.grade==='A').points,9);assert.equal(current.find(row=>row.grade==='A').points,8);assert.equal(current.find(row=>row.grade==='A+').points,9);
 assert.equal(current.some(row=>row.grade==='P'),false);
 assert.deepEqual(shared.officialGradeScale({...profile,regulation:''}),[]);assert.deepEqual(shared.officialGradeScale({...profile,degree:'M.Tech'}),[]);
});
test('academic rule context explains unknown conversion and exposes real clauses without a guessed batch',()=>{
 assert.equal(typeof shared.academicRuleContext,'function');
 const context=shared.academicRuleContext(profile);assert.equal(context.regulation.id,'btech-vtr-uge-2021');assert.equal(context.status,'unverified');assert.match(context.reason,/conversion.*unverified/i);
 assert.match(context.regulation.sourceUrl,/B\.Tech_\._Regulations_VTR_UGE2021_JUNE-2025\.pdf$/);
 assert.equal(shared.academicRuleContext({batch:'2025-2029',degree:'B.Tech'}).regulation,null);
});
