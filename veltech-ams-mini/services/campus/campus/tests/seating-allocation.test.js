import test from 'node:test';
import assert from 'node:assert/strict';

async function allocate(students,rooms,options){const module=await import('../services/seating-allocation.js');return module.allocateSeating(students,rooms,options);}
const students=[{vtuNumber:'vtu00002',name:'Two'},{vtuNumber:'VTU00001',name:'One'},{vtuNumber:'VTU00003'}];
test('bulk seating sorts exact VTU identities and fills configured rooms deterministically',async()=>{
 const rooms=[{hall:'Main',room:'A101',capacity:2,seatPrefix:'S'},{hall:'Annex',room:'B1',capacity:2}];
 const result=await allocate(students,rooms,{reportingTime:'09:00'});
 assert.deepEqual(result.rows.map(({vtuNumber,room,seat})=>({vtuNumber,room,seat})),[{vtuNumber:'VTU00001',room:'A101',seat:'S1'},{vtuNumber:'VTU00002',room:'A101',seat:'S2'},{vtuNumber:'VTU00003',room:'B1',seat:'1'}]);
 assert.equal(result.capacity,4);assert.equal(result.unusedSeats,1);assert.equal(result.rows[0].reportingTime,'09:00');assert.equal(result.rows[0].name,undefined);
 assert.deepEqual(await allocate([...students].reverse(),rooms,{reportingTime:'09:00'}),result);
});
test('insufficient room capacity fails without returning partial assignments',async()=>{
 await assert.rejects(allocate(students,[{hall:'Main',room:'A1',capacity:2}]),/capacity.*3|3.*capacity/i);
});
test('duplicate VTUs, room identities and unsafe seat fields are rejected',async()=>{
 await assert.rejects(allocate([students[0],students[0]],[{room:'A1',capacity:2}]),/duplicate|once/i);
 for(const rooms of [[{room:'A1',capacity:2},{room:'a1',capacity:2}],[{room:'A1',capacity:1.5}],[{room:'=bad',capacity:3}],[{room:'A1',capacity:3,seatPrefix:'@bad'}],[{room:'A1',capacity:3,unknown:true}]])await assert.rejects(allocate(students,rooms));
 await assert.rejects(allocate([{vtuNumber:'guess123'}],[{room:'A1',capacity:2}]),/VTU/i);
});
test('room, student and total capacity bounds reject excessive allocations',async()=>{
 await assert.rejects(allocate(students,Array.from({length:101},(_,i)=>({room:`A${i}`,capacity:1}))),/100/);
 await assert.rejects(allocate(students,[{room:'A1',capacity:1001}]),/1,000|1000/);
 await assert.rejects(allocate(students,Array.from({length:6},(_,i)=>({room:`A${i}`,capacity:1000}))),/5,000|5000/);
 await assert.rejects(allocate(Array.from({length:5001},(_,i)=>({vtuNumber:`VTU${String(i).padStart(5,'0')}`})),[{room:'A1',capacity:3}]),/5,000|5000/);
});
test('5,000 explicit roster students fit the bounded room configuration',async()=>{
 const result=await allocate(Array.from({length:5000},(_,i)=>({vtuNumber:`VTU${String(i).padStart(5,'0')}`})),Array.from({length:5},(_,i)=>({hall:'Main',room:`A${i}`,capacity:1000,seatPrefix:'S'})));
 assert.equal(result.rows.length,5000);assert.equal(result.rows.at(-1).seat,'S1000');assert.equal(result.unusedSeats,0);
});
