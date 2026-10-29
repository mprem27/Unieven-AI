import test from 'node:test';import assert from 'node:assert/strict';
import {loadWorkspace} from '../src/lib/workspace-loader.js';
test('a slow section does not delay already available academic records',async()=>{
 let release;const slow=new Promise(resolve=>{release=resolve;});const values=[];
 const pending=loadWorkspace(['academic','feed'],p=>p==='academic'?Promise.resolve({source:'ams'}):slow,{isCurrent:()=>true,onValue:(path)=>values.push(path)});
 await new Promise(resolve=>setImmediate(resolve));assert.deepEqual(values,['academic']);release([]);await pending;assert.deepEqual(values,['academic','feed']);
});
test('late section completion and errors do not cross a signed out or switched account',async()=>{
 let release,current=true;const result=new Promise(resolve=>{release=resolve;});const values=[];
 const pending=loadWorkspace(['academic'],()=>result,{isCurrent:()=>current,onValue:p=>values.push(p)});current=false;release({source:'old'});await pending;assert.deepEqual(values,[]);
});
test('independent workspace observers keep their own cancellation lifetime',async()=>{
 const {createWorkspaceReader}=await import('../src/lib/workspace-loader.js');
 const read=createWorkspaceReader(({signal})=>new Promise((resolve,reject)=>{signal.addEventListener('abort',()=>reject(new DOMException('Canceled','AbortError')));setImmediate(()=>resolve({ready:true}));}));
 const firstAbort=new AbortController(),secondAbort=new AbortController();
 const first=read('same-owner',{signal:firstAbort.signal}),second=read('same-owner',{signal:secondAbort.signal});
 await new Promise(resolve=>queueMicrotask(resolve));firstAbort.abort();
 await assert.rejects(first,error=>error.name==='AbortError');assert.deepEqual(await second,{ready:true});
});
