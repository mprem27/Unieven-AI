import test from 'node:test';
import assert from 'node:assert/strict';
import {attendanceStatus,attendancePercent,classesNeeded,matchesSubject,sortClasses,normalizeCourse,recordForClass} from '../src/lib/attendance.js';
test('confirmed present and absent use their source states',()=>{
 assert.equal(attendanceStatus({status:'present',date:'2026-10-14',startTime:'09:00'},'2026-10-14','12:00'),'present');
 assert.equal(attendanceStatus({status:'absent',date:'2026-10-14',startTime:'10:00'},'2026-10-14','12:00'),'absent');
});
test('future unmarked classes are upcoming and past unmarked classes remain unknown',()=>{
 assert.equal(attendanceStatus({date:'2026-10-14',startTime:'14:00',endTime:'16:00'},'2026-10-14','12:00'),'upcoming');
 assert.equal(attendanceStatus({date:'2026-10-14',startTime:'10:00',endTime:'11:00'},'2026-10-14','12:00'),'unknown');
 assert.equal(attendanceStatus({date:'2026-10-14',startTime:'11:15',endTime:'12:15'},'2026-10-14','12:00'),'in-progress');
 assert.equal(attendanceStatus({status:'absent',date:'2026-10-15',startTime:'09:00'},'2026-10-14','12:00'),'upcoming');
});
test('zero classes has no invented percentage',()=>{
 assert.equal(attendancePercent(0,0),null);assert.equal(attendancePercent(8,10),80);
});
test('calculator finds enough consecutive classes to reach 75 percent',()=>{
 assert.equal(classesNeeded(7,10,75),2);assert.equal(classesNeeded(8,10,75),0);
 assert.equal(classesNeeded(0,10,75),30);assert.equal(classesNeeded(7,10,100),Infinity);
});
test('missing course identifiers never cause unrelated attendance to match',()=>{
 assert.equal(matchesSubject({subjectId:'A'},{subjectId:'B'}),false);
 assert.equal(matchesSubject({},{}),false);
 assert.equal(matchesSubject({subjectCode:null},{subjectCode:null}),false);
 assert.equal(matchesSubject({subjectId:'A'},{subjectId:'A'}),true);
 assert.equal(matchesSubject({subjectId:'A',subjectCode:'CS1'},{subjectId:'B',subjectCode:'CS1'}),true);
});
test('portal timetable tolerates unknown class times without crashing',()=>{
 assert.deepEqual(sortClasses([{id:'unknown',startTime:null},{id:'late',startTime:'14:00'},{id:'early',startTime:'09:00'}]).map(x=>x.id),['early','late','unknown']);
});
test('AMS course field names normalize consistently for display and export',()=>{
 const course=normalizeCourse({courseName:'Networking',courseCode:'CS1',credit:3});
 assert.equal(course.name,'Networking');assert.equal(course.code,'CS1');assert.equal(course.credits,3);
});
test('repeated courses require a matching period and conflicting records remain unknown',()=>{
 const classes=[{subjectCode:'CS101',period:'P1'},{subjectCode:'CS101',period:'P2'}];
 const records=[{subjectCode:'CS101',date:'2026-10-14',period:'P1',status:'present'},{subjectCode:'CS101',date:'2026-10-14',period:'P2',status:'absent'}];
 assert.equal(recordForClass(classes[0],records,classes,'2026-10-14').status,'present');
 assert.equal(recordForClass(classes[1],records,classes,'2026-10-14').status,'absent');
 assert.equal(recordForClass(classes[0],[{...records[0],period:undefined}],classes,'2026-10-14'),null);
 assert.equal(recordForClass(classes[0],[records[0],{...records[0],status:'absent'}],classes,'2026-10-14'),null);
 assert.equal(recordForClass(classes[0],[{...records[0],period:undefined}],[classes[0]],'2026-10-14').status,'present');
});
test('on duty remains distinct from present and absent',()=>{
 assert.equal(attendanceStatus({status:'on-duty',date:'2026-10-14'},'2026-10-14','12:00'),'on-duty');
});
