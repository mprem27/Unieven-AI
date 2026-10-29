import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import {act,create} from 'react-test-renderer';
import {loadJsx,moduleUrl} from './helpers/jsx.js';
globalThis.IS_REACT_ACT_ENVIRONMENT=true;
const preferences=moduleUrl('export const useAppPreferences=()=>({preferences:globalThis.__launchPreferences});');
const {default:AppLaunch}=await loadJsx(new URL('../src/components/AppLaunch.jsx',import.meta.url),{'../context/AppPreferences':preferences,'./HybridLogo':moduleUrl('export default function HybridLogo(){return null;}')});
function environment(){const seen=new Map(),old={sessionStorage:globalThis.sessionStorage,matchMedia:globalThis.matchMedia};globalThis.sessionStorage={getItem:key=>seen.get(key),setItem:(key,value)=>seen.set(key,value)};globalThis.matchMedia=()=>({matches:false});globalThis.__launchPreferences={openingAnimation:true,motion:'system'};return()=>{Object.assign(globalThis,old);delete globalThis.__launchPreferences;};}
test('launch animation keeps app inert until the assembled logo is complete then releases it; route rerender does not replay',async t=>{
 const restore=environment();t.mock.timers.enable({apis:['setTimeout']});let view;
 try{await act(async()=>{view=create(React.createElement(AppLaunch,null,React.createElement('h1',null,'Campus')));});assert.equal(view.root.findByProps({className:'app-launch-content'}).props.inert,true);assert.equal(view.root.findAllByProps({'aria-label':'Opening Veltech mini'}).length,1);await act(async()=>t.mock.timers.tick(901));assert.equal(view.root.findByProps({className:'app-launch-content'}).props.inert,true);await act(async()=>t.mock.timers.tick(250));assert.equal(view.root.findByProps({className:'app-launch-content'}).props.inert,false);assert.equal(view.root.findAllByProps({'aria-label':'Opening Veltech mini'}).length,0);await act(async()=>view.update(React.createElement(AppLaunch,null,React.createElement('h1',null,'Settings'))));assert.equal(view.root.findAllByProps({'aria-label':'Opening Veltech mini'}).length,0);}finally{await act(async()=>view?.unmount());restore();}
});
test('disabled motion bypasses animation and a saved launch is not replayed on remount',async t=>{
 const restore=environment();t.mock.timers.enable({apis:['setTimeout']});let view;
 try{globalThis.__launchPreferences.openingAnimation=false;await act(async()=>{view=create(React.createElement(AppLaunch,null,'Ready'));});assert.equal(view.root.findByProps({className:'app-launch-content'}).props.inert,false);await act(async()=>view.unmount());globalThis.__launchPreferences.openingAnimation=true;await act(async()=>{view=create(React.createElement(AppLaunch,null,'Ready'));});await act(async()=>t.mock.timers.tick(2801));await act(async()=>view.unmount());await act(async()=>{view=create(React.createElement(AppLaunch,null,'Ready'));});assert.equal(view.root.findAllByProps({'aria-label':'Opening Veltech mini'}).length,0);}finally{await act(async()=>view?.unmount());restore();}
});
test('reduced motion shows a short static mark and never waits for a network response',async t=>{
 const restore=environment();t.mock.timers.enable({apis:['setTimeout']});let view;
 try{globalThis.__launchPreferences.motion='reduced';await act(async()=>{view=create(React.createElement(AppLaunch,null,'Ready'));});assert.equal(view.root.findByProps({'aria-label':'Opening Veltech mini'}).props['data-motion'],'reduced');await act(async()=>t.mock.timers.tick(201));assert.equal(view.root.findByProps({className:'app-launch-content'}).props.inert,false);}finally{await act(async()=>view?.unmount());restore();}
});
test('launch fades the intact overlay before releasing focus to the app',async t=>{
 const restore=environment();t.mock.timers.enable({apis:['setTimeout']});let view;
 try{await act(async()=>{view=create(React.createElement(AppLaunch,null,'Ready'));});await act(async()=>t.mock.timers.tick(920));assert.equal(view.root.findByProps({'aria-label':'Opening Veltech mini'}).props['data-transition'],'leaving');assert.equal(view.root.findByProps({className:'app-launch-content'}).props.inert,true);await act(async()=>t.mock.timers.tick(190));assert.equal(view.root.findByProps({className:'app-launch-content'}).props.inert,false);}finally{await act(async()=>view?.unmount());restore();}
});
