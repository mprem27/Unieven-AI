import test from 'node:test';
import assert from 'node:assert/strict';
import * as loader from '../src/lib/workspace-loader.js';
import {browserFixture,settle} from './helpers/jsx.js';

test('campus publications refresh only their independent lists and preserve old sections on failure',async()=>{
 assert.equal(typeof loader.startCampusRefresh,'function','Campus publications must keep refreshing after the global reload is removed');
 const browser=browserFixture(),tasks=new Map(),calls=[],applied=[];let id=0,now=0,current=true,fail=false;
 const stop=loader.startCampusRefresh({refreshSeconds:30,isCurrent:()=>current,read:async path=>{calls.push(path);if(fail && path==='/notices')throw new Error('Unavailable');return [{id:path}];},onValue:(path,value)=>applied.push([path,value]),documentTarget:browser.document,windowTarget:browser.window,schedule:(fn,delay)=>{tasks.set(++id,{fn,delay});return id;},unschedule:id=>tasks.delete(id),now:()=>now});
 const tick=async()=>{const [id,task]=tasks.entries().next().value;tasks.delete(id);now+=task.delay;await task.fn();await settle();};
 try{
  await tick();assert.deepEqual(calls.sort(),['/events','/notices','/placements','/registrations']);assert.equal(applied.length,4);
  browser.window.dispatchEvent(new Event('focus'));await settle();assert.equal(calls.length,4,'Focus storms must not bypass the interval');
  fail=true;await tick();assert.equal(applied.length,7,'Unavailable notices must retain their previous rows');
  browser.document.visibilityState='hidden';await tick();assert.equal(calls.length,8);
  browser.document.visibilityState='visible';navigator.onLine=false;await tick();assert.equal(calls.length,8);
  current=false;stop();assert.equal(tasks.size,0);
 }finally{stop();browser.restore();}
});
test('manual-only campus preferences schedule no list polling',()=>{
 assert.equal(typeof loader.startCampusRefresh,'function');let scheduled=0;
 const stop=loader.startCampusRefresh({refreshSeconds:0,isCurrent:()=>true,read:async()=>{throw new Error('Unexpected read');},onValue:()=>{},schedule:()=>{scheduled++;}});assert.equal(scheduled,0);stop();
});
