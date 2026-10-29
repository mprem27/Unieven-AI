import test from 'node:test';
import assert from 'node:assert/strict';
const match=async(...args)=>(await import('../services/seating-matching.js')).matchImportedSeats(...args);
const row=(extra={})=>({sourceRow:4,courseCode:'CS-101',vtuNumber:'',name:'A Student',room:'A1',seat:'S1',...extra});
test('name fallback uses only an unambiguous eligible official name',async()=>{
 const result=await match([row()], 'CS101', [{vtuNumber:'VTU00001',name:' a  student '}]);
 assert.equal(result.rows[0].vtuNumber,'VTU00001');assert.equal(result.review[0].sourceRow,4);
 for(const roster of [[],[{vtuNumber:'VTU00001',name:'A Student'},{vtuNumber:'VTU00002',name:'A Student'}]]){
  const bad=await match([row()], 'CS101',roster);assert.equal(bad.rows.length,0);assert.equal(bad.issues[0].sourceRow,4);
 }
});
test('invalid supplied VTU never falls back to a matching name; duplicate identities fail closed',async()=>{
 assert.equal((await match([row({vtuNumber:'bad'})],'CS101',[{vtuNumber:'VTU00001',name:'A Student'}])).rows.length,0);
 const result=await match([row({vtuNumber:'vtu00001'}),row({sourceRow:5,vtuNumber:'VTU00001'})],'CS101',[]);
 assert.equal(result.rows.length,0);assert.equal(result.issues.length,2);
});
test('missing or different subjects cannot accidentally map to this examination',async()=>{
 for(const courseCode of ['', 'CS1010'])assert.equal((await match([row({courseCode,vtuNumber:'VTU00001'})],'CS101',[])).rows.length,0);
});
