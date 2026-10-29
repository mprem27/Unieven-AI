import test from 'node:test';
import assert from 'node:assert/strict';
import {createMediaGesture} from '../src/lib/media-gesture.js';
import {demoActivity,archiveDemoContent} from '../src/lib/activity.js';
import {buildMixedFeed} from '../src/lib/community.js';

function gestureHarness(){let time=0,single=0,liked=0,timer=null;const gesture=createMediaGesture({single:()=>single++,like:()=>liked++,now:()=>time,schedule:fn=>{timer=fn;return 1;},cancel:()=>{timer=null;}});return {gesture,advance:ms=>time+=ms,flush:()=>{const fn=timer;timer=null;fn?.();},counts:()=>({single,liked})};}
test('double click likes once and cancels delayed single playback action',()=>{const h=gestureHarness();h.gesture.click(1);h.gesture.click(2);h.gesture.doubleClick();h.flush();assert.deepEqual(h.counts(),{single:0,liked:1});});
test('single click pauses or plays after the double tap window and cleanup cancels it',()=>{const h=gestureHarness();h.gesture.click(1);assert.deepEqual(h.counts(),{single:0,liked:0});h.flush();assert.equal(h.counts().single,1);h.gesture.click(1);h.gesture.dispose();h.flush();assert.equal(h.counts().single,1);});
test('touch double tap likes once without its synthesized click pausing video',()=>{const h=gestureHarness();h.gesture.touch({x:10,y:20});h.advance(150);h.gesture.touch({x:12,y:22});h.gesture.click(1);h.gesture.doubleClick();h.flush();assert.deepEqual(h.counts(),{single:0,liked:1});h.advance(1000);h.gesture.touch({x:10,y:20});h.flush();assert.equal(h.counts().single,1);});
test('demo activity scopes archive, filters hidden bookmarks, and restores original data',()=>{
 const data={profile:{id:'me'},people:[{id:'private',isPrivate:true}],posts:[{id:'own',author:{id:'me'},text:'My idea'},{id:'saved',saved:true,liked:true,author:{id:'public'}},{id:'secret',saved:true,author:{id:'private'}}],reels:[{id:'reel',author:{id:'me'},caption:'Mine'}],storyArchive:[{id:'story',author:{id:'me'}},{id:'foreign',author:{id:'other'}}]};
 assert.equal(demoActivity(data,'own').posts.length,1);assert.equal(demoActivity(data,'saved').posts.length,1);assert.equal(demoActivity(data,'liked').posts.length,1);
 archiveDemoContent(data,'post','own',true);archiveDemoContent(data,'reel','reel',true);
 assert.equal(demoActivity(data,'own').posts.length,0);assert.equal(demoActivity(data,'archive').posts[0].id,'own');assert.equal(demoActivity(data,'archive').reels[0].id,'reel');assert.equal(demoActivity(data,'archive').stories.length,1);
 archiveDemoContent(data,'post','own',false);assert.equal(demoActivity(data,'own').posts[0].text,'My idea');assert.throws(()=>archiveDemoContent(data,'post','saved',true),/own/);
});
test('mixed feed excludes archives and interleaves a ranked run of posts with available reels',()=>{
 const posts=Array.from({length:6},(_,id)=>({id:`p${id}`})),reels=[{id:'r1'},{id:'r2'}],recommended=posts.map(item=>({kind:'post',item}));
 const mixed=buildMixedFeed([...posts,{id:'hidden',isArchived:true}],reels,recommended);
 assert.equal(mixed.length,8);assert.equal(mixed[2].kind,'reel');assert.equal(mixed[5].kind,'reel');assert.ok(!mixed.some(x=>x.item.id==='hidden'));
});
