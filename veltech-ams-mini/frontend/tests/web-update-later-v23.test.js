import test from 'node:test';
import assert from 'node:assert/strict';
import React,{act} from 'react';
import {webcrypto} from 'node:crypto';
import {create} from 'react-test-renderer';
import {loadJsx,moduleUrl,browserFixture,settle} from './helpers/jsx.js';
// Load policy before the fixture; browser fixture intentionally has no URL.
import '../src/lib/update-policy.js';
globalThis.IS_REACT_ACT_ENVIRONMENT=true;
test('offline Later survives an online remount even when server sw.js has changed',async()=>{
 const fixture=browserFixture(),oldFetch=globalThis.fetch,oldCrypto=Object.getOwnPropertyDescriptor(globalThis,'crypto');
 Object.defineProperty(globalThis,'crypto',{value:webcrypto,configurable:true});let tree,fetches=0;
 const worker={scriptURL:'https://campus.invalid/sw.js'};
 navigator.serviceWorker={getRegistration:async()=>({waiting:worker})};
 navigator.onLine=false;
 globalThis.fetch=async()=>{fetches++;if(!navigator.onLine)throw new Error('offline');return {ok:true,arrayBuffer:async()=>new Uint8Array([1,2,3]).buffer};};
 try{
  const {default:Notice}=await loadJsx(new URL('../src/components/AppUpdateNotice.jsx',import.meta.url),{'../context/CampusContext':moduleUrl('export const useCampus=()=>({mode:"connected",data:{profile:{id:"alpha"}}});')});
  await act(async()=>{tree=create(React.createElement(Notice));await settle();});
  assert.equal(tree.root.findAllByType('aside').length,1);
  await act(async()=>tree.root.findAllByType('button').find(node=>node.children.join('').includes('Later')).props.onClick());
  await act(async()=>tree.unmount());
  navigator.onLine=true;
  await act(async()=>{tree=create(React.createElement(Notice));await settle();});
  assert.equal(tree.root.findAllByType('aside').length,0,'same pending update must stay deferred across connectivity changes');
  assert.equal(fetches,0,'server sw.js cannot establish which build the waiting worker installed');
 }finally{if(tree)await act(async()=>tree.unmount());globalThis.fetch=oldFetch;if(oldCrypto)Object.defineProperty(globalThis,'crypto',oldCrypto);else delete globalThis.crypto;fixture.restore();}
});
