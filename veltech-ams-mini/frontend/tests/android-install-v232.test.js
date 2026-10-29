import test from 'node:test';
import assert from 'node:assert/strict';
import React,{act} from 'react';
import {create} from 'react-test-renderer';
import {loadJsx,moduleUrl,browserFixture,settle} from './helpers/jsx.js';
import '../src/lib/update-policy.js';
globalThis.IS_REACT_ACT_ENVIRONMENT=true;
const sha='ab'.repeat(32);
const release={available:true,versionName:'2.3.2',versionCode:20302,bytes:2048,packageId:'in.velstudents.veltechams',sha256:sha,url:`/api/campus/app-release/apk?sha=${sha}`};
const ui=moduleUrl(`import React from ${JSON.stringify(import.meta.resolve('react'))};
 export const Button=({children,busy,variant,...props})=>React.createElement('button',props,children);
 export const Badge=({children})=>React.createElement('span',null,children);
 export const Feedback=({error,success})=>error || success?React.createElement('p',null,error || success):null;`);
const text=node=>node.children.map(child=>typeof child==='string'?child:text(child)).join('');
async function renderUpdates(read){
 globalThis.__androidInstallRequest=read;
 const {default:Updates}=await loadJsx(new URL('../src/components/AndroidUpdates.jsx',import.meta.url),{
  '../lib/api':moduleUrl('export const request=(...args)=>globalThis.__androidInstallRequest(...args);'), './UI':ui
 });
 let tree;await act(async()=>{tree=create(React.createElement(Updates));await settle();});return tree;
}
test('APK action hands the pinned same-origin attachment to the browser without creating a blob or claiming it was saved',async()=>{
 const fixture=browserFixture();let tree;const requests=[];
 try{
  tree=await renderUpdates(async path=>{requests.push(path);return release;});
  const action=tree.root.findAllByType('a').find(node=>text(node)==='Download Android APK');
  assert.ok(action,'APK must use a browser attachment link so its source remains the website domain');
  assert.equal(action.props.href,`/api/campus/app-release/apk?sha=${sha}`);
  await act(async()=>action.props.onClick());
  assert.deepEqual(requests,['/app-release'],'APK bytes belong to the browser download manager, not an authenticated JS/Blob request');
  assert.match(text(tree.root),/Download requested/);
  assert.doesNotMatch(text(tree.root),/APK saved|installation complete/i);
 }finally{if(tree)await act(async()=>tree.unmount());fixture.restore();delete globalThis.__androidInstallRequest;}
});
test('unverified release metadata never exposes an APK download link',async()=>{
 const fixture=browserFixture();let tree;
 try{
  tree=await renderUpdates(async()=>({...release,url:'https://other.invalid/release.apk'}));
  assert.equal(tree.root.findAllByType('a').filter(node=>node.props.download!==undefined).length,0);
  assert.match(text(tree.root),/could not be verified/);
 }finally{if(tree)await act(async()=>tree.unmount());fixture.restore();delete globalThis.__androidInstallRequest;}
});
test('unpublished releases show retry without a download or installed claim',async()=>{
 const fixture=browserFixture();let tree;
 try{
  tree=await renderUpdates(async()=>({available:false}));
  assert.equal(tree.root.findAllByType('a').filter(node=>node.props.download!==undefined).length,0);
  assert.match(text(tree.root),/has not been published/);
  assert.ok(tree.root.findAllByType('button').some(node=>text(node)==='Check Android release'));
  assert.doesNotMatch(text(tree.root),/APK saved|Installed · up to date/);
 }finally{if(tree)await act(async()=>tree.unmount());fixture.restore();delete globalThis.__androidInstallRequest;}
});
test('sharing uses the branded public install page and copying uses the own-domain APK attachment',async()=>{
 const fixture=browserFixture();let tree,shared,copied;
 navigator.share=async value=>{shared=value;};navigator.clipboard={writeText:async value=>{copied=value;}};
 try{
  tree=await renderUpdates(async()=>release);
  const button=label=>tree.root.findAllByType('button').find(node=>text(node)===label);
  assert.ok(button('Share download page'),'new students need a public install guide rather than an authenticated settings link');
  await act(async()=>button('Share download page').props.onClick());
  assert.equal(shared.url,'https://app.veltech-mini-ams.me/#/install');
  await act(async()=>button('Copy APK link').props.onClick());
  assert.equal(copied,'https://app.veltech-mini-ams.me/api/campus/app-release/latest.apk');
  assert.match(text(tree.root),/APK link copied/);
 }finally{if(tree)await act(async()=>tree.unmount());fixture.restore();delete globalThis.__androidInstallRequest;}
});
test('dismissed sharing is quiet and unavailable clipboard leaves the visible domain link usable',async()=>{
 const fixture=browserFixture();let tree;
 navigator.share=async()=>{const error=new Error('cancelled');error.name='AbortError';throw error;};
 try{
  tree=await renderUpdates(async()=>release);
  const button=label=>tree.root.findAllByType('button').find(node=>text(node)===label);
  assert.ok(button('Share download page'));
  await act(async()=>button('Share download page').props.onClick());
  assert.doesNotMatch(text(tree.root),/cancelled|share failed/i);
  await act(async()=>button('Copy APK link').props.onClick());
  assert.match(text(tree.root),/Copy the APK link below/);
  assert.ok(tree.root.findAllByType('a').some(node=>node.props.href==='https://app.veltech-mini-ams.me/api/campus/app-release/latest.apk'));
 }finally{if(tree)await act(async()=>tree.unmount());fixture.restore();delete globalThis.__androidInstallRequest;}
});
test('browsers without a share sheet copy the public guide URL',async()=>{
 const fixture=browserFixture();let tree,copied;
 navigator.clipboard={writeText:async value=>{copied=value;}};
 try{
  tree=await renderUpdates(async()=>release);
  await act(async()=>tree.root.findAllByType('button').find(node=>text(node)==='Share download page').props.onClick());
  assert.equal(copied,'https://app.veltech-mini-ams.me/#/install');
  assert.match(text(tree.root),/Download page link copied/);
 }finally{if(tree)await act(async()=>tree.unmount());fixture.restore();delete globalThis.__androidInstallRequest;}
});
