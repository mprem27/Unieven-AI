import test from 'node:test';
import assert from 'node:assert/strict';
import React,{act} from 'react';
import {create} from 'react-test-renderer';
import {loadJsx,moduleUrl,settle} from './helpers/jsx.js';
globalThis.IS_REACT_ACT_ENVIRONMENT=true;

test('shared APK page opens without mounting the private account workspace',async()=>{
 globalThis.__publicEntryPath='/install';globalThis.__privateEntryMounts=0;
 const {default:AppEntry}=await loadJsx(new URL('../src/components/AppEntry.jsx',import.meta.url),{
  'react-router-dom':moduleUrl('export const useLocation=()=>({pathname:globalThis.__publicEntryPath});')
 });
 const Workspace=()=>{globalThis.__privateEntryMounts++;return React.createElement('p',null,'Private student records');};
 let view;
 try{
  const installPage=React.createElement('h1',null,'Download Android APK');
  await act(async()=>{view=create(React.createElement(AppEntry,{installPage},React.createElement(Workspace)));await settle();});
  assert.equal(globalThis.__privateEntryMounts,0);
  assert.equal(view.root.findByType('h1').children.join(''),'Download Android APK');
  globalThis.__publicEntryPath='/home';
  await act(async()=>view.update(React.createElement(AppEntry,{installPage},React.createElement(Workspace))));
  assert.equal(globalThis.__privateEntryMounts,1);
  assert.equal(view.root.findByType('p').children.join(''),'Private student records');
 }finally{if(view)await act(async()=>view.unmount());delete globalThis.__publicEntryPath;delete globalThis.__privateEntryMounts;}
});

test('shared logo keeps the university emblem intact in a single undistorted image',async()=>{
 const {default:HybridLogo}=await loadJsx(new URL('../src/components/HybridLogo.jsx',import.meta.url));
 let view;
 try{
  await act(async()=>{view=create(React.createElement(HybridLogo));});
  const layers=view.root.findAllByType('img');
  assert.equal(layers.length,1);
  assert.equal(layers[0].props.src,'/assets/original-logo.png');
  assert.equal(layers[0].props.className,'hybrid-logo-mark');
  assert.ok(layers.every(node=>node.props.alt==='' && node.props.decoding==='sync'));
 }finally{if(view)await act(async()=>view.unmount());}
});
