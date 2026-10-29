import test from 'node:test';
import assert from 'node:assert/strict';
import React,{act} from 'react';
import {create} from 'react-test-renderer';
import {loadJsx,moduleUrl,browserFixture,settle} from './helpers/jsx.js';
import '../src/lib/update-policy.js';
globalThis.IS_REACT_ACT_ENVIRONMENT=true;
test('foreground rechecks after cooldown, coalesces events and honours release Later',async()=>{
 const fixture=browserFixture(),oldNow=Date.now;let now=1000000,tree,calls=0,resolve;
 Date.now=()=>now;
 const release={available:true,versionCode:20300,versionName:'2.3.0'};
 globalThis.__androidForegroundRequest=()=>{calls++;return calls===2?new Promise(ok=>{resolve=ok;}):Promise.resolve(release);};
 const policy=new URL('../src/lib/update-policy.js',import.meta.url).href;
 try{
  const {default:Notice}=await loadJsx(new URL('../src/components/AndroidUpdateNotice.jsx',import.meta.url),{
   '../context/CampusContext':moduleUrl('export const useCampus=()=>({mode:"connected",data:{profile:{id:"alpha"}}});'),
   '../lib/api':moduleUrl('export const request=()=>globalThis.__androidForegroundRequest();'),
   '../lib/app-release':moduleUrl('export const validateAndroidRelease=value=>value;'),
   '../lib/update-policy':moduleUrl(`export * from ${JSON.stringify(policy)};export const androidLaunch={installed:true,versionCode:20200};`),
   './AndroidUpdates':moduleUrl('export default function AndroidUpdates(){return null;}'),
   './UI':moduleUrl('export const Dialog=()=>null;')
  });
  await act(async()=>{tree=create(React.createElement(Notice));await settle();});assert.equal(calls,1);
  await act(async()=>tree.root.findAllByType('button').find(node=>node.children.join('').includes('Later')).props.onClick());
  await act(async()=>{document.dispatchEvent(new Event('visibilitychange'));window.dispatchEvent(new Event('online'));await settle();});assert.equal(calls,1);
  now+=15*60000;
  await act(async()=>{document.visibilityState='hidden';document.dispatchEvent(new Event('visibilitychange'));await settle();});assert.equal(calls,1);
  await act(async()=>{document.visibilityState='visible';document.dispatchEvent(new Event('visibilitychange'));window.dispatchEvent(new Event('online'));await settle();});
  assert.equal(calls,2,'returning after cooldown must check again without remounting');
  await act(async()=>{window.dispatchEvent(new Event('online'));document.dispatchEvent(new Event('visibilitychange'));resolve(release);await settle();});assert.equal(calls,2);assert.equal(tree.root.findAllByType('aside').length,0,'Later must survive a successful refresh');
  now+=86400000;
  await act(async()=>{document.dispatchEvent(new Event('visibilitychange'));await settle();});assert.equal(calls,3);assert.equal(tree.root.findAllByType('aside').length,1);
 }finally{if(tree)await act(async()=>tree.unmount());Date.now=oldNow;delete globalThis.__androidForegroundRequest;fixture.restore();}
});
test('a failed foreground check recovers on a later return without a 15-minute wait or event storm',async()=>{
 const fixture=browserFixture(),oldNow=Date.now;let now=2000000,tree,calls=0,resolve;
 Date.now=()=>now;
 const sha='ab'.repeat(32),release={available:true,versionCode:20304,versionName:'2.3.3',bytes:2048,packageId:'in.velstudents.veltechams',sha256:sha,url:`/api/campus/app-release/apk?sha=${sha}`};
 globalThis.__androidRetryRequest=()=>{calls++;return calls===1?Promise.reject(new Error('connection interrupted')):new Promise(ok=>{resolve=ok;});};
 const policy=new URL('../src/lib/update-policy.js',import.meta.url).href;
 try{
  const {default:Notice}=await loadJsx(new URL('../src/components/AndroidUpdateNotice.jsx',import.meta.url),{
   '../context/CampusContext':moduleUrl('export const useCampus=()=>({mode:"connected",data:{profile:{id:"alpha"}}});'),
   '../lib/api':moduleUrl('export const request=()=>globalThis.__androidRetryRequest();'),
   '../lib/update-policy':moduleUrl(`export * from ${JSON.stringify(policy)};export const androidLaunch={installed:true,versionCode:20303};`),
   './AndroidUpdates':moduleUrl('export default function AndroidUpdates(){return null;}'),
   './UI':moduleUrl('export const Dialog=()=>null;')
  });
  await act(async()=>{tree=create(React.createElement(Notice));await settle();});
  assert.equal(calls,1);assert.equal(tree.root.findAllByType('aside').length,0);
  await act(async()=>{window.dispatchEvent(new Event('online'));document.dispatchEvent(new Event('visibilitychange'));await settle();});
  assert.equal(calls,1,'failed checks must retain a short cooldown');
  now+=60000;
  await act(async()=>{document.visibilityState='hidden';document.dispatchEvent(new Event('visibilitychange'));await settle();});
  assert.equal(calls,1,'background tabs must not retry');
  await act(async()=>{document.visibilityState='visible';document.dispatchEvent(new Event('visibilitychange'));window.dispatchEvent(new Event('online'));await settle();});
  assert.equal(calls,2,'the next foreground event after the failure cooldown must retry');
  await act(async()=>{window.dispatchEvent(new Event('online'));document.dispatchEvent(new Event('visibilitychange'));resolve(release);await settle();});
  assert.equal(calls,2,'overlapping recovery events share one check');
  assert.equal(tree.root.findAllByType('aside').length,1,'successful recovery must show the verified update without reloading');
  now+=60000;
  await act(async()=>{document.dispatchEvent(new Event('visibilitychange'));await settle();});
  assert.equal(calls,2,'a successful check retains the longer foreground cooldown');
 }finally{if(tree)await act(async()=>tree.unmount());Date.now=oldNow;delete globalThis.__androidRetryRequest;fixture.restore();}
});
