import test from 'node:test';
import assert from 'node:assert/strict';
import axios from 'axios';
import {indexedDB} from 'fake-indexeddb';
import {createElement,act} from 'react';
import {create} from 'react-test-renderer';
import {loadJsx,moduleUrl,browserFixture,settle} from './helpers/jsx.js';
import * as cache from '../src/lib/workspace-cache.js';
import {setApiOwner,setApiReadOnly} from '../src/lib/api.js';
globalThis.IS_REACT_ACT_ENVIRONMENT=true;
const context=await loadJsx(new URL('../src/context/CampusContext.jsx',import.meta.url),{'./AppPreferences':moduleUrl('export const useAppPreferences=()=>({preferences:{refreshSeconds:0}})')});
const saved={profile:{id:'a',accountRole:'student',name:'Fixture Student',department:'Computer Science'},subjects:[{code:'CS',name:'Saved Algorithms',present:9,total:10}],records:[],timetable:[],academic:{results:[{courseCode:'CS',grade:'A',source:'ams'}]}};
async function mount(){
 let campus,renderer;function Probe(){campus=context.useCampus();return null;}
 const oldError=console.error;console.error=(message,...args)=>{if(!String(message).includes('react-test-renderer is deprecated'))oldError(message,...args);};
 try{await act(async()=>{renderer=create(createElement(context.CampusProvider,null,createElement(Probe)));await settle();});}finally{console.error=oldError;}
 return {get campus(){return campus;},async close(){await act(async()=>renderer.unmount());}};
}
async function until(check){const deadline=performance.now()+2000;do{await act(async()=>{await new Promise(resolve=>setTimeout(resolve,5));});if(check())return;}while(performance.now()<deadline);assert.fail('Expected workspace state was not reached within two seconds');}
function reply(config,data){return {data,status:200,headers:{},config};}
test('saved verified student opens read-only offline without waiting for a network session or replaying welcome',async()=>{
 const browser=browserFixture(),adapter=axios.defaults.adapter;globalThis.indexedDB=indexedDB;let app,calls=0;
 try{
  await cache.clearWorkspaceCache();await cache.rememberVerifiedWorkspace('a',saved);navigator.onLine=false;
  axios.defaults.adapter=async()=>{calls++;throw new Error('Offline');};app=await mount();await until(()=>app.campus.sessionState!=='checking');
  assert.equal(app.campus.mode,'connected');assert.equal(app.campus.data.subjects[0].name,'Saved Algorithms');assert.equal(app.campus.offlineSnapshot,true);assert.equal(app.campus.welcomeStage,'');assert.equal(calls,0);
  await assert.rejects(app.campus.mutate('/feed',{text:'test'}),/read.only|connect/i);
 }finally{if(app)await app.close();cache.clearLocalLogout();await cache.clearWorkspaceCache();setApiOwner('');setApiReadOnly(false);browser.restore();axios.defaults.adapter=adapter;delete globalThis.indexedDB;}
});
test('background validation retains same-owner workspace state and cached rows until new records arrive',async()=>{
 const browser=browserFixture(),adapter=axios.defaults.adapter;globalThis.indexedDB=indexedDB;let app,releaseSession,releaseOverview;
 try{
  await cache.clearWorkspaceCache();await cache.rememberVerifiedWorkspace('a',saved);
  axios.defaults.adapter=config=>config.url==='/session'?new Promise(resolve=>{releaseSession=()=>resolve(reply(config,{user:{id:'a',name:'Fixture Student',accountRole:'student'},csrfToken:'fresh'}));}):config.url==='/academics/overview'?new Promise(resolve=>{releaseOverview=()=>resolve(reply(config,{profile:{name:'Fixture Student'},summary:[{subjectCode:'CS',subjectName:'Fresh Algorithms',present:10,total:11}],academic:{}}));}):Promise.resolve(reply(config,config.url.startsWith('/academic-calendar') || config.url==='/timetable-rooms'?{entries:[]}:[]));
  app=await mount();await until(()=>app.campus.mode==='connected');assert.equal(app.campus.offlineSnapshot,true);assert.equal(app.campus.data.subjects[0].name,'Saved Algorithms');assert.equal(app.campus.welcomeStage,'');
  await until(()=>!!releaseSession);await act(async()=>{releaseSession();await settle();});await until(()=>!!releaseOverview);
  assert.equal(app.campus.offlineSnapshot,false);assert.equal(app.campus.data.subjects[0].name,'Saved Algorithms');assert.equal(app.campus.welcomeStage,'');assert.equal(app.campus.loading,false);
  await act(async()=>{releaseOverview();await settle();});await until(()=>app.campus.data.subjects[0]?.name==='Fresh Algorithms');
 }finally{if(app)await app.close();cache.clearLocalLogout();await cache.clearWorkspaceCache();setApiOwner('');setApiReadOnly(false);browser.restore();axios.defaults.adapter=adapter;delete globalThis.indexedDB;}
});
test('offline logout stays anonymous across reload and reconciles with fresh CSRF without adopting the server account',async()=>{
 const browser=browserFixture(),adapter=axios.defaults.adapter;globalThis.indexedDB=indexedDB;let app;const calls=[];
 try{
  await cache.clearWorkspaceCache();await cache.rememberVerifiedWorkspace('a',saved);navigator.onLine=false;
  axios.defaults.adapter=async config=>{calls.push({path:config.url,csrf:config.headers.get('X-CSRF-Token')});return reply(config,config.url==='/session'?{user:{id:'a',accountRole:'student'},csrfToken:'reconcile-only'}:{ok:true});};
  app=await mount();await until(()=>app.campus.mode==='connected');await act(async()=>{await app.campus.signOut();});assert.equal(app.campus.sessionState,'anonymous');assert.equal(await cache.readRememberedWorkspace(),null);await app.close();
  app=await mount();await until(()=>app.campus.sessionState!=='checking');assert.equal(app.campus.sessionState,'anonymous');assert.equal(calls.length,0);
  navigator.onLine=true;await act(async()=>{browser.window.dispatchEvent(new Event('online'));await settle();});await until(()=>calls.some(call=>call.path==='/logout'));
  assert.equal(calls.find(call=>call.path==='/logout').csrf,'reconcile-only');assert.equal(app.campus.mode,'demo');assert.equal(app.campus.sessionState,'anonymous');await app.close();app=await mount();await until(()=>app.campus.sessionState!=='checking');assert.equal(app.campus.sessionState,'anonymous');
 }finally{if(app)await app.close();cache.clearLocalLogout();await cache.clearWorkspaceCache();setApiOwner('');setApiReadOnly(false);browser.restore();axios.defaults.adapter=adapter;delete globalThis.indexedDB;}
});
test('cached room publications match the official department when campus department is blank or uses a known alias',async()=>{
 const browser=browserFixture(),adapter=axios.defaults.adapter;globalThis.indexedDB=indexedDB;let app;
 try{
  await cache.clearWorkspaceCache();await cache.rememberVerifiedWorkspace('a',{...saved,profile:{...saved.profile,campusDepartment:'',officialProfile:{department:'Computer Science and Engineering'}},timetable:[{source:'ams',subjectCode:'CS',subjectName:'Algorithms',day:'Monday',startTime:'09:00',endTime:'10:00',room:'Old',faculty:'Teacher'}],roomOverrides:[{id:'override',source:'administrator',department:'CSE',courseCode:'CS',courseName:'Algorithms',day:'Monday',startTime:'09:00',endTime:'10:00',date:'',sourceRoom:'Old',faculty:'Teacher',room:'Updated room'}]});navigator.onLine=false;
  app=await mount();await until(()=>app.campus.mode==='connected');assert.equal(app.campus.data.timetable[0].room,'Updated room');
 }finally{if(app)await app.close();cache.clearLocalLogout();await cache.clearWorkspaceCache();setApiOwner('');setApiReadOnly(false);browser.restore();axios.defaults.adapter=adapter;delete globalThis.indexedDB;}
});
