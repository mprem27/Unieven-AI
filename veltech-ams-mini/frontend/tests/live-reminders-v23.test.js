import test from 'node:test';
import assert from 'node:assert/strict';
import {liveClassStatus} from '../src/lib/live-reminders.js';
import {scheduleAt} from '../src/lib/schedule.js';
// Authentic AMS producer shape: _split_time_slot('1.45-2.35 PM') emits
// startTime='1:45 PM', endTime='2:35 PM', alongside numeric minutes.
const ams={id:'ams-pm',day:'Monday',subjectName:'Networks',startTime:'1:45 PM',endTime:'2:35 PM',startMinutes:825,endMinutes:875,room:'A101',source:'ams'};
test('authentic AMS meridiem intervals yield current and next classes in IST',()=>{
 const result=liveClassStatus({clock:'2026-10-26T14:00:00+05:30',timetable:[ams,{...ams,id:'next',startTime:'2:45 PM',endTime:'3:35 PM'}]});
 assert.equal(result.current?.id,'ams-pm');assert.equal(result.current.startTime,'13:45');assert.equal(result.next?.startTime,'14:45');assert.equal(result.current.room,'A101');assert.equal(result.current.source,'ams');
 assert.equal(liveClassStatus({clock:'2026-10-26T14:35:00+05:30',timetable:[ams]}).current,null);
});
test('source time normalization handles noon midnight and single-digit hours without guessing',()=>{
 const rows=[{id:'a',startTime:'12:00 AM',endTime:'1:00 AM'},{id:'b',startTime:'12:00 PM',endTime:'1:00 PM'},{id:'c',startTime:'8:45 AM',endTime:'9:35 AM'},{id:'bad',startTime:'13:45 PM',endTime:'14:35 PM'},{id:'unknown',startTime:null,endTime:null,startMinutes:825,endMinutes:875}];
 assert.equal(scheduleAt(rows,'2026-10-26','00:00').current?.id,'a');assert.equal(scheduleAt(rows,'2026-10-26','12:30').current?.id,'b');assert.equal(scheduleAt(rows,'2026-10-26','08:50').current?.id,'c');assert.equal(scheduleAt(rows,'2026-10-26','09:35').unknown.length,2);
});
test('published upcoming special classes work without an AMS timetable',()=>{
 const result=liveClassStatus({clock:'2026-10-25T09:00:00+05:30',policies:[{id:'lab',date:'2026-10-26',mode:'special',classes:[{courseName:'Published lab',startTime:'09:00',endTime:'10:00',room:'Lab'}]}]});
 assert.equal(result.next?.subjectName,'Published lab');assert.equal(result.next.date,'2026-10-26');
});
test('stale resolved day cannot suppress refreshed authoritative source rows',()=>{
 const result=liveClassStatus({clock:'2026-10-26T14:00:00+05:30',timetable:[ams],policies:[],dayInfo:{date:'2026-10-26',source:'administrator',kind:'holiday',classes:[]}});
 assert.equal(result.current?.id,'ams-pm');
});
test('whitespace in a source weekday does not hide an otherwise confirmed class',()=>{
 assert.equal(liveClassStatus({clock:'2026-10-26T14:00:00+05:30',timetable:[{...ams,day:' monday '}]}).current?.id,'ams-pm');
});
