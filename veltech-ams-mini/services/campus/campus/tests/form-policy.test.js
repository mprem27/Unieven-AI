import test from 'node:test';
import assert from 'node:assert/strict';
import {validateForm,validateAnswers,verifyLocation,canViewForm,canManageForm,canCreateForm,canSubmitForm} from '../services/form-policy.js';
const base=()=>({title:'Workshop feedback',scope:'department',department:'CSE',state:'published',fields:[{id:'rating',label:'Session rating',type:'select',required:true,choices:['Great','Good']}]});
test('forms validate field types, duplicate identifiers, required choices and bounded payloads',()=>{
 assert.equal(validateForm(base()).fields[0].id,'rating');
 for(const fields of [[{id:'a',label:'A',type:'script'}],[{id:'a',label:'A',type:'select',choices:[]}],Array.from({length:31},(_,i)=>({id:'f'+i,label:'A',type:'text'})),[{id:'a',label:'A',type:'text'},{id:'a',label:'B',type:'text'}]])assert.throws(()=>validateForm({...base(),fields}),e=>e.status===400);
 assert.throws(()=>validateForm({...base(),opensAt:'2026-01-02',closesAt:'2026-01-01'}),e=>e.status===400);
 assert.throws(()=>validateForm({...base(),geofence:{latitude:91,longitude:80,radiusMeters:100}}),e=>e.status===400);
 assert.throws(()=>validateForm({...base(),geofence:{latitude:13,longitude:80,radiusMeters:100}}),e=>e.status===400);
});
test('answer validation rejects undeclared fields, missing required answers and forged choices',()=>{
 const fields=validateForm(base()).fields;
 assert.deepEqual(validateAnswers(fields,{rating:'Great'}),{rating:'Great'});
 for(const answers of [{},{rating:'Other'},{rating:'Great',injected:'value'},{rating:['Great']}])assert.throws(()=>validateAnswers(fields,answers),e=>e.status===400);
 const other=[{id:'email',type:'email',required:true,label:'Email'},{id:'score',type:'number',required:true,label:'Score'},{id:'options',type:'checkbox',required:true,label:'Options',choices:['A','B']}];
 assert.deepEqual(validateAnswers(other,{email:'a@example.edu',score:0,options:['A']}),{email:'a@example.edu',score:0,options:['A']});
 assert.throws(()=>validateAnswers(other,{email:'broken',score:0,options:['A']}),e=>e.status===400);
});
test('server location rejects stale, inaccurate, out-of-radius and nonnumeric readings',()=>{
 const fence={latitude:13,longitude:80,radiusMeters:100},now=Date.now(),valid={latitude:13,longitude:80,accuracy:10,capturedAt:now};
 assert.equal(verifyLocation(fence,valid,now).distanceMeters,0);
 for(const reading of [{...valid,capturedAt:now-120001},{...valid,capturedAt:now+11000},{...valid,accuracy:101},{...valid,latitude:13.01},{...valid,latitude:'13'}])assert.throws(()=>verifyLocation(fence,reading,now),e=>e.status===400);
});
test('form authority requires faculty account role, department scope and draft privacy',()=>{
 const form={...base(),createdBy:'owner'},student={_id:'student',department:'CSE',campusRole:'student'},faculty={_id:'faculty',role:'faculty',department:'CSE',campusRole:'student'};
 assert.equal(canViewForm(student,form),true);assert.equal(canManageForm(student,form),false);assert.equal(canManageForm(faculty,form),true);
 assert.equal(canManageForm({...faculty,department:'ECE'},form),false);assert.equal(canViewForm({...student,department:'ECE'},form),false);assert.equal(canViewForm(student,{...form,state:'draft'}),false);
 assert.equal(canManageForm({_id:'owner',role:'faculty',campusRole:'student',department:'CSE'},form),true);
 assert.equal(canManageForm({_id:'owner',role:'student',campusRole:'student',department:'CSE'},form),false);
 for(const role of ['club_organizer','department_coordinator','college_event_manager','admin']){assert.equal(canCreateForm({...student,role:'student',campusRole:role},form),false);assert.equal(canSubmitForm({...student,role:'student',campusRole:role}),true);}
 assert.equal(canCreateForm({...student,role:'admin'},form),true);
 assert.equal(canCreateForm(faculty,{...form,scope:'college'}),false);
 assert.equal(canCreateForm({...faculty,accountRole:'faculty',role:undefined},form),true);
 assert.equal(canSubmitForm({...faculty,accountRole:'faculty',role:undefined}),false);
});
