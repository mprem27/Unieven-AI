import test from 'node:test';
import assert from 'node:assert/strict';
import {startAcademicRefresh} from '../src/lib/workspace-loader.js';
import {browserFixture,settle} from './helpers/jsx.js';

const saved='2026-10-28T10:00:00Z';
const status=(patch={})=>({state:'partial',lastSuccessAt:saved,modules:[{id:'profile',lastSuccessAt:saved,recordCount:1}],sourceSession:{state:'active',refreshAvailable:true,expiresInSeconds:1800},...patch});
function fixture({refreshSeconds=60,source,readStatus}={}){
 const browser=browserFixture(),tasks=new Map(),published=[],applied=[];let id=0,time=0,current=true,reads=0,writes=0,workspaceReads=0,latest=status(),snapshot=status();
 const stop=startAcademicRefresh({refreshSeconds,getSnapshotStatus:()=>snapshot,initialStatus:latest,isCurrent:()=>current,readStatus:async()=>{reads++;return readStatus?readStatus():latest;},requestRefresh:async()=>{writes++;return source?source():{queued:true,syncStatus:status({state:'syncing'})};},readWorkspace:async()=>{workspaceReads++;return {profile:{name:'Owner'}};},onStatus:value=>published.push(value),onWorkspace:(value,next)=>{applied.push(value);snapshot=next;},documentTarget:browser.document,windowTarget:browser.window,schedule:(fn,delay)=>{tasks.set(++id,{fn,delay});return id;},unschedule:id=>tasks.delete(id),now:()=>time});
 return {browser,tasks,stop,published,applied,get reads(){return reads;},get writes(){return writes;},get workspaceReads(){return workspaceReads;},get now(){return time;},setTime(value){time=value;},setStatus(value){latest=value;},invalidate(){current=false;},async tick(){assert.ok(tasks.size,'Expected scheduled check');const [key,task]=tasks.entries().next().value;tasks.delete(key);time+=task.delay;await task.fn();await settle();},close(){stop();browser.restore();}};
}

test('automatic refresh starts a real source job then reloads only committed academic changes',async()=>{
 const f=fixture();try{
  await f.tick();assert.equal(f.writes,0,'No immediate redundant sync after sign-in');
  await f.tick();await f.tick();await f.tick();assert.equal(f.writes,1,'The preference must eventually POST fresh AMS work');assert.equal(f.workspaceReads,0);
  f.setStatus(status({state:'syncing',modules:[{id:'profile',lastSuccessAt:'2026-10-28T10:01:00Z',recordCount:1}]}));await f.tick();assert.equal(f.workspaceReads,1);
  await f.tick();assert.equal(f.workspaceReads,1,'Progress alone must not reload the snapshot');
 }finally{f.close();}
});
test('manual-only, hidden and offline preferences never schedule automatic source writes',async()=>{
 for(const kind of ['manual','hidden','offline']){
  const f=fixture({refreshSeconds:kind==='manual'?0:30});try{
   if(kind==='hidden')f.browser.document.visibilityState='hidden';if(kind==='offline')navigator.onLine=false;
   for(let i=0;i<5 && f.tasks.size;i++)await f.tick();assert.equal(f.writes,0,kind);
  }finally{f.close();}
 }
});
test('manual refresh shares the automatic in-flight source request and stops on expiry',async()=>{
 let release;const f=fixture({source:()=>new Promise(resolve=>{release=resolve;})});try{
  assert.equal(typeof f.stop.refreshSource,'function','Manual sync must share the provider controller');
  await f.tick();await f.tick();await f.tick();const pending=f.tick();await settle();assert.equal(f.writes,1);
  const manual=f.stop.refreshSource();await settle();assert.equal(f.writes,1);
  release({queued:true,syncStatus:status({state:'syncing'})});await Promise.all([pending,manual]);
  f.setStatus(status({sourceSession:{state:'reconnect_required',refreshAvailable:false,expiresInSeconds:0}}));await f.tick();
  for(let i=0;i<4 && f.tasks.size;i++)await f.tick();assert.equal(f.writes,1);
 }finally{f.close();}
});
test('source admission backs off busy and rate-limited responses without advancing success time',async()=>{
 for(const code of [503,429]){
  const f=fixture({source:async()=>{throw Object.assign(new Error('Source busy'),{status:code,retryAfter:120});}});try{
   assert.equal(typeof f.stop.refreshSource,'function');
   await assert.rejects(f.stop.refreshSource(),error=>error.status===code);assert.equal(f.writes,1);
   f.browser.window.dispatchEvent(new Event('focus'));await settle();assert.equal(f.writes,1);
   await assert.rejects(f.stop.refreshSource(),error=>error.status===code);assert.equal(f.writes,1,'Manual clicks also respect shared backoff');
   assert.ok(f.published.every(row=>row.lastSuccessAt===saved));
   while(f.now<120000)await f.tick();assert.ok(f.writes>=2,'A bounded later check may retry source admission');
  }finally{f.close();}
 }
});
test('expired, revoked and forbidden source sessions stop automatic attempts',async()=>{
 for(const code of [409,401,403]){
  const f=fixture({source:async()=>{throw Object.assign(new Error('Reconnect'),{status:code});}});try{
   assert.equal(typeof f.stop.refreshSource,'function');await assert.rejects(f.stop.refreshSource());
   for(let i=0;i<4 && f.tasks.size;i++)await f.tick();assert.equal(f.writes,1);
  }finally{f.close();}
 }
});
test('logout and account generation changes fence a delayed source response',async()=>{
 let release;const f=fixture({source:()=>new Promise(resolve=>{release=resolve;})});try{
  assert.equal(typeof f.stop.refreshSource,'function');const pending=f.stop.refreshSource();await settle();f.invalidate();f.stop();release({queued:true,syncStatus:status({state:'syncing'})});await pending;await settle();assert.equal(f.published.length,0);assert.equal(f.applied.length,0);assert.equal(f.tasks.size,0);
 }finally{f.close();}
});

