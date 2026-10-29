import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {transformWithOxc} from 'vite';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {resolveAcademicDay} from '../src/lib/academic-calendar.js';
import {recordForClass} from '../src/lib/attendance.js';

// Compile the real components, replacing only browser hooks and their UI boundary.
const stub=code=>'data:text/javascript;base64,'+Buffer.from(code).toString('base64');
async function loadJsx(relative,replacements={}){
 const file=new URL(relative,import.meta.url);let source=await fs.readFile(file,'utf8');
 source=source.replace(/^import\s+['"][^'"]+\.css['"];?$/gm,'');
 source=source.replace(/from\s+(['"])([^'"]+)\1/g,(_match,_quote,path)=>{
  const target=replacements[path] || (path.startsWith('.')?new URL(path+(/\.(?:m?js|jsx)$/.test(path)?'':'.js'),file).href:import.meta.resolve(path));
  return `from ${JSON.stringify(target)}`;
 });
 const {code}=await transformWithOxc(source,file.pathname,{jsx:{runtime:'automatic'}});
 return import(stub(code.replace(/from "react\/jsx-runtime"/g,`from ${JSON.stringify(import.meta.resolve('react/jsx-runtime'))}`)));
}
const reminders=await loadJsx('../src/components/CampusReminders.jsx',{
 '../context/CampusContext':stub('export const useCampus=()=>globalThis.__calendarFixture.campus'),
 '../hooks/useLiveResource':stub('export const useLiveResource=path=>({value:globalThis.__calendarFixture.resources[path]})'),
 './UI':stub(`import {createElement} from ${JSON.stringify(import.meta.resolve('react'))};export const Button=({children,...props})=>createElement('button',props,children)`),
});
const context=await loadJsx('../src/context/CampusContext.jsx',{
 './AppPreferences':stub('export const useAppPreferences=()=>({preferences:{refreshSeconds:0}})'),
});
function render({today='2026-10-16',policies=[],sourceExams=[],matchedExams=[],publications=[],seating=[]}={}){
 globalThis.__calendarFixture={campus:{today,mode:'connected',data:{profile:{officialProfile:{semester:'5',section:'A'}},calendarPolicies:policies,academic:{examinations:sourceExams}}},resources:{'/academics/faculty-exams':{examinations:matchedExams},'/schedules':{schedules:publications},'/academics/exam-seating':{seating}}};
 return renderToStaticMarkup(createElement(reminders.default,{navigate(){}}));
}
test('home examination reminders display only server-matched administrator examinations',()=>{
 const html=render({sourceExams:[{id:'ams',name:'Old AMS announcement',date:'2026-10-17'}],matchedExams:[{id:'published',title:'Verified university exam',date:'2026-10-18',courseCode:'CS101',startTime:'09:00',semester:'6',section:'B'}]});
 assert.doesNotMatch(html,/Old AMS announcement/);assert.match(html,/Verified university exam/);
});
test('upcoming calendar reminders choose the closest actual date and show weekday plus followed timetable',()=>{
 const html=render({policies:[{id:'past',date:'2026-10-15',mode:'holiday',label:'Past update',updatedAt:'2030-01-01'}, {id:'future',date:'2026-10-19',mode:'holiday',label:'Later holiday'}, {id:'sat',date:'2026-10-17',mode:'follow-day',followDay:'Monday',label:'Substitute working day'}]});
 assert.match(html,/2026-10-17/);assert.match(html,/Saturday/);assert.match(html,/Monday timetable/);assert.match(html,/Substitute working day/);assert.doesNotMatch(html,/Past update/);
 assert.ok(html.indexOf('Substitute working day')<html.indexOf('Later holiday'));
});
test('Sunday holiday reminder states the actual day and removes stale schedule publications',()=>{
 const html=render({today:'2026-10-18',policies:[{id:'sun',date:'2026-10-18',mode:'holiday',label:'University holiday',reason:'Campus closed'}],publications:[{id:'expired',kind:'semester',title:'Expired schedule',validFrom:'2026-01-01',validTo:'2026-10-17'},{id:'valid',kind:'semester',title:'Current timetable',validFrom:'2026-10-18',validTo:'2026-12-31',updatedAt:'2026-10-18T06:00:00Z'}]});
 assert.match(html,/TODAY/);assert.match(html,/Sunday/);assert.match(html,/2026-10-18/);assert.match(html,/University holiday/);assert.match(html,/Campus closed/);assert.match(html,/Current timetable/);assert.doesNotMatch(html,/Expired schedule/);
});
test('calendar follow-day keeps actual-date attendance distinct from the source weekday',()=>{
 const row={id:'monday',day:'Monday',subjectCode:'CS101',startTime:'09:00',endTime:'10:00',status:'present'};
 const day=resolveAcademicDay({date:'2026-10-17',classes:[row],policies:[{date:'2026-10-17',scope:'college',mode:'follow-day',followDay:'Monday'}]});
 const records=[{subjectCode:'CS101',date:'2026-10-12',startTime:'09:00',status:'present'},{subjectCode:'CS101',date:'2026-10-17',startTime:'09:00',status:'absent'}];
 assert.equal(day.classes[0].date,'2026-10-17');assert.equal(day.classes[0].status,undefined);assert.equal(recordForClass(day.classes[0],records,day.classes,'2026-10-17').status,'absent');
 assert.deepEqual(resolveAcademicDay({date:'2026-10-18',classes:[{...row,day:'Sunday'}],policies:[{date:'2026-10-18',mode:'holiday',scope:'college'}]}).classes,[]);
});
const settle=()=>new Promise(resolve=>setImmediate(resolve));
test('calendar reads coalesce concurrent workspace and policy refreshes and abort on account change',async()=>{
 assert.equal(typeof context.createCalendarReader,'function');
 const calls=[];
 const reader=context.createCalendarReader((path,{signal})=>new Promise(resolve=>calls.push({path,signal,resolve})));
 const first=reader.read('connected:first','/timetable-rooms'),shared=reader.read('connected:first','/timetable-rooms');
 assert.equal(calls.length,1);assert.equal(first,shared);
 const next=reader.read('connected:next','/timetable-rooms');
 assert.equal(calls[0].signal.aborted,true);assert.equal(calls.length,2);
 calls[0].resolve({entries:['old']});await first;
 calls[1].resolve({entries:['new']});assert.deepEqual(await next,{entries:['new']});
 const pending=reader.read('connected:next','/timetable-rooms');reader.invalidate('connected:first');assert.equal(calls[2].signal.aborted,false);
 reader.invalidate('connected:next');assert.equal(calls[2].signal.aborted,true);calls[2].resolve({entries:[]});await pending;
});
test('lightweight refresh updates calendar and rooms with academic refresh disabled and cleans up focus/interval',async()=>{
 assert.equal(typeof context.startCalendarRefresh,'function');
 const doc=new EventTarget(),win=new EventTarget();doc.visibilityState='visible';
 const calls=[],values=[];let tick,cleared=false,current=true;
 const reader=context.createCalendarReader(async path=>{calls.push(path);return {entries:[path.includes('academic-calendar')?'calendar':'room']};});
 const stop=context.startCalendarRefresh({reader,owner:'connected:first',date:()=> '2026-10-16',isCurrent:()=>current,onValue:(key,value)=>values.push([key,value.entries[0]]),documentTarget:doc,windowTarget:win,schedule:(fn,ms)=>{assert.ok(ms>=20000 && ms<=30000);tick=fn;return 7;},unschedule:id=>{assert.equal(id,7);cleared=true;}});
 await settle();assert.equal(calls.length,2);assert.ok(calls.every(path=>path.startsWith('/academic-calendar?') || path==='/timetable-rooms'));assert.deepEqual(values.map(x=>x[0]).sort(),['calendarPolicies','roomOverrides']);
 win.dispatchEvent(new Event('focus'));await settle();assert.equal(calls.length,4);
 doc.visibilityState='hidden';tick();await settle();assert.equal(calls.length,4);
 doc.visibilityState='visible';doc.dispatchEvent(new Event('visibilitychange'));await settle();assert.equal(calls.length,6);
 current=false;tick();await settle();assert.equal(calls.length,6);
 stop();assert.equal(cleared,true);win.dispatchEvent(new Event('focus'));tick();await settle();assert.equal(calls.length,6);
});
test('an in-flight lightweight refresh never overwrites a changed account',async()=>{
 assert.equal(typeof context.startCalendarRefresh,'function');
 const pending=[],values=[],doc=new EventTarget(),win=new EventTarget();doc.visibilityState='visible';let current=true;
 const reader=context.createCalendarReader((_path,{signal})=>new Promise(resolve=>pending.push({signal,resolve})));
 const stop=context.startCalendarRefresh({reader,owner:'connected:first',date:()=> '2026-10-16',isCurrent:()=>current,onValue:value=>values.push(value),documentTarget:doc,windowTarget:win,schedule:()=>1,unschedule(){}});
 assert.equal(pending.length,2);current=false;stop();assert.ok(pending.every(p=>p.signal.aborted));pending.forEach(p=>p.resolve({entries:['private-old']}));await settle();assert.deepEqual(values,[]);
});

test('home never attaches a different examination session seat to its reminder',()=>{const html=render({matchedExams:[{id:'one',title:'Morning exam',date:'2026-10-18',courseCode:'CS101',startTime:'09:00',endTime:'10:30'}],seating:[{exam:{id:'two',date:'2026-10-18',courseCode:'CS101',startTime:'14:00',endTime:'15:30'},ownSeat:{room:'WRONG_ROOM',seat:'WRONG_SEAT'}}]});assert.doesNotMatch(html,/WRONG_ROOM|WRONG_SEAT/);});
