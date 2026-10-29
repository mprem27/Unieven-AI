import test,{before,after,beforeEach} from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import {createCampusApp} from '../server.js';
import User from '../../models/User.js';
import {Session,AcademicLink} from '../models.js';
import {hashToken,newToken,encryptToken} from '../security.js';

const origin='http://localhost:5173',range='?from=2026-10-01&to=2026-10-31';
let server,base,admin,coordinator,otherCoordinator,student,peer,outsider;
const officialSnapshots=new Map(),linkKey='a'.repeat(64);
const policy=(more={})=>({date:'2026-10-18',mode:'holiday',label:'College holiday',reason:'Published calendar',scope:'college',...more});
const custom={courseCode:'CS101',courseName:'Project class',startTime:'09:00',endTime:'10:00',room:'Lab',faculty:'Teacher'};
async function member(username,fields={}){const user=await User.create({username,email:username+'@example.test',password:'unused-test-hash',name:username,...fields});const token=newToken(),csrf=newToken();await Session.create({user:user.id,tokenHash:hashToken(token),csrfToken:csrf,expiresAt:new Date(Date.now()+86400000)});return {user,cookie:'campus_session='+token,csrf};}
async function call(path,{as=admin,method='GET',body,csrf=true,requestOrigin=origin}={}){const response=await fetch(base+path,{method,headers:{Origin:requestOrigin,...(as?{Cookie:as.cookie}:{}),...(body?{'Content-Type':'application/json'}:{}),...(as&&csrf?{'X-CSRF-Token':as.csrf}:{})},body:body?JSON.stringify(body):undefined});return {status:response.status,body:await response.json()};}
before(async()=>{await mongoose.connect(`mongodb://127.0.0.1:27017/campus_test_calendar_v17_${process.pid}`);await Promise.all([User.init(),Session.init()]);server=createCampusApp({origins:[origin],loginLimit:1000,linkKey,academic:{request:async token=>officialSnapshots.get(token) || {}}}).listen(0);await new Promise(r=>server.once('listening',r));base=`http://127.0.0.1:${server.address().port}/api/campus`;});
after(async()=>{await new Promise(r=>server.close(r));await mongoose.connection.dropDatabase();await mongoose.disconnect();});
beforeEach(async()=>{officialSnapshots.clear();for(const collection of Object.values(mongoose.connection.collections))await collection.deleteMany({});admin=await member('calendar-admin',{role:'admin'});coordinator=await member('calendar-cse',{campusRole:'department_coordinator',department:'CSE'});otherCoordinator=await member('calendar-ece',{campusRole:'department_coordinator',department:'ECE'});student=await member('calendar-student',{department:'CSE'});peer=await member('calendar-peer',{department:'CSE'});outsider=await member('calendar-outsider',{department:'ECE',socialDepartment:'CSE'});});

test('student calendar uses the verified official department instead of editable campus department',async()=>{
 const college=await call('/academic-calendar',{method:'POST',body:policy()});
 await call('/academic-calendar',{as:coordinator,method:'POST',body:policy({scope:'department',department:'CSE',label:'Wrong editable department'})});
 const correct=await call('/academic-calendar',{as:otherCoordinator,method:'POST',body:policy({scope:'department',department:'ECE',mode:'follow-day',followDay:'Monday',label:'Official Monday timetable'})});
 const token='calendar-official-'+student.user.id;
 await AcademicLink.create({user:student.user._id,sealedToken:encryptToken(token,linkKey)});
 officialSnapshots.set(token,{identity:{verifiedPrincipal:'VTU12345',verifiedAt:new Date().toISOString()},profile:{branch:'Electronics and Communication Engineering',semester:'5',section:'A'},officialAcademic:{source:'ams',profile:{branch:'Electronics and Communication Engineering',semester:'5',section:'A'},courses:[{code:'CS101'}]},academic:{courses:[{code:'CS101'}]}});
 const mine=await call('/academic-calendar'+range,{as:student});
 assert.equal(mine.status,200);assert.equal(mine.body.entries[0].id,correct.body.id);
 const unknown=await call('/academic-calendar'+range,{as:peer});
 assert.equal(unknown.body.entries[0].id,college.body.id);
});
test('unverified official data cannot grant a department override but individual targets still apply',async()=>{
 const college=await call('/academic-calendar',{method:'POST',body:policy()});
 await call('/academic-calendar',{as:coordinator,method:'POST',body:policy({scope:'department',department:'CSE'})});
 const token='calendar-unverified-'+student.user.id;
 await AcademicLink.create({user:student.user._id,sealedToken:encryptToken(token,linkKey)});
 officialSnapshots.set(token,{profile:{branch:'CSE'},identity:{verifiedPrincipal:'VTU12345'}});
 assert.equal((await call('/academic-calendar'+range,{as:student})).body.entries[0].id,college.body.id);
 const targeted=await call('/academic-calendar',{method:'POST',body:policy({scope:'students',studentIds:[student.user.id],label:'Individual holiday'})});
 assert.equal((await call('/academic-calendar'+range,{as:student})).body.entries[0].id,targeted.body.id);
});

