import test from 'node:test';
import assert from 'node:assert/strict';
import axios from 'axios';
import {request,setApiOwner} from '../src/lib/api.js';

test('a response started for a previous account cannot return its private records',async()=>{
 const old=axios.defaults.adapter;let release;
 axios.defaults.adapter=config=>new Promise(resolve=>{release=()=>resolve({data:{studentId:'private-old-record'},status:200,headers:{},config});});
 try{
  setApiOwner('previous-owner');
  const pending=request('/academics/overview');
  setApiOwner('current-owner');release();
  await assert.rejects(pending,error=>axios.isCancel(error));
 }finally{axios.defaults.adapter=old;setApiOwner('');}
});

test('an old-account conflict cannot trigger restoration after another account was adopted',async()=>{
 const old=axios.defaults.adapter;let release;let events=0;
 const originalWindow=globalThis.window,originalEvent=globalThis.CustomEvent;
 globalThis.window={dispatchEvent(){events++;}};globalThis.CustomEvent=class{constructor(type,options){this.type=type;this.detail=options.detail;}};
 axios.defaults.adapter=config=>new Promise((_resolve,reject)=>{release=()=>reject({response:{status:409,data:{code:'ACCOUNT_CHANGED',message:'Account changed'}},config});});
 try{
  setApiOwner('previous-owner');const pending=request('/events');
  setApiOwner('current-owner');release();
  await assert.rejects(pending,error=>axios.isCancel(error));
  assert.equal(events,0);
 }finally{axios.defaults.adapter=old;setApiOwner('');globalThis.window=originalWindow;globalThis.CustomEvent=originalEvent;}
});
