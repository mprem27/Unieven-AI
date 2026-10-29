import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const source=fs.readFileSync(new URL('../public/notification-handler.js',import.meta.url),'utf8');
function runtime(){const handlers={},shown=[],opened=[],self={location:{origin:'https://campus.example.test'},registration:{showNotification:async(title,options)=>shown.push({title,options})},clients:{matchAll:async()=>[],openWindow:async url=>opened.push(url)},addEventListener:(name,fn)=>{handlers[name]=fn;}};vm.runInNewContext(source,{self,URL});return {handlers,shown,opened};}
test('push events render supplied safe context and honor the server silent flag',async()=>{
 const r=runtime();let work;r.handlers.push({data:{json:()=>({title:'Campus update',body:'Read your inbox',url:'/#/attendance',silent:true})},waitUntil:promise=>work=promise});await work;
 assert.equal(r.shown[0].title,'Campus update');assert.equal(r.shown[0].options.silent,true);assert.equal(r.shown[0].options.data.url,'https://campus.example.test/#/attendance');
});
test('notification clicks retain an internal destination and reject external URLs',async()=>{
 const r=runtime();let work;r.handlers.notificationclick({notification:{data:{url:'/#/events/one'},close(){}},waitUntil:promise=>work=promise});await work;
 assert.equal(r.opened[0],'https://campus.example.test/#/events/one');
 r.handlers.notificationclick({notification:{data:{url:'https://untrusted.example.test/phish'},close(){}},waitUntil:promise=>work=promise});await work;
 assert.equal(r.opened[1],'https://campus.example.test/#/notifications');
});
test('clicking a received push preserves its already normalized deep link',async()=>{
 const r=runtime();let work;r.handlers.push({data:{json:()=>({title:'Campus update',link:'/attendance',message:'Open the inbox.',silent:true})},waitUntil:promise=>work=promise});await work;
 r.handlers.notificationclick({notification:{data:r.shown[0].options.data,close(){}},waitUntil:promise=>work=promise});await work;
 assert.equal(r.opened[0],'https://campus.example.test/#/attendance');
});
