import test from 'node:test';
import assert from 'node:assert/strict';
import {notificationChanges,notificationLink,notificationGroups,notificationCategory,normalizeAlertPreferences,isQuietHours,shouldPlayForegroundSound,readAlertPreferences,saveAlertPreferences} from '../src/lib/notifications.js';
test('first refresh and account switch establish a baseline without leaking alerts',()=>{
 const first=notificationChanges(null,'alpha',[{id:'one',read:false}]);assert.deepEqual(first.newUnread,[]);
 const switched=notificationChanges(first.state,'beta',[{id:'two',read:false}]);assert.deepEqual(switched.newUnread,[]);
});
test('seen history survives partial refreshes and same IDs in different sources are separate',()=>{
 const first=notificationChanges(null,'owner',[{id:'same',source:'social'}]);
 const empty=notificationChanges(first.state,'owner',[]);
 assert.deepEqual(notificationChanges(empty.state,'owner',[{id:'same',source:'social'}]).newUnread,[]);
 assert.deepEqual(notificationChanges(first.state,'owner',[{id:'same',source:'academic'}]).newUnread,['same']);
});
test('context destinations are internal and link to the actual subject of the update',()=>{
 assert.equal(notificationLink({link:'https://outside.invalid/private',postId:'one'}),'/community/posts/one');
 assert.equal(notificationLink({link:'//outside.invalid'}),'/notifications');
 assert.equal(notificationLink({type:'ATTENDANCE_ABSENT',source:'academic'}),'/attendance');
 assert.equal(notificationLink({noticeId:'notice'}),'/notifications?notice=notice');
 assert.equal(notificationCategory({type:'app_feedback_reply',source:'social',category:'system'}),'app');
});
test('groups sort by actual dates and invalid/missing dates remain harmless',()=>{
 const groups=notificationGroups([{id:'old'},{id:'today',createdAt:'2026-10-19T09:00:00Z'},{id:'week',createdAt:'2026-10-17T09:00:00Z'}],new Date('2026-10-19T10:00:00Z'));
 assert.deepEqual(groups.map(group=>group.label),['Today','This week','Earlier']);
});
test('sound is opt-in, foreground-only, and honors silent plus overnight quiet hours',()=>{
 const night=new Date('2026-10-19T18:00:00Z'),day=new Date('2026-10-19T09:00:00Z'),prefs={soundEnabled:true,quietHoursEnabled:true,timeZone:'Asia/Kolkata'};
 assert.equal(shouldPlayForegroundSound({}),false);assert.equal(shouldPlayForegroundSound(prefs,{now:day}),true);
 assert.equal(shouldPlayForegroundSound(prefs,{now:day,visible:false}),false);assert.equal(shouldPlayForegroundSound({...prefs,silent:true},{now:day}),false);
 assert.equal(isQuietHours(prefs,night),true);assert.equal(shouldPlayForegroundSound(prefs,{now:night}),false);
 assert.equal(isQuietHours({...prefs,quietHoursStart:'09:00',quietHoursEnd:'17:00'},day),true);
 assert.equal(normalizeAlertPreferences({soundEnabled:'true',quietHoursStart:'25:99',timeZone:'invalid'}).soundEnabled,false);
});
test('device sound preferences are isolated across accounts and survive reload',()=>{
 const data=new Map(),storage={getItem:key=>data.get(key),setItem:(key,value)=>data.set(key,value)};
 saveAlertPreferences('alpha',{soundEnabled:true,silent:true},storage);assert.equal(readAlertPreferences('alpha',storage).soundEnabled,true);assert.equal(readAlertPreferences('beta',storage).soundEnabled,false);
});
test('new unread notification is alerted once and old or read entries are ignored',()=>{
 const first=notificationChanges(null,'alpha',[{id:'one',read:false}]);
 const items=[{id:'one',read:false},{id:'two',read:false},{id:'three',read:true}];
 const next=notificationChanges(first.state,'alpha',items);assert.deepEqual(next.newUnread,['two']);
 assert.deepEqual(notificationChanges(next.state,'alpha',items).newUnread,[]);
});
