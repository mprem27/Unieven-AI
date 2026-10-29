import test from 'node:test';
import assert from 'node:assert/strict';
import {createAttendancePress} from '../src/lib/attendance-press.js';

function fixture() {
 let clock=0,nextId=0,holds=0;const pending=new Map();
 const press=createAttendancePress({schedule:callback=>{pending.set(++nextId,callback);return nextId;},unschedule:id=>pending.delete(id),now:()=>clock});
 const down={pointerType:'touch',pointerId:1,button:0,clientX:50,clientY:50};
 return {press,down,start:()=>press.start(down,()=>holds++),fire:()=>{for(const [id,callback] of pending){pending.delete(id);callback();}},advance:ms=>clock+=ms,get holds(){return holds;},get timers(){return pending.size;}};
}
test('a stationary touch opens once and suppresses its following pointer click',()=>{
 const f=fixture();f.start();assert.equal(f.timers,1);f.fire();assert.equal(f.holds,1);
 f.press.end(f.down);assert.equal(f.press.consumeClick({detail:1}),true);assert.equal(f.press.consumeClick({detail:1}),false);
 f.fire();assert.equal(f.holds,1);
});
test('pointer up, movement, cancellation and disposal clear the hold timer',()=>{
 for(const action of ['up','move','scroll','dispose']){
  const f=fixture();f.start();
  if(action==='up')f.press.end(f.down);
  if(action==='move')f.press.move({...f.down,clientX:65});
  if(action==='scroll')f.press.cancel();
  if(action==='dispose')f.press.dispose();
  assert.equal(f.timers,0,action);f.fire();assert.equal(f.holds,0,action);
  if(['move','scroll'].includes(action))assert.equal(f.press.consumeClick({detail:1}),true,action);
  if(action==='up')assert.equal(f.press.consumeClick({detail:1}),false,'a normal tap remains clickable');
 }
});
test('other pointers and tiny movement do not cancel; mouse cannot initiate a hold',()=>{
 const f=fixture();f.press.start({...f.down,pointerType:'mouse'},()=>assert.fail('mouse hold'));assert.equal(f.timers,0);
 f.start();f.press.move({...f.down,pointerId:2,clientX:90});f.press.end({...f.down,pointerId:2});
 f.press.move({...f.down,clientX:55,clientY:53});f.fire();assert.equal(f.holds,1);
});
test('keyboard and a new gesture stay available after a hold and suppression expires',()=>{
 const f=fixture();f.start();f.fire();assert.equal(f.press.consumeClick({detail:0}),false);
 f.press.end(f.down);f.advance(1001);assert.equal(f.press.consumeClick({detail:1}),false);
 f.start();f.fire();f.press.start({...f.down,pointerType:'mouse'},()=>{});assert.equal(f.press.consumeClick({detail:1}),false);
});
