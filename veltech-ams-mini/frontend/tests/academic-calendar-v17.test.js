import test from 'node:test';
import assert from 'node:assert/strict';
import {resolveAcademicDay,calendarWeekday,calendarDateRange} from '../src/lib/academic-calendar.js';

const monday={id:'monday',day:'Monday',subjectCode:'MA101',subjectName:'Mathematics',startTime:'09:00',endTime:'10:00',source:'ams'};
const saturday={id:'saturday',day:'Saturday',subjectCode:'CS101',startTime:'10:00',endTime:'11:00'};
test('Saturday source classes make a working day; empty Sunday remains a weekend',()=>{
 assert.equal(resolveAcademicDay({date:'2026-10-17',classes:[saturday]}).kind,'working');
 const sunday=resolveAcademicDay({date:'2026-10-18',classes:[monday,saturday]});
 assert.equal(sunday.kind,'weekend');assert.equal(sunday.label,'Sunday · Weekend');assert.deepEqual(sunday.classes,[]);
});
test('a holiday suppresses all ordinary source rows',()=>{
 const day=resolveAcademicDay({date:'2026-10-19',classes:[monday],policies:[{id:'holiday',date:'2026-10-19',mode:'holiday',scope:'college',label:'Festival',reason:'College closed'}]});
 assert.equal(day.kind,'holiday');assert.equal(day.label,'Festival');assert.deepEqual(day.classes,[]);assert.equal(day.source,'administrator');
});
test('follow-day copies only recurring source rows onto the actual date without inventing attendance',()=>{
 const day=resolveAcademicDay({date:'2026-10-17',classes:[monday,saturday,{...monday,id:'dated',date:'2026-10-12',status:'present'}],policies:[{date:'2026-10-17',mode:'follow-day',scope:'college',followDay:'Monday',label:'Monday timetable'}]});
 assert.equal(day.kind,'follow-day');assert.equal(day.sourceDay,'Monday');assert.equal(day.classes.length,1);assert.equal(day.classes[0].date,'2026-10-17');assert.equal(day.classes[0].id,'monday');assert.equal(day.classes[0].status,undefined);assert.equal(day.classes[0].scheduleSource,'administrator');assert.equal(monday.date,undefined);
});
test('targeted special classes override a college holiday without affecting other dates',()=>{
 const day=resolveAcademicDay({date:'2026-10-18',classes:[monday],policies:[{date:'2026-10-18',mode:'holiday',scope:'college',updatedAt:'2026-10-18'}, {id:'special',date:'2026-10-18',mode:'special',scope:'students',label:'Project class',classes:[{courseCode:'CS101',courseName:'Project',startTime:'11:00',endTime:'12:00',room:'Lab',faculty:'Teacher'}]}]});
 assert.equal(day.kind,'special');assert.equal(day.classes.length,1);assert.equal(day.classes[0].subjectCode,'CS101');assert.equal(day.classes[0].subjectName,'Project');assert.equal(day.classes[0].source,'administrator');assert.equal(day.classes[0].status,undefined);
 assert.equal(resolveAcademicDay({date:'2026-10-19',classes:[monday],policies:[day.policy]}).classes[0].id,'monday');
});
test('department takes priority over college, newest update breaks equal priority deterministically',()=>{
 const policies=[{id:'z',date:'2026-10-19',mode:'holiday',scope:'college',label:'College',updatedAt:'2026-10-21'}, {id:'a',date:'2026-10-19',mode:'holiday',scope:'department',label:'Old',updatedAt:'2026-10-17'}, {id:'b',date:'2026-10-19',mode:'follow-day',scope:'department',label:'New',followDay:'Monday',updatedAt:'2026-10-18'}];
 const day=resolveAcademicDay({date:'2026-10-19',classes:[monday],policies});assert.equal(day.label,'New');assert.equal(day.classes.length,1);
 assert.equal(resolveAcademicDay({date:'2026-10-19',classes:[monday],policies:policies.toReversed()}).label,'New');
});
test('dated source rows belong only to their date, and valid dates are required',()=>{
 const dated={id:'date',date:'2026-10-18',day:'Sunday',startTime:'11:00',endTime:'12:00'};
 assert.equal(resolveAcademicDay({date:'2026-10-18',classes:[dated]}).classes.length,1);
 assert.equal(resolveAcademicDay({date:'2026-10-25',classes:[dated]}).classes.length,0);
 assert.throws(()=>calendarWeekday('2026-02-30'),/valid/i);
 assert.deepEqual(calendarDateRange('2026-10-18',{before:1,after:2}),{from:'2026-10-17',to:'2026-10-20'});
});
test('date-specific source rows replace recurring rows on that date without duplicating periods',()=>{
 const day=resolveAcademicDay({date:'2026-10-19',classes:[monday,{...monday,id:'dated-monday',date:'2026-10-19',startTime:'11:00',endTime:'12:00'}]});
 assert.deepEqual(day.classes.map(row=>row.id),['dated-monday']);
});
