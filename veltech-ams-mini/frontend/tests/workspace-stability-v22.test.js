import test from 'node:test';
import assert from 'node:assert/strict';
import axios from 'axios';
import {createElement,act} from 'react';
import {create} from 'react-test-renderer';
import {loadJsx,moduleUrl,browserFixture,settle} from './helpers/jsx.js';
import {setApiOwner,setApiReadOnly} from '../src/lib/api.js';
globalThis.IS_REACT_ACT_ENVIRONMENT=true;
const context=await loadJsx(new URL('../src/context/CampusContext.jsx',import.meta.url),{'./AppPreferences':moduleUrl('export const useAppPreferences=()=>({preferences:{refreshSeconds:0}})')});
test('identical workspace revalidation preserves profile and academic references for dependent consumers',async()=>{
 const browser=browserFixture(),adapter=axios.defaults.adapter;let campus,renderer;const calls=[];
 const overview={profile:{name:'Own student',department:'CSE'},summary:[],academic:{results:[{courseCode:'CS',grade:'A'}]},syncStatus:{state:'idle',modules:[]}};
 axios.defaults.adapter=async config=>{calls.push(config.url);return {data:config.url==='/session'?{user:{id:'a',name:'Own student',accountRole:'student'},csrfToken:'fixture'}:config.url==='/academics/overview'?structuredClone(overview):config.url.startsWith('/academic-calendar') || config.url==='/timetable-rooms'?{entries:[]}:[],status:200,headers:{},config};};
 const oldError=console.error;console.error=(message,...args)=>{if(!String(message).includes('react-test-renderer is deprecated'))oldError(message,...args);};
 try{
  function Probe(){campus=context.useCampus();return null;}
  await act(async()=>{renderer=create(createElement(context.CampusProvider,null,createElement(Probe)));await settle();});
  for(let i=0;i<50 && !campus.data.workspaceReady;i++)await act(async()=>{await settle();});
  assert.equal(campus.data.profile.id,'a');const {profile,academic,timetable,classes}=campus.data;
  await act(async()=>{await campus.refresh();await settle();});
  assert.equal(campus.data.profile,profile);assert.equal(campus.data.academic,academic);assert.equal(campus.data.timetable,timetable);assert.equal(campus.data.classes,classes);
 }finally{if(renderer)await act(async()=>renderer.unmount());console.error=oldError;setApiOwner('');setApiReadOnly(false);browser.restore();axios.defaults.adapter=adapter;}
});
test('clock ticks keep visible workspace references stable and hidden ticks do no work',async()=>{
 const browser=browserFixture(),interval=globalThis.setInterval,clear=globalThis.clearInterval;let campus,renderer,renders=0,id=0;const timers=new Map();navigator.onLine=false;
 globalThis.setInterval=(fn,delay)=>{timers.set(++id,{fn,delay});return id;};globalThis.clearInterval=id=>timers.delete(id);
 const oldError=console.error;console.error=(message,...args)=>{if(!String(message).includes('react-test-renderer is deprecated'))oldError(message,...args);};
 try{
  function Probe(){campus=context.useCampus();renders++;return null;}
  await act(async()=>{renderer=create(createElement(context.CampusProvider,null,createElement(Probe)));await settle();});
  for(let i=0;i<30 && campus.sessionState==='checking';i++)await act(async()=>{await settle();});
  const data=campus.data;browser.document.visibilityState='hidden';const count=renders;
  await act(async()=>{[...timers.values()].find(task=>task.delay===15000).fn();});assert.equal(renders,count);
  browser.document.visibilityState='visible';await act(async()=>{[...timers.values()].find(task=>task.delay===15000).fn();});assert.equal(campus.data,data);
 }finally{if(renderer)await act(async()=>renderer.unmount());console.error=oldError;globalThis.setInterval=interval;globalThis.clearInterval=clear;setApiOwner('');setApiReadOnly(false);browser.restore();}
});
test('notification polling backs off failed transport without clearing visible notifications',async()=>{
 const browser=browserFixture(),adapter=axios.defaults.adapter,interval=globalThis.setInterval,clear=globalThis.clearInterval,dateNow=Date.now;let campus,renderer,id=0,calls=0,now=100000,fail=false;const timers=new Map();
 globalThis.setInterval=(fn,delay)=>{timers.set(++id,{fn,delay});return id;};globalThis.clearInterval=id=>timers.delete(id);Date.now=()=>now;
 axios.defaults.adapter=async config=>{let data=[];if(config.url==='/session')data={user:{id:'a',name:'Own student',accountRole:'student'},csrfToken:'fixture'};else if(config.url==='/academics/overview')data={profile:{name:'Own student'},academic:{}};else if(config.url.startsWith('/academic-calendar') || config.url==='/timetable-rooms')data={entries:[]};else if(config.url==='/notifications/inbox'){calls++;if(fail)throw new Error('Temporarily unavailable');data=[{id:'own-notice',read:false}];}return {data,status:200,headers:{},config};};
 const oldError=console.error;console.error=(message,...args)=>{if(!String(message).includes('react-test-renderer is deprecated'))oldError(message,...args);};
 try{
  function Probe(){campus=context.useCampus();return null;}
  await act(async()=>{renderer=create(createElement(context.CampusProvider,null,createElement(Probe)));await settle();});
  for(let i=0;i<50 && !campus.data.workspaceReady;i++)await act(async()=>{await settle();});
  assert.equal(campus.data.notifications[0].id,'own-notice');fail=true;
  const tick=async()=>{now+=15000;await act(async()=>{for(const task of [...timers.values()].filter(task=>task.delay===15000))task.fn();await settle();});};
  await tick();const failedCalls=calls;await tick();assert.equal(calls,failedCalls);assert.equal(campus.data.notifications[0].id,'own-notice');
 }finally{if(renderer)await act(async()=>renderer.unmount());console.error=oldError;Date.now=dateNow;globalThis.setInterval=interval;globalThis.clearInterval=clear;setApiOwner('');setApiReadOnly(false);browser.restore();axios.defaults.adapter=adapter;}
});
test('incremental sync keeps campus identity separate from the official academic profile',async()=>{
 const browser=browserFixture(),adapter=axios.defaults.adapter,schedule=globalThis.setTimeout,unschedule=globalThis.clearTimeout;let campus,renderer,id=0,version=1;const tasks=new Map();
 globalThis.setTimeout=(fn,delay)=>{tasks.set(++id,{fn,delay});return id;};globalThis.clearTimeout=id=>tasks.delete(id);
 const status=()=>({state:'syncing',modules:[{id:'profile',state:'available',recordCount:1,lastSuccessAt:`2026-10-26T10:00:0${version}Z`}]});
 axios.defaults.adapter=async config=>{let data=[];if(config.url==='/session')data={user:{id:'a',name:'Campus name',department:'IT',accountRole:'student',followingCount:0},syncStatus:status(),csrfToken:'fixture'};else if(config.url==='/academics/overview')data={profile:{name:'Official student',department:'CSE'},academic:{},syncStatus:status()};else if(config.url==='/academics/sync-status')data=status();else if(config.url==='/connections/p')data={following:true,status:'accepted'};else if(config.url.startsWith('/academic-calendar') || config.url==='/timetable-rooms')data={entries:[]};return {data,status:200,headers:{},config};};
 const oldError=console.error;console.error=(message,...args)=>{if(!String(message).includes('react-test-renderer is deprecated'))oldError(message,...args);};
 try{
  function Probe(){campus=context.useCampus();return null;}
  await act(async()=>{renderer=create(createElement(context.CampusProvider,null,createElement(Probe)));await settle();});
  for(let i=0;i<50 && !campus.data.workspaceReady;i++)await act(async()=>{await settle();});
  await act(async()=>{await campus.follow({id:'p',following:false});await settle();});assert.equal(campus.data.profile.followingCount,1);
  const previous=campus.data.profile;assert.equal(previous.socialName,'Campus name');assert.equal(previous.campusDepartment,'IT');
  version=2;const job=[...tasks.values()].find(task=>task.delay===750);assert.ok(job);await act(async()=>{await job.fn();await settle();});
  assert.equal(campus.data.profile.socialName,'Campus name');assert.equal(campus.data.profile.campusDepartment,'IT');assert.equal(campus.data.profile.followingCount,1,'Academic updates must preserve optimistic social counts');assert.equal(campus.data.profile,previous);
 }finally{if(renderer)await act(async()=>renderer.unmount());console.error=oldError;globalThis.setTimeout=schedule;globalThis.clearTimeout=unschedule;setApiOwner('');setApiReadOnly(false);browser.restore();axios.defaults.adapter=adapter;}
});
