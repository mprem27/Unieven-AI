import test,{before,after,beforeEach} from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import {createCampusApp} from '../server.js';
import User from '../../models/User.js';
import {Session,Audit} from '../models.js';
import {hashToken,newToken} from '../security.js';

const origin='http://localhost:5173';
let server,base,admin,coordinator,student,outsider;
const room=(more={})=>({department:'CSE',courseCode:'CS101',courseName:'Computer Science',day:'Monday',startTime:'08:45',endTime:'09:35',date:'',sourceRoom:'A-101',faculty:'Faculty A',room:'B-204',...more});
async function member(username,fields={}){const user=await User.create({username,email:username+'@example.test',password:'unused-test-hash',name:username,...fields});const token=newToken(),csrf=newToken();await Session.create({user:user.id,tokenHash:hashToken(token),csrfToken:csrf,expiresAt:new Date(Date.now()+86400000)});return {user,cookie:'campus_session='+token,csrf};}
async function call(path='/timetable-rooms',{as=admin,method='GET',body,csrf=true,requestOrigin=origin}={}){const response=await fetch(base+path,{method,headers:{Origin:requestOrigin,...(as?{Cookie:as.cookie}:{}),...(body?{'Content-Type':'application/json'}:{}),...(as&&csrf?{'X-CSRF-Token':as.csrf}:{})},body:body?JSON.stringify(body):undefined});return {status:response.status,body:await response.json()};}
before(async()=>{await mongoose.connect(`mongodb://127.0.0.1:27017/campus_test_rooms_v18_${process.pid}`);await Promise.all([User.init(),Session.init()]);server=createCampusApp({origins:[origin],loginLimit:1000}).listen(0);await new Promise(r=>server.once('listening',r));base=`http://127.0.0.1:${server.address().port}/api/campus`;});
after(async()=>{await new Promise(r=>server.close(r));await mongoose.connection.dropDatabase();await mongoose.disconnect();});
beforeEach(async()=>{for(const collection of Object.values(mongoose.connection.collections))await collection.deleteMany({});admin=await member('room-admin',{role:'admin',department:'CSE'});coordinator=await member('room-coordinator',{campusRole:'department_coordinator',department:'CSE'});student=await member('room-student',{department:'CSE'});outsider=await member('room-outsider',{department:'ECE',socialDepartment:'CSE'});});

test('administrator room changes persist, update one exact slot and expose only safe provenance',async()=>{
 const created=await call(undefined,{method:'POST',body:room()});assert.equal(created.status,200);assert.equal(created.body.room,'B-204');assert.equal(created.body.source,'administrator');
 const updated=await call(undefined,{method:'POST',body:room({room:'C-301'})});assert.equal(updated.status,200);assert.equal(updated.body.id,created.body.id);
 const mine=await call(undefined,{as:student});assert.equal(mine.status,200);assert.equal(mine.body.entries.length,1);assert.equal(mine.body.entries[0].room,'C-301');assert.equal(mine.body.canManage,false);
 assert.equal(mine.body.entries[0].createdBy,undefined);assert.equal(mine.body.entries[0].updatedBy,undefined);assert.ok(!JSON.stringify(mine.body).includes(admin.user.id));
 assert.equal(await Audit.countDocuments({action:'timetable-room.update'}),2);
});
test('only active persisted administrators can write, including immediate role revocation',async()=>{
 for(const as of [student,outsider,coordinator])assert.equal((await call(undefined,{as,method:'POST',body:room()})).status,403);
 const created=await call(undefined,{method:'POST',body:room()});assert.equal(created.status,200);
 assert.equal((await call('/timetable-rooms/'+created.body.id,{as:coordinator,method:'DELETE'})).status,403);
 await User.updateOne({_id:admin.user.id},{$set:{role:'student',campusRole:'student'}});
 assert.equal((await call(undefined,{method:'POST',body:room({room:'Revoked'})})).status,403);
 assert.equal((await call('/timetable-rooms/'+created.body.id,{method:'DELETE'})).status,403);
 await User.updateOne({_id:admin.user.id},{$set:{role:'admin',isActive:false}});
 assert.equal((await call(undefined,{method:'POST',body:room()})).status,401);
});
test('reads use assigned department only and reject target selectors without leaking foreign rooms',async()=>{
 assert.equal((await call(undefined,{method:'POST',body:room()})).status,200);
 assert.deepEqual((await call(undefined,{as:outsider})).body.entries,[]);
 await User.updateOne({_id:student.user.id},{$set:{department:'',socialDepartment:'CSE'}});
 assert.deepEqual((await call(undefined,{as:student})).body.entries,[]);
 assert.equal((await call('/timetable-rooms?department=CSE',{as:outsider})).status,400);
 assert.equal((await call('/timetable-rooms?studentId='+student.user.id,{as:outsider})).status,400);
 assert.equal((await call(undefined,{as:null})).status,401);
});
test('room writes validate exact scope, date, times and source selector and preserve CSRF origin checks',async()=>{
 for(const more of [{department:'Unknown'},{department:'',socialDepartment:'CSE'},{courseCode:''},{courseName:''},{day:'Funday'},{startTime:'8:45'},{endTime:'08:00'},{date:'2026-02-30'},{room:''},{room:'x'.repeat(121)},{sourceRoom:{$ne:''}},{faculty:['A']},{studentId:'unverified'},{semester:'4'}])assert.equal((await call(undefined,{method:'POST',body:room(more)})).status,400,JSON.stringify(more));
 assert.equal((await call(undefined,{method:'POST',body:room(),csrf:false})).status,403);
 assert.equal((await call(undefined,{method:'POST',body:room(),requestOrigin:'https://evil.example'})).status,403);
});
test('different source rooms, dates and days remain separate; deletion restores AMS fallback',async()=>{
 const first=await call(undefined,{method:'POST',body:room()});
 for(const more of [{sourceRoom:'D-100'},{date:'2026-10-19'},{day:'Tuesday'}])assert.equal((await call(undefined,{method:'POST',body:room(more)})).status,200);
 assert.equal((await call(undefined,{as:student})).body.entries.length,4);
 assert.equal((await call('/timetable-rooms/'+first.body.id,{method:'DELETE'})).status,200);
 assert.equal((await call(undefined,{as:student})).body.entries.length,3);
 assert.equal((await call('/timetable-rooms/'+first.body.id,{method:'DELETE'})).status,404);
});
test('concurrent changes cannot create competing records for one exact source selector',async()=>{
 const results=await Promise.all([call(undefined,{method:'POST',body:room()}),call(undefined,{method:'POST',body:room({room:'C-301'})})]);
 assert.deepEqual(results.map(r=>r.status),[200,200]);assert.equal((await call(undefined,{as:student})).body.entries.length,1);
});
