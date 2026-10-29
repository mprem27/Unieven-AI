import test from 'node:test';
import assert from 'node:assert/strict';
import {createNotificationOverlay} from '../src/lib/notification-overlay.js';
const items=[{id:'same',source:'academic',read:false},{id:'same',source:'social',isRead:false}];
const deferred=()=>{let resolve,reject;const promise=new Promise((ok,no)=>{resolve=ok;reject=no;});return {promise,resolve,reject};};
test('read and delete apply immediately without replacing workspace data; failure restores the previous overlay',async()=>{
 const calls=[],next=deferred(),errors=[];
 const overlay=createNotificationOverlay({request:(path,options)=>{calls.push([path,options]);return next.promise;},isCurrent:()=>true,onError:error=>errors.push(error)});
 const action=overlay.update(items[0],'read');assert.equal(overlay.apply(items)[0].read,true);assert.equal(items[0].read,false);assert.equal(overlay.apply(items)[1].isRead,false);
 next.reject(new Error('Offline'));await action;assert.equal(overlay.apply(items)[0].read,false);assert.deepEqual(errors,['Offline']);assert.equal(calls[0][0],'/academics/notifications/same/read');
 const success=createNotificationOverlay({request:async()=>{},isCurrent:()=>true});await success.update(items[0],'read');await success.update(items[0],'delete');assert.equal(success.apply(items).length,1);
});
test('partially failed mark all read rolls back only the failed source and handles colliding IDs',async()=>{
 const calls=[];const overlay=createNotificationOverlay({request:async path=>{calls.push(path);if(path==='/notifications/read-all')throw new Error('Social unavailable');},isCurrent:()=>true});
 await overlay.allRead(items);const result=overlay.apply(items);assert.equal(result[0].read,true);assert.equal(result[1].isRead,false);assert.equal(overlay.pending(),false);assert.deepEqual(calls.sort(),['/academics/notifications/read','/notifications/read-all']);
});
test('late mutation failures cannot notify, rollback, or update a switched owner',async()=>{
 const next=deferred();let owner='alpha',notices=0,changes=0;
 const old=createNotificationOverlay({request:()=>next.promise,isCurrent:()=>owner==='alpha',onError:()=>notices++});old.subscribe(()=>changes++);
 const action=old.update(items[0],'delete');assert.equal(changes,1);owner='beta';old.dispose();
 const current=createNotificationOverlay({request:async()=>{},isCurrent:()=>owner==='beta'});assert.equal(current.apply(items).length,2);
 owner='alpha';next.reject(new Error('Late response'));await action;assert.equal(notices,0);assert.equal(changes,1);assert.equal(current.apply(items).length,2);
});
test('delete failure preserves a previously successful read and duplicate pending clicks coalesce',async()=>{
 const next=deferred();let count=0;const overlay=createNotificationOverlay({request:()=>++count===1?Promise.resolve():next.promise,isCurrent:()=>true});
 await overlay.update(items[0],'read');const action=overlay.update(items[0],'delete');await overlay.update(items[0],'delete');assert.equal(count,2);next.reject(new Error('Delete failed'));await action;assert.equal(overlay.apply(items)[0].read,true);
});
test('successful mutations withstand an older poll while new updates remain unread',async()=>{
 const overlay=createNotificationOverlay({request:async()=>{},isCurrent:()=>true});await overlay.allRead(items);
 const polled=[...items,{id:'new',source:'social',read:false}];assert.deepEqual(overlay.apply(polled).map(item=>item.read ?? item.isRead),[true,true,false]);
});
