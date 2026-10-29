import test from 'node:test';
import assert from 'node:assert/strict';
import * as loader from '../src/lib/workspace-loader.js';
import {browserFixture,settle} from './helpers/jsx.js';

const status=(state='syncing',patch={})=>({state,modules:[{id:'profile',state:'available',recordCount:1,lastSuccessAt:'2026-10-26T10:00:00Z',...patch}]});
async function fixture(){
 assert.equal(typeof loader.startAcademicRefresh,'function');
 const browser=browserFixture(),tasks=new Map();let id=0,now=0,reads=0,current=status(),published=[];
 const stop=loader.startAcademicRefresh({getSnapshotStatus:()=>status(),readStatus:async()=>current,readWorkspace:async()=>{reads++;return {profile:{name:'Own student'}};},isCurrent:()=>true,onStatus:value=>published.push(value),onWorkspace:()=>{},documentTarget:browser.document,windowTarget:browser.window,schedule:(fn,delay)=>{tasks.set(++id,{fn,delay});return id;},unschedule:id=>tasks.delete(id),now:()=>now});
 return {browser,tasks,stop,get reads(){return reads;},get published(){return published;},setStatus(value){current=value;},async tick(){const [key,task]=tasks.entries().next().value;tasks.delete(key);now+=task.delay;await task.fn();await settle();},async close(){stop();browser.restore();}};
}
test('progress-only sync polls publish status without rereading the academic workspace',async()=>{
 const f=await fixture();try{
  await f.tick();assert.equal(f.reads,0);
  f.setStatus(status('syncing',{state:'error',error:'Source temporarily unavailable'}));await f.tick();assert.equal(f.reads,0);assert.equal(f.published.at(-1).modules[0].state,'error');
  f.setStatus(status('partial',{state:'error'}));await f.tick();assert.equal(f.reads,0);
  f.setStatus(status('idle',{lastSuccessAt:'2026-10-26T10:00:02Z'}));await f.tick();assert.equal(f.reads,1);
 }finally{await f.close();}
});
test('sync polls back off after failure and pause hidden/offline work',async()=>{
 assert.equal(typeof loader.startAcademicRefresh,'function');
 const browser=browserFixture(),tasks=new Map();let id=0,reads=0,now=0;
 const stop=loader.startAcademicRefresh({getSnapshotStatus:()=>status(),readStatus:async()=>{reads++;throw new Error('Unavailable');},readWorkspace:async()=>{},isCurrent:()=>true,onStatus:()=>{},onWorkspace:()=>{},documentTarget:browser.document,windowTarget:browser.window,schedule:(fn,delay)=>{tasks.set(++id,{fn,delay});return id;},unschedule:id=>tasks.delete(id),now:()=>now});
 const tick=async()=>{const [key,task]=tasks.entries().next().value;tasks.delete(key);now+=task.delay;await task.fn();await settle();};
 try{
  await tick();const first=[...tasks.values()][0].delay;await tick();assert.ok([...tasks.values()][0].delay>first);
  browser.window.dispatchEvent(new Event('focus'));await settle();assert.equal(reads,2);
  browser.document.visibilityState='hidden';await tick();assert.equal(reads,2);
  browser.document.visibilityState='visible';navigator.onLine=false;await tick();assert.equal(reads,2);
 }finally{stop();browser.restore();}
});
test('a superseded overview is retried when no newer snapshot was applied',async()=>{
 assert.equal(typeof loader.startAcademicRefresh,'function');
 const browser=browserFixture(),tasks=new Map();let id=0,reads=0,applies=0;
 const current=status('syncing',{lastSuccessAt:'2026-10-26T10:00:02Z'});
 const stop=loader.startAcademicRefresh({getSnapshotStatus:()=>status(),readStatus:async()=>current,readWorkspace:async()=>{reads++;return {};},isCurrent:()=>true,onStatus:()=>{},onWorkspace:()=>++applies>1,documentTarget:browser.document,windowTarget:browser.window,schedule:(fn,delay)=>{tasks.set(++id,{fn,delay});return id;},unschedule:id=>tasks.delete(id)});
 const tick=async()=>{const [key,task]=tasks.entries().next().value;tasks.delete(key);await task.fn();await settle();};
 try{await tick();assert.equal(reads,1);await tick();assert.equal(reads,2);await tick();assert.equal(reads,2);}finally{stop();browser.restore();}
});
