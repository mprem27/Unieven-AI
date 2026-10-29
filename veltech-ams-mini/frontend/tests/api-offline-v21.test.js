import test from 'node:test';
import assert from 'node:assert/strict';
import axios from 'axios';
import * as api from '../src/lib/api.js';
import * as cache from '../src/lib/workspace-cache.js';
import {indexedDB} from 'fake-indexeddb';
import {browserFixture} from './helpers/jsx.js';
test('read-only snapshots and offline state cannot authorize mutations',async()=>{
 assert.equal(typeof api.setApiReadOnly,'function');const browser=browserFixture(),adapter=axios.defaults.adapter;let calls=0;
 axios.defaults.adapter=async config=>{calls++;return {data:{ok:true},status:200,headers:{},config};};
 try{api.setApiReadOnly(true);await assert.rejects(api.request('/feed',{method:'POST',body:{text:'test'}}),/read.only|connect/i);assert.equal(calls,0);api.setApiReadOnly(false);navigator.onLine=false;await assert.rejects(api.request('/events/test/register',{method:'POST',body:{}}),/offline|connect/i);assert.equal(calls,0);}finally{api.setApiReadOnly(false);browser.restore();axios.defaults.adapter=adapter;}
});
test('a definitive protected 401 clears encrypted data before notifying the workspace',async()=>{
 const browser=browserFixture(),adapter=axios.defaults.adapter;globalThis.indexedDB=indexedDB;let revoked=false;
 try{
  await cache.rememberVerifiedWorkspace('a',{profile:{id:'a',accountRole:'student'},subjects:[{name:'PRIVATE'}]});api.setApiOwner('a');
  browser.window.addEventListener('campus:session-revoked',()=>{revoked=true;});
  axios.defaults.adapter=async()=>{throw {response:{status:401,data:{message:'Expired'}}};};
  await assert.rejects(api.request('/academics/faculty-exams'),error=>error.status===401);assert.equal(revoked,true);assert.equal(await cache.readRememberedWorkspace(),null);
 }finally{await cache.clearWorkspaceCache();api.setApiOwner('');browser.restore();axios.defaults.adapter=adapter;delete globalThis.indexedDB;}
});
