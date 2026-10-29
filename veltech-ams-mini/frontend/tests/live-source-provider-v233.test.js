import test from 'node:test';
import assert from 'node:assert/strict';
import axios from 'axios';
import {createElement,act} from 'react';
import {create} from 'react-test-renderer';
import {loadJsx,moduleUrl,browserFixture,settle} from './helpers/jsx.js';
import {request,setApiOwner,setApiReadOnly} from '../src/lib/api.js';
globalThis.IS_REACT_ACT_ENVIRONMENT=true;
const context=await loadJsx(new URL('../src/context/CampusContext.jsx',import.meta.url),{'./AppPreferences':moduleUrl('export const useAppPreferences=()=>({preferences:{refreshSeconds:30}})')});
const sourceStatus=()=>({state:'partial',lastSuccessAt:'2026-10-28T10:00:00Z',modules:[],sourceSession:{state:'active',refreshAvailable:true,expiresInSeconds:1800,retryAfterSeconds:0}});
test('provider uses granular academic refresh, coalesces manual source sync and fences same-owner reauthentication',async()=>{
 const browser=browserFixture(),adapter=axios.defaults.adapter,schedule=globalThis.setTimeout,unschedule=globalThis.clearTimeout,repeat=globalThis.setInterval,unrepeat=globalThis.clearInterval,dateNow=Date.now;
 let id=0,now=0,campus,renderer,release;const tasks=new Map(),intervals=new Map(),calls=[];
 globalThis.setTimeout=(fn,delay)=>{tasks.set(++id,{fn,delay});return id;};globalThis.clearTimeout=id=>tasks.delete(id);
 globalThis.setInterval=(fn,delay)=>{intervals.set(++id,{fn,delay});return id;};globalThis.clearInterval=id=>intervals.delete(id);Date.now=()=>now;
 axios.defaults.adapter=async config=>{
  calls.push(config.url);let data=[];
  if(config.url==='/session')data={user:{id:'owner',name:'Campus identity',accountRole:'student'},csrfToken:'fixture'};
  else if(config.url==='/academics/overview')data={profile:{name:'Official identity'},academic:{},syncStatus:sourceStatus()};
  else if(config.url==='/academics/sync-status')data=sourceStatus();
  else if(config.url==='/academics/ams/refresh'){await new Promise(resolve=>{release=resolve;});data={queued:true,syncStatus:{...sourceStatus(),state:'syncing'}};}
  else if(config.url.startsWith('/academic-calendar') || config.url==='/timetable-rooms')data={entries:[]};
  return {data,status:200,headers:{},config};
 };
 const oldError=console.error;console.error=(message,...args)=>{if(!String(message).includes('react-test-renderer is deprecated'))oldError(message,...args);};
 try{
  function Probe(){campus=context.useCampus();return null;}
  await act(async()=>{renderer=create(createElement(context.CampusProvider,null,createElement(Probe)));await settle();});
  for(let i=0;i<50 && !campus.data.workspaceReady;i++)await act(async()=>{await settle();});
  assert.equal(typeof campus.refreshUniversity,'function','The university button must share the academic controller');
  const fullReads=calls.filter(path=>['/session','/feed','/people','/academics/overview'].includes(path)).length;
  const tick=async()=>{const jobs=[...tasks.entries()].filter(([,task])=>task.delay===30000);assert.ok(jobs.length);now+=30000;await Promise.all(jobs.map(async([key,task])=>{tasks.delete(key);await task.fn();}));};
  for(let i=0;i<3;i++)await act(async()=>{await tick();await settle();});
  let auto,manual;await act(async()=>{auto=tick();await settle();manual=campus.refreshUniversity();await settle();});
  assert.equal(calls.filter(path=>path==='/academics/ams/refresh').length,1);assert.equal(calls.filter(path=>['/session','/feed','/people','/academics/overview'].includes(path)).length,fullReads);
  await act(async()=>{await campus.resume({user:{id:'owner',name:'Campus identity',accountRole:'student'},csrfToken:'new-fixture'});await settle();});
  await act(async()=>{release();await Promise.allSettled([auto,manual]);await settle();});
  assert.equal(campus.data.syncStatus.state,'partial','An earlier source response must not publish after same-owner reauthentication');
 }finally{
  if(release)release();if(renderer)await act(async()=>renderer.unmount());console.error=oldError;globalThis.setTimeout=schedule;globalThis.clearTimeout=unschedule;globalThis.setInterval=repeat;globalThis.clearInterval=unrepeat;Date.now=dateNow;setApiOwner('');setApiReadOnly(false);browser.restore();axios.defaults.adapter=adapter;
 }
});
test('frontend preserves bounded Retry-After for busy and rate-limited admission',async()=>{
 const adapter=axios.defaults.adapter;
 try{for(const status of [503,429]){axios.defaults.adapter=async()=>{throw {response:{status,headers:{'retry-after':'120'},data:{detail:'Wait for AMS'}}};};await assert.rejects(request('/academics/ams/refresh',{method:'POST',body:{}}),error=>error.status===status && error.retryAfter===120);}}
 finally{axios.defaults.adapter=adapter;}
});
