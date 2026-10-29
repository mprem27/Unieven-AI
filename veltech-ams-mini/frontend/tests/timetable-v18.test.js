import test from 'node:test';
import assert from 'node:assert/strict';
import {resolveAcademicDay} from '../src/lib/academic-calendar.js';

const helpers=await import('../src/lib/timetable.js').catch(()=>({}));
const run=(name,...args)=>{assert.equal(typeof helpers[name],'function',`Missing timetable ${name} implementation`);return helpers[name](...args);};
const row={id:'source-1',source:'ams',day:'Monday',subjectCode:'CS101',subjectName:'Computer Science',startTime:'08:45',endTime:'09:35',room:'A-101',faculty:'Faculty A'};
const selector={id:'override-1',department:'CSE',courseCode:'CS101',courseName:'Computer Science',day:'Monday',startTime:'08:45',endTime:'09:35',date:'',sourceRoom:'A-101',faculty:'Faculty A',room:'B-204',source:'administrator'};

test('full grid derives actual source days and distinct time intervals, including Saturday',()=>{
 const source=[row,{...row,id:'saturday',day:'Saturday',startTime:'10:10',endTime:'11:00'}, {...row,id:'long',startTime:'08:45',endTime:'10:25'}];
 const grid=run('buildFullTimetable',source);
 assert.deepEqual(grid.days,['Monday','Saturday']);
 assert.deepEqual(grid.slots.map(slot=>[slot.startTime,slot.endTime]),[['08:45','09:35'],['08:45','10:25'],['10:10','11:00']]);
 assert.equal(grid.rows.length,3);assert.equal(grid.unmapped.length,0);assert.equal(grid.dated.length,0);
 assert.deepEqual(run('buildFullTimetable',[]).slots,[]);
});
test('dated classes and unsupported source times remain explicit instead of inventing grid periods',()=>{
 const dated={...row,id:'dated',date:'2026-10-19'},unknown={...row,id:'unknown',startTime:''},invalid={...row,id:'invalid',endTime:'08:00'};
 const grid=run('buildFullTimetable',[row,dated,unknown,invalid]);
 assert.deepEqual(grid.rows.map(r=>r.id),['source-1']);assert.deepEqual(grid.dated,[dated]);assert.deepEqual(grid.unmapped,[unknown,invalid]);
 assert.equal(grid.slots.length,1);assert.equal(grid.slots[0].startTime,'08:45');
});
test('room updates require one exact source selector and assigned campus department',()=>{
 const changed=run('applyRoomOverrides',[row],[selector],'CSE')[0];
 assert.equal(changed.room,'B-204');assert.equal(changed.amsRoom,'A-101');assert.equal(changed.roomSource,'administrator');assert.equal(changed.roomOverrideId,'override-1');assert.equal(row.room,'A-101');
 for(const [field,value] of [['department','ECE'],['courseCode','CS102'],['courseName','Other title'],['day','Tuesday'],['startTime','09:45'],['sourceRoom','C-101'],['faculty','Faculty B'],['date','2026-10-19']]){
  assert.equal(run('applyRoomOverrides',[row],[{...selector,[field]:value}],'CSE')[0].room,'A-101',field);
 }
 assert.equal(run('applyRoomOverrides',[row],[selector],'')[0].room,'A-101');
 assert.equal(run('applyRoomOverrides',[{...row,source:'student-import'}],[selector],'CSE')[0].room,'A-101');
});
test('ambiguous source rows and competing override rows do not silently choose a room',()=>{
 const duplicate={...row,id:'different-source-id'};
 assert.ok(run('applyRoomOverrides',[row,duplicate],[selector],'CSE').every(r=>r.room==='A-101'));
 assert.equal(run('applyRoomOverrides',[row],[selector,{...selector,id:'competing',room:'C-301'}],'CSE')[0].room,'A-101');
 assert.equal(run('roomSelector',row,[row,duplicate],'CSE'),null);
 assert.equal(run('roomSelector',{...row,subjectCode:''},[row],'CSE'),null);
});
test('follow-day inherits the source room without copying marks and calendar special rooms keep their scope',()=>{
 const classes=run('applyRoomOverrides',[{...row,status:'present'}],[selector],'CSE');
 const follow=resolveAcademicDay({date:'2026-10-17',classes,policies:[{date:'2026-10-17',mode:'follow-day',scope:'college',followDay:'Monday'}]});
 assert.equal(follow.classes[0].room,'B-204');assert.equal(follow.classes[0].date,'2026-10-17');assert.equal(follow.classes[0].status,undefined);
 const special=resolveAcademicDay({date:'2026-10-19',classes,policies:[{date:'2026-10-19',mode:'special',scope:'students',classes:[{...selector,room:'Targeted Lab'}]}]});
 assert.equal(special.classes[0].room,'Targeted Lab');assert.equal(special.classes[0].roomOverrideId,undefined);
 assert.deepEqual(resolveAcademicDay({date:'2026-10-19',classes,policies:[{date:'2026-10-19',mode:'holiday',scope:'college'}]}).classes,[]);
});
test('a dated source room override never changes the recurring or another dated period',()=>{
 const dated={...row,id:'dated',date:'2026-10-19'},other={...row,id:'other',date:'2026-10-26'};
 const changed=run('applyRoomOverrides',[row,dated,other],[{...selector,date:'2026-10-19'}],'CSE');
 assert.deepEqual(changed.map(r=>r.room),['A-101','B-204','A-101']);
});
