import test from 'node:test';
import assert from 'node:assert/strict';
import axios from 'axios';
import {request,setApiOwner} from '../src/lib/api.js';

test('overlapping private GET consumers share transport while cancellation stays local',async()=>{
 const previous=axios.defaults.adapter;let calls=0,release;
 axios.defaults.adapter=config=>{calls++;return new Promise(resolve=>{release=()=>resolve({data:{entries:[{id:'own'}]},status:200,headers:{},config});});};
 try{
  setApiOwner('owner-a');const abort=new AbortController();
  const first=request('/notifications/inbox',{signal:abort.signal}),second=request('/notifications/inbox');
  assert.equal(calls,1);abort.abort();await assert.rejects(first,error=>axios.isCancel(error));release();assert.equal((await second).entries[0].id,'own');
  const third=request('/notifications/inbox');assert.equal(calls,2);release();await third;
 }finally{setApiOwner('');axios.defaults.adapter=previous;}
});

test('same-path reads never coalesce across account generations',async()=>{
 const previous=axios.defaults.adapter,releases=[];
 axios.defaults.adapter=config=>new Promise(resolve=>releases.push(data=>resolve({data,status:200,headers:{},config})));
 try{
  setApiOwner('a');const old=request('/academics/overview');setApiOwner('b');const current=request('/academics/overview');assert.equal(releases.length,2);
  releases[0]({student:'a'});releases[1]({student:'b'});await assert.rejects(old,error=>axios.isCancel(error));assert.equal((await current).student,'b');
 }finally{setApiOwner('');axios.defaults.adapter=previous;}
});
