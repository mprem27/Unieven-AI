import test from 'node:test';
import assert from 'node:assert/strict';
import {swipeDestination,canStartPageSwipe} from '../src/lib/mobile-page-swipe.js';
test('mobile page swipe moves between adjacent root student tabs only',()=>{
 assert.equal(swipeDestination('/home',{x:240,y:330,at:100},{x:100,y:342,at:380}),'/academics');
 assert.equal(swipeDestination('/events',{x:110,y:330,at:100},{x:250,y:342,at:380}),'/academics');
 assert.equal(swipeDestination('/community',{x:240,y:330,at:100},{x:100,y:342,at:380}),null);
 assert.equal(swipeDestination('/events/123',{x:240,y:330,at:100},{x:100,y:342,at:380}),null);
 assert.equal(swipeDestination('/settings/install',{x:240,y:330,at:100},{x:100,y:342,at:380}),null);
});
test('scrolls, slow gestures and short movements do not navigate',()=>{
 const start={x:200,y:200,at:0};
 assert.equal(swipeDestination('/home',start,{x:100,y:300,at:200}),null);
 assert.equal(swipeDestination('/home',start,{x:160,y:200,at:200}),null);
 assert.equal(swipeDestination('/home',start,{x:100,y:200,at:1300}),null);
});
test('native back edges, inputs, media, content menus and horizontal suggestions retain their gestures',()=>{
 const root={nodeType:1,closest:()=>null,parentElement:null,scrollWidth:390,clientWidth:390};
 assert.equal(canStartPageSwipe(root,{x:160,width:390}),true);
 assert.equal(canStartPageSwipe(root,{x:10,width:390}),false);
 assert.equal(canStartPageSwipe(root,{x:160,width:1200}),false);
 const control={...root,closest:()=>({})};
 assert.equal(canStartPageSwipe(control,{x:160,width:390}),false);
 const carousel={...root,scrollWidth:780,clientWidth:320},child={...root,parentElement:carousel};
 assert.equal(canStartPageSwipe(child,{x:160,width:390}),false);
});