test('a logout before queued admission begins prevents dispatching the source POST',async()=>{
 const f=fixture();try{const pending=f.stop.refreshSource();f.invalidate();await pending;assert.equal(f.writes,0);assert.equal(f.published.length,0);}finally{f.close();}
});
test('manual-only still permits one explicit sync and offline explicit sync performs no write',async()=>{
 const f=fixture({refreshSeconds:0});try{navigator.onLine=false;await assert.rejects(f.stop.refreshSource());assert.equal(f.writes,0);navigator.onLine=true;await f.stop.refreshSource();assert.equal(f.writes,1);}finally{f.close();}
});
test('unavailable source capability stops idle timers without inventing a new success time',async()=>{
 const f=fixture();try{f.setStatus(status({sourceSession:{state:'reconnect_required',refreshAvailable:false,expiresInSeconds:0}}));await f.tick();assert.equal(f.tasks.size,0);assert.equal(f.writes,0);assert.equal(f.published.at(-1).lastSuccessAt,saved);}finally{f.close();}
});

test('manual-only idle sessions do no background status reads, including focus events',async()=>{
 const f=fixture({refreshSeconds:0});try{assert.equal(f.tasks.size,0);f.browser.window.dispatchEvent(new Event('focus'));await settle();assert.equal(f.reads,0);await f.stop.refreshSource();assert.ok(f.tasks.size);await f.tick();assert.equal(f.reads,1);assert.equal(f.tasks.size,0);}finally{f.close();}
});
test('an authoritative status without capability cannot reuse old active status for automatic source work',async()=>{
 const old=status(),f=fixture({readStatus:async()=>{const {sourceSession,...saved}=old;return saved;}});try{for(let i=0;i<8;i++)await f.tick();assert.equal(f.writes,0);assert.equal(f.published.at(-1).sourceSession,undefined);}finally{f.close();}
});

test('manual job progress survives an older idle status response and an overlapping progress timer',async()=>{
 let resolveOld,calls=0;
 const finished=status({state:'partial',modules:[{id:'profile',lastSuccessAt:'2026-10-28T10:05:00Z',recordCount:2}]});
 const f=fixture({refreshSeconds:0,readStatus:()=>++calls===1?new Promise(resolve=>{resolveOld=resolve;}):Promise.resolve(finished)});
 try{
  await f.stop.refreshSource();
  const oldRead=f.tick();await settle();
  await f.stop.refreshSource();await f.tick();
  resolveOld(status({state:'idle'}));await oldRead;
  assert.equal(f.published.at(-1).state,'syncing','pre-admission idle response cannot replace the accepted job');
  assert.ok(f.tasks.size,'overlapping poll must retain a follow-up progress check');
  await f.tick();assert.equal(f.workspaceReads,1);assert.equal(f.published.at(-1).state,'partial');assert.equal(f.tasks.size,0);
 }finally{f.close();}
});

test('manual job retries a transient progress-read failure and applies completed records',async()=>{
 let calls=0;
 const finished=status({state:'partial',modules:[{id:'profile',lastSuccessAt:'2026-10-28T10:06:00Z',recordCount:3}]});
 const f=fixture({refreshSeconds:0,readStatus:async()=>{if(++calls===1)throw new Error('temporary network timeout');return finished;}});
 try{
  await f.stop.refreshSource();await f.tick();
  assert.ok(f.tasks.size,'manual-only progress must keep its bounded retry after a network failure');
  assert.equal(f.published.at(-1).state,'syncing');await f.tick();
  assert.equal(f.workspaceReads,1);assert.equal(f.published.at(-1).state,'partial');assert.equal(f.tasks.size,0);
 }finally{f.close();}
});

test('a rejected university session cannot be revived by an older active status reply',async()=>{
 let calls=0,resolveOld;
 const f=fixture({refreshSeconds:0,source:async()=>{if(++calls===1)return {queued:true,syncStatus:status({state:'syncing'})};throw Object.assign(new Error('source expired'),{status:409});},readStatus:()=>new Promise(resolve=>{resolveOld=resolve;})});
 try{
  await f.stop.refreshSource();const oldRead=f.tick();await settle();
  await assert.rejects(f.stop.refreshSource(),/source expired/);resolveOld(status({state:'idle'}));await oldRead;
  assert.equal(f.published.at(-1).sourceSession.refreshAvailable,false);
  assert.notEqual(f.published.at(-1).state,'syncing');assert.equal(f.tasks.size,0);
 }finally{f.close();}
});
