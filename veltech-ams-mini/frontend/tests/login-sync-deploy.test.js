import test from 'node:test';
import assert from 'node:assert/strict';
import axios from 'axios';
import {request,setApiOwner} from '../src/lib/api.js';
import * as workspace from '../src/lib/workspace-loader.js';
import * as syncFeedback from '../src/lib/sync-feedback.js';

test('saved-session validation is bounded and does not retry into a long startup gate',async()=>{
 const previous=axios.defaults.adapter;let calls=0;const timeouts=[];
 axios.defaults.adapter=async config=>{timeouts.push(config.timeout);if(++calls===1)throw Object.assign(new Error('timeout of 10000ms exceeded'),{code:'ECONNABORTED'});return {data:{user:{id:'owner'}},status:200,headers:{},config};};
 try{await assert.rejects(request('/session'),error=>error.code==='REQUEST_TIMEOUT');assert.equal(calls,1);assert.ok(timeouts.every(value=>value>0 && value<=6000));}
 finally{axios.defaults.adapter=previous;setApiOwner('');}
});
test('persistent timeouts give an actionable message instead of a raw Axios duration',async()=>{
 const previous=axios.defaults.adapter;let calls=0;
 axios.defaults.adapter=async()=>{calls++;throw Object.assign(new Error('timeout of 10000ms exceeded'),{code:'ECONNABORTED'});};
 try{await assert.rejects(request('/session'),error=>error.code==='REQUEST_TIMEOUT' && !/10000|exceeded/.test(error.message) && /try again|retry/i.test(error.message));assert.equal(calls,1);}
 finally{axios.defaults.adapter=previous;}
});
test('credential and CAPTCHA POSTs are never automatically resubmitted',async()=>{
 const previous=axios.defaults.adapter;let calls=0;
 axios.defaults.adapter=async()=>{calls++;throw Object.assign(new Error('timeout of 10000ms exceeded'),{code:'ECONNABORTED'});};
 try{await assert.rejects(request('/portal/sign-in',{method:'POST',body:{identity:'fixture',answer:'manual'}}));assert.equal(calls,1);}
 finally{axios.defaults.adapter=previous;}
});
test('overlapping first-load and sync-poll reads share only the same in-flight owner request',async()=>{
 assert.equal(typeof workspace.createWorkspaceReader,'function','Owner reads must be coalesced without sharing accounts');
 const releases=[];let calls=0;
 const read=workspace.createWorkspaceReader(()=>{calls++;return new Promise(resolve=>releases.push(resolve));});
 const first=read('owner-a'),same=read('owner-a'),other=read('owner-b');
 assert.equal(first,same);assert.notEqual(first,other);
 await new Promise(resolve=>setImmediate(resolve));assert.equal(calls,2);
 releases[0]({owner:'a'});releases[1]({owner:'b'});
 assert.deepEqual(await first,{owner:'a'});assert.deepEqual(await other,{owner:'b'});
 const next=read('owner-a');await new Promise(resolve=>setImmediate(resolve));assert.equal(calls,3);releases[2]({owner:'fresh'});assert.deepEqual(await next,{owner:'fresh'});
});
test('the welcome may open main records before optional sections finish without claiming sync completion',()=>{
 assert.equal(typeof syncFeedback.welcomeSyncProgress,'function');
 const modules=['profile','timetable','attendance','courses','results','credits','examinations','fees','documents'].map(id=>({id,state:['profile','timetable','attendance','courses'].includes(id)?'available':'unavailable'}));
 const progress=syncFeedback.welcomeSyncProgress({state:'syncing',modules});
 assert.equal(progress.available,4);assert.equal(progress.total,9);assert.equal(progress.enoughReady,true);assert.equal(progress.finished,false);
});
test('retained or unsupported source sections are not counted as updated',()=>{
 assert.equal(typeof syncFeedback.welcomeSyncProgress,'function');
 const progress=syncFeedback.welcomeSyncProgress({state:'partial',modules:[{id:'profile',state:'available',retained:true},{id:'fees',state:'unsupported'},{id:'attendance',state:'available'}]});
 assert.equal(progress.available,1);assert.equal(progress.finished,true);assert.equal(progress.partial,true);
});
