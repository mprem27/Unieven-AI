import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {csv} from '../src/lib/download.js';

test('completed-seat preview CSV round-trips through contextual importer with the examination subject',async()=>{
 const {seatingExportRows}=await import('../../shared/seating-import.mjs');
 const original={vtuNumber:'VTU00001',hall:'Main, East',room:'A101',seat:'S1',reportingTime:'09:00',notes:'Carry "ID"'};
 const exported=csv(seatingExportRows('CS-101',[original]));
 const result=spawnSync('python',['-c',"import sys,json;from app.services.exam_seating import parse_seating_file;print(json.dumps(parse_seating_file('preview.csv',sys.stdin.buffer.read(),course_code='CS101')))"],{cwd:fileURLToPath(new URL('../../services/academic/',import.meta.url)),input:exported,encoding:'utf8'});
 assert.equal(result.status,0,result.stderr);
 const parsed=JSON.parse(result.stdout);assert.deepEqual(parsed.issues,[]);assert.equal(parsed.rows.length,1);
 assert.deepEqual(parsed.rows[0],{...original,name:'',courseCode:'CS-101',sourceRow:2});
 assert.deepEqual(seatingExportRows('CS-101',[])[0],['Course Code','VTU Number','Name','Hall','Room','Seat','Reporting Time','Notes']);
});