test('administrator calendar entries persist and ordinary reads expose only one effective owner policy',async()=>{
 const college=await call('/academic-calendar',{method:'POST',body:policy()});assert.equal(college.status,201);
 const dept=await call('/academic-calendar',{method:'POST',as:coordinator,body:policy({scope:'department',department:'CSE',mode:'follow-day',followDay:'Monday',label:'Monday schedule'})});assert.equal(dept.status,201);
 const special=await call('/academic-calendar',{method:'POST',body:policy({mode:'special',scope:'students',studentIds:[student.user.id,peer.user.id],classes:[custom],label:'Project'})});assert.equal(special.status,201);
 const mine=await call('/academic-calendar'+range,{as:student});assert.equal(mine.status,200);assert.equal(mine.body.entries.length,1);assert.equal(mine.body.entries[0].mode,'special');assert.equal(mine.body.entries[0].studentIds,undefined);assert.equal(mine.body.entries[0].classes[0].courseCode,'CS101');assert.equal(mine.body.entries[0].source,'administrator');assert.ok(!JSON.stringify(mine.body).includes(peer.user.id));
 const others=await call('/academic-calendar'+range,{as:outsider});assert.equal(others.body.entries[0].id,college.body.id);
 const saved=await call('/academic-calendar/manage'+range);assert.equal(saved.body.entries.length,3);assert.equal(saved.body.students.find(x=>x.id===student.user.id).name,'calendar-student');assert.equal(saved.body.students[0].email,undefined);
});
test('only active administrator or assigned coordinator can manage; social department cannot grant scope',async()=>{
 assert.equal((await call('/academic-calendar/manage'+range,{as:student})).status,403);
 assert.equal((await call('/academic-calendar',{as:student,method:'POST',body:policy()})).status,403);
 assert.equal((await call('/academic-calendar',{as:coordinator,method:'POST',body:policy()})).status,403);
 assert.equal((await call('/academic-calendar',{as:coordinator,method:'POST',body:policy({scope:'department',department:'ECE'})})).status,403);
 assert.equal((await call('/academic-calendar',{as:coordinator,method:'POST',body:policy({scope:'students',studentIds:[outsider.user.id]})})).status,403);
 await User.updateOne({_id:coordinator.user.id},{$set:{department:'',socialDepartment:'CSE'}});
 assert.equal((await call('/academic-calendar/manage'+range,{as:coordinator})).status,403);
 await User.updateOne({_id:admin.user.id},{$set:{isActive:false}});
 assert.equal((await call('/academic-calendar/manage'+range)).status,401);
});
test('coordinator management directory and mutation lookup cannot cross assigned departments',async()=>{
 const own=await call('/academic-calendar',{as:coordinator,method:'POST',body:policy({scope:'department',department:'CSE'})});assert.equal(own.status,201);
 const foreign=await call('/academic-calendar',{as:otherCoordinator,method:'POST',body:policy({scope:'students',studentIds:[outsider.user.id]})});assert.equal(foreign.status,201);
 const manage=await call('/academic-calendar/manage'+range,{as:coordinator});assert.equal(manage.body.entries.length,1);assert.deepEqual(manage.body.departments,['CSE']);assert.ok(manage.body.students.every(s=>s.department==='CSE'));
 assert.equal((await call('/academic-calendar/'+foreign.body.id,{as:coordinator,method:'PATCH',body:policy({scope:'department',department:'CSE'})})).status,404);
 assert.equal((await call('/academic-calendar/'+foreign.body.id,{as:coordinator,method:'DELETE'})).status,404);
});
test('calendar writes require the session CSRF token and approved origin',async()=>{
 assert.equal((await call('/academic-calendar',{method:'POST',body:policy(),csrf:false})).status,403);
 assert.equal((await call('/academic-calendar',{method:'POST',body:policy(),requestOrigin:'https://evil.example'})).status,403);
 assert.equal((await call('/academic-calendar'+range,{as:null})).status,401);
});
test('date, range, target, scope and custom class validation reject malformed or unverified input',async()=>{
 const changes=[{date:'2026-02-30'},{date:'2026-10-18T00:00:00Z'},{scope:'department',department:'Unknown'},{scope:'students',studentIds:['aaaaaaaaaaaaaaaaaaaaaaaa']},{scope:'college',studentIds:[student.user.id]},{section:'A'},{label:'x'.repeat(161)},{mode:'follow-day',followDay:'Funday'},{mode:'special',scope:'college',classes:[custom]},{mode:'special',scope:'students',studentIds:[student.user.id],classes:[{...custom,startTime:'9:00'}]},{mode:'special',scope:'students',studentIds:[student.user.id],classes:[{...custom,endTime:'08:00'}]},{mode:'special',scope:'students',studentIds:[student.user.id],classes:[custom,{...custom,startTime:'09:30',endTime:'10:30'}]},{mode:'holiday',classes:[custom]}];
 for(const change of changes){const response=await call('/academic-calendar',{method:'POST',body:policy(change)});assert.equal(response.status,400,JSON.stringify(change)+': '+JSON.stringify(response.body));}
 for(const query of ['?from=bad&to=2026-10-31','?from=2026-10-31&to=2026-10-01','?from=2025-01-01&to=2026-10-31',range+'&studentId='+outsider.user.id])assert.equal((await call('/academic-calendar'+query,{as:student})).status,400);
});
test('competing same-scope entries and overlapping target lists are rejected atomically',async()=>{
 const results=await Promise.all([call('/academic-calendar',{method:'POST',body:policy()}),call('/academic-calendar',{method:'POST',body:policy({label:'Competing'})})]);assert.deepEqual(results.map(x=>x.status).sort(),[201,409]);
 assert.equal((await call('/academic-calendar',{method:'POST',body:policy({scope:'students',studentIds:[student.user.id,peer.user.id]})})).status,201);
 assert.equal((await call('/academic-calendar',{method:'POST',body:policy({scope:'students',studentIds:[peer.user.id]})})).status,409);
});
test('update and deletion persist, restore less-specific policies, and prevent target-scope escalation',async()=>{
 const college=await call('/academic-calendar',{method:'POST',body:policy()});
 const target=await call('/academic-calendar',{as:coordinator,method:'POST',body:policy({scope:'students',studentIds:[student.user.id]})});assert.equal(target.status,201);
 const moved=await call('/academic-calendar/'+target.body.id,{as:coordinator,method:'PATCH',body:policy({scope:'students',studentIds:[outsider.user.id]})});assert.equal(moved.status,403);
 const updated=await call('/academic-calendar/'+target.body.id,{as:coordinator,method:'PATCH',body:policy({scope:'students',studentIds:[student.user.id],mode:'follow-day',followDay:'Tuesday',label:'Tuesday working day'})});assert.equal(updated.status,200);
 assert.equal((await call('/academic-calendar'+range,{as:student})).body.entries[0].followDay,'Tuesday');
 assert.equal((await call('/academic-calendar/'+target.body.id,{as:coordinator,method:'DELETE'})).status,200);
 assert.equal((await call('/academic-calendar'+range,{as:student})).body.entries[0].id,college.body.id);
});
test('updating a target list cannot create a competing student scope and role revocation is immediate',async()=>{
 const first=await call('/academic-calendar',{method:'POST',body:policy({scope:'students',studentIds:[student.user.id]})});
 const second=await call('/academic-calendar',{as:coordinator,method:'POST',body:policy({scope:'students',studentIds:[peer.user.id]})});
 assert.equal(first.status,201);assert.equal(second.status,201);
 assert.equal((await call('/academic-calendar/'+second.body.id,{as:coordinator,method:'PATCH',body:policy({scope:'students',studentIds:[student.user.id,peer.user.id]})})).status,409);
 await User.updateOne({_id:coordinator.user.id},{$set:{campusRole:'student'}});
 assert.equal((await call('/academic-calendar/'+second.body.id,{as:coordinator,method:'DELETE'})).status,403);
 const own=await call('/academic-calendar'+range,{as:peer});assert.equal(own.body.entries[0].id,second.body.id);
});
test('moving a student out of a coordinator department removes that policy from coordinator management',async()=>{
 const target=await call('/academic-calendar',{as:coordinator,method:'POST',body:policy({scope:'students',studentIds:[student.user.id]})});assert.equal(target.status,201);
 await User.updateOne({_id:student.user.id},{$set:{department:'ECE'}});
 assert.equal((await call('/academic-calendar/manage'+range,{as:coordinator})).body.entries.length,0);
 assert.equal((await call('/academic-calendar/'+target.body.id,{as:coordinator,method:'DELETE'})).status,404);
 assert.equal((await call('/academic-calendar/manage'+range)).body.entries.length,1);
});
