import test from 'node:test';
import assert from 'node:assert/strict';
import {canEditContent,buildMixedFeed,withSuggestions,orderForRefresh} from '../src/lib/community.js';

test('owner comment edits expire exactly five minutes after creation and never unlock another author',()=>{
 const createdAt='2026-10-15T09:00:00.000Z',entry={author:{id:'me'},createdAt,canEdit:true};
 assert.equal(canEditContent(entry,'me',Date.parse(createdAt)+299999),true);
 assert.equal(canEditContent(entry,'me',Date.parse(createdAt)+300000),false);
 assert.equal(canEditContent(entry,'other',Date.parse(createdAt)+1000),false);
 assert.equal(canEditContent({...entry,createdAt:undefined},'me',Date.parse(createdAt)),false);
});
test('mixed feed resolves current data and includes items missing from recommendations without duplicates',()=>{
 const posts=[{id:'p1',text:'new'},{id:'p2'}],reels=[{id:'r1'}];
 const feed=buildMixedFeed(posts,reels,[{kind:'post',item:{id:'p1',text:'old'},reasons:['Recent']},{kind:'post',item:{id:'p1'}},{kind:'reel',item:{id:'r1'}}]);
 assert.equal(feed.length,3);assert.equal(feed[0].item.text,'new');assert.equal(feed[1].kind,'reel');assert.equal(feed[2].item.id,'p2');
});
test('refresh changes a multi-item order while preserving every item',()=>{
 const list=Array.from({length:5},(_,id)=>({id}));
 assert.notDeepEqual(orderForRefresh(list,1),orderForRefresh(list,2));
 assert.deepEqual(orderForRefresh(list,2).map(x=>x.id).sort(),[0,1,2,3,4]);
 assert.deepEqual(list.map(x=>x.id),[0,1,2,3,4]);
});
test('suggestions appear between content and do not repeat members',()=>{
 const feed=Array.from({length:7},(_,id)=>({kind:'post',item:{id}}));
 const mixed=withSuggestions(feed,[{id:'a'},{id:'b'},{id:'c'},{id:'a'}]);
 assert.equal(mixed[2].kind,'suggestions');assert.equal(mixed[2].members.length,3);
 assert.equal(mixed.filter(x=>x.kind==='post').length,7);
 assert.equal(mixed.filter(x=>x.kind==='suggestions').length,1);
});
