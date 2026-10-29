import test from 'node:test';
import assert from 'node:assert/strict';
import axios from 'axios';
import {createElement,act} from 'react';
import {create} from 'react-test-renderer';
import {setApiOwner} from '../src/lib/api.js';
import {indexedDB} from 'fake-indexeddb';
import {rememberVerifiedWorkspace,saveWorkspaceResource,clearWorkspaceCache} from '../src/lib/workspace-cache.js';
import {loadJsx,moduleUrl,browserFixture,settle} from './helpers/jsx.js';
globalThis.IS_REACT_ACT_ENVIRONMENT=true;
const {useLiveResource}=await loadJsx(new URL('../src/hooks/useLiveResource.js',import.meta.url),{'../context/CampusContext':moduleUrl('export const useCampus=()=>globalThis.__resourceCampus')});
async function renderHook(path='/academics/faculty-exams',enabled=true){
 let result,renderer;function Consumer({path,enabled}){result=useLiveResource(path,enabled);return null;}
 const oldError=console.error;console.error=(message,...args)=>{if(!String(message).includes('react-test-renderer is deprecated'))oldError(message,...args);};
 try{await act(async()=>{renderer=create(createElement(Consumer,{path,enabled}));await settle();});}finally{console.error=oldError;}
 return {get result(){return result;},async render(next={}){await act(async()=>{renderer.update(createElement(Consumer,{path,enabled,...next}));await settle();});},async close(){await act(async()=>renderer.unmount());}};
}
test('revalidation retains successful rows and distinguishes initial loading from refreshing across tab toggles',async()=>{
 const browser=browserFixture(),previous=axios.defaults.adapter;let release,calls=0,hook;
 globalThis.__resourceCampus={mode:'connected',data:{profile:{id:'a'}},offlineSnapshot:false};setApiOwner('a');
 axios.defaults.adapter=async config=>{calls++;if(calls===1)return {data:{examinations:[{id:'one'}]},status:200,headers:{},config};return new Promise(resolve=>{release=data=>resolve({data,status:200,headers:{},config});});};
 try{
  hook=await renderHook();assert.equal(hook.result.value.examinations[0].id,'one');
  let pending;await act(async()=>{pending=hook.result.reload();await settle();});
  assert.equal(hook.result.loading,false);assert.equal(hook.result.refreshing,true);assert.equal(hook.result.value.examinations[0].id,'one');
  await act(async()=>{release({examinations:[{id:'two'}]});await pending;});assert.equal(hook.result.value.examinations[0].id,'two');
  await hook.render({enabled:false});await hook.render();assert.equal(hook.result.value.examinations[0].id,'two');assert.equal(hook.result.loading,false);
  await act(async()=>{release({examinations:[{id:'three'}]});await settle();});
 }finally{if(hook)await hook.close();browser.restore();axios.defaults.adapter=previous;setApiOwner('');}
});
test('private rows disappear immediately on owner/path change and late replies cannot cross owners',async()=>{
 const browser=browserFixture(),previous=axios.defaults.adapter,pending=[];let hook;
 globalThis.__resourceCampus={mode:'connected',data:{profile:{id:'a'}},offlineSnapshot:false};setApiOwner('a');
 axios.defaults.adapter=config=>new Promise(resolve=>pending.push({config,resolve}));
 const resolve=(index,data)=>pending[index].resolve({data,status:200,headers:{},config:pending[index].config});
 try{
  hook=await renderHook();await act(async()=>{resolve(0,{examinations:[{id:'PRIVATE_A'}]});await settle();});assert.equal(hook.result.value.examinations[0].id,'PRIVATE_A');
  await act(async()=>{void hook.result.reload();await settle();});
  globalThis.__resourceCampus={mode:'connected',data:{profile:{id:'b'}},offlineSnapshot:false};setApiOwner('b');await hook.render();assert.equal(hook.result.value,null);
  await act(async()=>{resolve(1,{examinations:[{id:'LATE_A'}]});resolve(2,{examinations:[{id:'OWN_B'}]});await settle();});assert.equal(hook.result.value.examinations[0].id,'OWN_B');
  await hook.render({path:'/schedules'});assert.equal(hook.result.value,null);await act(async()=>{resolve(3,{schedules:[]});await settle();});
 }finally{if(hook)await hook.close();browser.restore();axios.defaults.adapter=previous;setApiOwner('');}
});
test('same-owner consumers share a read and background focus skips hidden/offline tabs then reconnects',async()=>{
 const browser=browserFixture(),previous=axios.defaults.adapter,pending=[];let first,second;
 globalThis.__resourceCampus={mode:'connected',data:{profile:{id:'shared'}},offlineSnapshot:false};setApiOwner('shared');
 axios.defaults.adapter=config=>new Promise(resolve=>pending.push({config,resolve}));
 try{
  first=await renderHook();second=await renderHook();assert.equal(pending.length,1);
  await act(async()=>{pending[0].resolve({data:{examinations:[]},status:200,headers:{},config:pending[0].config});await settle();});
  browser.document.visibilityState='hidden';await act(async()=>{browser.window.dispatchEvent(new Event('focus'));await settle();});assert.equal(pending.length,1);
  browser.document.visibilityState='visible';navigator.onLine=false;await act(async()=>{browser.window.dispatchEvent(new Event('focus'));await settle();});assert.equal(pending.length,1);
  navigator.onLine=true;await act(async()=>{browser.window.dispatchEvent(new Event('online'));await settle();});assert.equal(pending.length,2);
  await act(async()=>{pending[1].resolve({data:{examinations:[]},status:200,headers:{},config:pending[1].config});await settle();});
 }finally{if(first)await first.close();if(second)await second.close();browser.restore();axios.defaults.adapter=previous;setApiOwner('');}
});
test('offline hooks restore only their remembered owner resource without making network requests',async()=>{
 const browser=browserFixture(),previous=axios.defaults.adapter;globalThis.indexedDB=indexedDB;let hook,calls=0;
 globalThis.__resourceCampus={mode:'connected',data:{profile:{id:'a'}},offlineSnapshot:true};setApiOwner('a');
 try{
  await clearWorkspaceCache();await rememberVerifiedWorkspace('a',{profile:{id:'a',accountRole:'student'}});await saveWorkspaceResource('a','/academics/campus-documents',{documents:[{id:'one',title:'Own document'}]});navigator.onLine=false;
  axios.defaults.adapter=async()=>{calls++;throw new Error('Offline');};hook=await renderHook('/academics/campus-documents');
  for(let i=0;i<30 && !hook.result.value;i++)await act(async()=>{await settle();});
  assert.equal(hook.result.value.documents[0].title,'Own document');assert.equal(hook.result.stale,true);assert.equal(hook.result.loading,false);assert.equal(calls,0);
  globalThis.__resourceCampus={mode:'connected',data:{profile:{id:'b'}},offlineSnapshot:true};setApiOwner('b');await hook.render();assert.equal(hook.result.value,null);assert.equal(calls,0);
 }finally{if(hook)await hook.close();await clearWorkspaceCache();browser.restore();axios.defaults.adapter=previous;setApiOwner('');delete globalThis.indexedDB;}
});
test('focus and visibility events respect transient-error backoff while manual reload can retry',async()=>{
 const browser=browserFixture(),previous=axios.defaults.adapter;let hook,calls=0;
 globalThis.__resourceCampus={mode:'connected',data:{profile:{id:'backoff'}},offlineSnapshot:false};setApiOwner('backoff');
 axios.defaults.adapter=async config=>{calls++;if(calls===1)throw new Error('Temporary failure');return {data:{entries:[]},status:200,headers:{},config};};
 try{
  hook=await renderHook('/backoff-fixture');assert.equal(calls,1);assert.match(hook.result.error,/Temporary failure/);
  await act(async()=>{browser.window.dispatchEvent(new Event('focus'));browser.document.dispatchEvent(new Event('visibilitychange'));await settle();});assert.equal(calls,1);
  await act(async()=>{await hook.result.reload();});assert.equal(calls,2);assert.equal(hook.result.error,'');
 }finally{if(hook)await hook.close();browser.restore();axios.defaults.adapter=previous;setApiOwner('');}
});
test('mounting a hidden resource waits for visibility before starting network work',async()=>{
 const browser=browserFixture(),previous=axios.defaults.adapter;let hook,calls=0;browser.document.visibilityState='hidden';
 globalThis.__resourceCampus={mode:'connected',data:{profile:{id:'hidden'}},offlineSnapshot:false};setApiOwner('hidden');
 axios.defaults.adapter=async config=>{calls++;return {data:{entries:[]},status:200,headers:{},config};};
 try{
  hook=await renderHook('/hidden-fixture');assert.equal(calls,0);
  browser.document.visibilityState='visible';await act(async()=>{browser.document.dispatchEvent(new Event('visibilitychange'));await settle();});assert.equal(calls,1);assert.deepEqual(hook.result.value,{entries:[]});
 }finally{if(hook)await hook.close();browser.restore();axios.defaults.adapter=previous;setApiOwner('');}
});
