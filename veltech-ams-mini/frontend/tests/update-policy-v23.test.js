import test from 'node:test';
import assert from 'node:assert/strict';
import {captureAndroidLaunch,updateDeferred,deferUpdate,clearDisposableAppCaches} from '../src/lib/update-policy.js';
const trusted={referrer:'android-app://in.velstudents.veltechams',search:'?androidPackage=in.velstudents.veltechams&androidVersionCode=20200'};
test('verified launch survives navigation while query-only launch stays unknown',()=>{
 const capture=captureAndroidLaunch(trusted);assert.equal(capture.versionCode,20200);assert.equal(capture.installed,true);
 assert.equal(captureAndroidLaunch({...trusted,referrer:''}).installed,false);
 assert.equal(captureAndroidLaunch({...trusted,search:''}).versionCode,null);
});
test('later is scoped by owner and release and expires after 24 hours',()=>{
 const values=new Map(),storage={getItem:k=>values.get(k),setItem:(k,v)=>values.set(k,v)};
 deferUpdate(storage,'student-a','20300',1000);
 assert.equal(updateDeferred(storage,'student-a','20300',1001),true);
 assert.equal(updateDeferred(storage,'student-b','20300',1001),false);
 assert.equal(updateDeferred(storage,'student-a','20301',1001),false);
 assert.equal(updateDeferred(storage,'student-a','20300',1000+86400000),false);
});
test('asset refresh preserves active and waiting precache and private data',async()=>{
 const removed=[];
 const caches={keys:async()=>['workbox-precache-v2-veltech-ams-mini-v13-/','campus-downloads'],delete:async k=>removed.push(k)};
 await clearDisposableAppCaches(caches);
 assert.deepEqual(removed,[], 'waiting worker shares the precache; deleting it breaks offline startup');
});
test('approved refresh checks registration and reloads only after waiting worker takes control',async()=>{
 const {refreshAppAssets}=await import('../src/lib/update-policy.js');
 const events=new EventTarget();let checks=0,reloads=0,sent;
 const worker={state:'installed',postMessage:message=>{sent=message;}};
 events.getRegistration=async()=>({waiting:worker,update:async()=>{checks++;}});
 const refresh=refreshAppAssets({serviceWorker:events,reload:()=>reloads++});
 await new Promise(resolve=>setImmediate(resolve));
 assert.equal(checks,1);assert.deepEqual(sent,{type:'SKIP_WAITING'});assert.equal(reloads,0);
 events.dispatchEvent(new Event('controllerchange'));await refresh;assert.equal(reloads,1);
});
test('failed update check retains the running app without activating or reloading',async()=>{
 const {refreshAppAssets}=await import('../src/lib/update-policy.js');let reloads=0,activations=0;
 await assert.rejects(refreshAppAssets({serviceWorker:{getRegistration:async()=>({update:async()=>{throw new Error('network unavailable');},waiting:{postMessage:()=>activations++}})},reload:()=>reloads++}),/network/);
 assert.equal(reloads,0);assert.equal(activations,0);
});
test('Later remains deferred after a small device clock rollback',()=>{
 const values=new Map(),storage={getItem:k=>values.get(k),setItem:(k,v)=>values.set(k,v)};
 deferUpdate(storage,'student-a','20300',10000);
 assert.equal(updateDeferred(storage,'student-a','20300',9500),true);
 assert.equal(updateDeferred(storage,'student-a','20300',10000+86400000),false);
 storage.setItem('campus:update-later:student-a:20300','Infinity');
 assert.equal(updateDeferred(storage,'student-a','20300',9500),false);
});
