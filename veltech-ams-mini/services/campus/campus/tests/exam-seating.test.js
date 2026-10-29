import test,{before,after,beforeEach} from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import bcrypt from 'bcrypt';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import User from '../../models/User.js';
import {FacultyExam} from '../models/faculty-exams.js';
import {ExamPlan} from '../models/exam-plans.js';
import {createCampusApp} from '../server.js';
import {AcademicLink} from '../models.js';
import {encryptToken} from '../security.js';
import {verifiedStudentIdentity} from '../services/student-identity.js';
import {ExamSeatingRelease} from '../models/exam-seating.js';
let server,base,password,owner,student,other,unverified,exam,directory,parserCalls;let snapshotForAudience={};let importedCandidates=null;const origin='http://localhost:5173';
const rows=[{vtuNumber:'VTU00000',hall:'Main Block',room:'A101',seat:'S12',reportingTime:'09:00',notes:'Carry college ID'},{vtuNumber:'VTU00001',hall:'Main Block',room:'A102',seat:'S15'}];
before(async()=>{await mongoose.connect(`mongodb://127.0.0.1:27017/campus_test_exam_seating_${process.pid}`);await User.init();password=await bcrypt.hash('Fictional-password-42',4);directory=await fs.mkdtemp(path.join(os.tmpdir(),'.campus-seating-test-'));server=createCampusApp({origins:[origin],loginLimit:1000,mediaDirectory:directory,linkKey:'a'.repeat(64),academic:{internal:async(route,body)=>{parserCalls.push({route,body});return route.endsWith('/roster')?{students:rows.map(({vtuNumber})=>({vtuNumber})),warnings:[],format:'csv',requiresReview:true}:{rows:importedCandidates || rows.map((row,index)=>({...row,courseCode:'CS101',sourceRow:index+2})),warnings:[],format:'csv',requiresReview:true};},request:async(token)=>typeof snapshotForAudience==='function'?snapshotForAudience(token):snapshotForAudience}}).listen(0);await new Promise(r=>server.once('listening',r));base=`http://127.0.0.1:${server.address().port}/api/campus`;});
after(async()=>{await new Promise(r=>server.close(r));await mongoose.connection.dropDatabase();await mongoose.disconnect();await fs.rm(directory,{recursive:true,force:true});});
beforeEach(async()=>{parserCalls=[];importedCandidates=null;snapshotForAudience={};for(const c of Object.values(mongoose.connection.collections))await c.deleteMany({});owner=await member('owner',{role:'admin'});student=await member('student',{portalPrincipal:'vtu00000',portalPrincipalVerifiedAt:new Date()});other=await member('other',{portalPrincipal:'vtu00002',portalPrincipalVerifiedAt:new Date()});unverified=await member('unverified',{studentId:'VTU00000',socialDepartment:'VTU00000'});exam=await FacultyExam.create({title:'Semester examination',courseCode:'CS101',courseName:'Programming',date:'2030-10-23',startTime:'10:00',endTime:'12:00',department:'CSE',publishedBy:owner._id,publishedByName:'Fictional Faculty',isPublished:true});});
const member=(name,fields={})=>User.create({username:name,email:name+'@example.test',name,password,...fields});
async function call(url,method='GET',body,auth){const multipart=body instanceof FormData;const r=await fetch(base+url,{method,headers:{Origin:origin,...(body&&!multipart?{'Content-Type':'application/json'}:{}),...(auth?{Cookie:auth.cookie,'X-CSRF-Token':auth.data.csrfToken}:{})},body:body?multipart?body:JSON.stringify(body):undefined});return {status:r.status,data:r.headers.get('content-type')?.includes('json')?await r.json():await r.text(),headers:r.headers,cookie:r.headers.get('set-cookie')?.split(';')[0]};}
const login=u=>call('/login','POST',{identity:u.email,password:'Fictional-password-42'});
async function upload(auth){const body=new FormData();body.append('file',new Blob(['VTU Number,Room,Seat\nVTU00000,A101,S12\nVTU00001,A102,S15\n'],{type:'text/csv'}),'seating.csv');return call(`/faculty-exams/${exam.id}/seating/import`,'POST',body,auth);}
async function publish(auth){const imported=await upload(auth);assert.equal(imported.status,201);const release=imported.data.release;const result=await call(`/faculty-exams/${exam.id}/seating/${release.id}`,'PUT',{rows,revision:release.revision,allowDownload:true,instructions:'Reach the hall 30 minutes early.'},auth);assert.equal(result.status,200);return result.data;}
test('import stays draft until reviewed and students see only their verified VTU seat',async()=>{
 const admin=await login(owner),draft=await upload(admin);assert.equal(draft.status,201);
 assert.equal((await call('/academics/exam-seating','GET',null,await login(student))).data.seating.length,0);
 const published=await call(`/faculty-exams/${exam.id}/seating/${draft.data.release.id}`,'PUT',{rows,revision:0,allowDownload:true},admin);assert.equal(published.status,200);
 const own=await call('/academics/exam-seating?vtuNumber=VTU00001','GET',null,await login(student));assert.equal(own.status,200);assert.equal(own.data.seating.length,1);assert.equal(own.data.seating[0].ownSeat.seat,'S12');assert.doesNotMatch(JSON.stringify(own.data),/VTU00001|A102|S15/);
 const guessed=await call('/academics/exam-seating','GET',null,await login(unverified));assert.equal(guessed.data.seating.length,0);assert.equal(guessed.data.identityAvailable,false);
});
test('original whole attachment remains private to authorized staff',async()=>{
 const result=await publish(await login(owner)),url=`/academics/exam-seating/${result.release.id}/file`;
 const file=await call(url,'GET',null,await login(student));assert.equal(file.status,404);const staff=await call(url,'GET',null,await login(owner));assert.equal(staff.status,200);assert.equal(staff.headers.get('cache-control'),'private, no-store');
 assert.equal((await call(url,'GET',null,await login(other))).status,404);
 assert.equal((await call(url,'GET',null,await login(unverified))).status,404);
});
test('withdrawal immediately hides student rows and revokes old file URLs',async()=>{
 const admin=await login(owner),result=await publish(admin),auth=await login(student),url=`/academics/exam-seating/${result.release.id}/file`;
 assert.equal((await call('/faculty-exams/'+exam.id,'DELETE',{},admin)).status,200);
 assert.equal((await call('/academics/exam-seating','GET',null,auth)).data.seating.length,0);assert.equal((await call(url,'GET',null,auth)).status,404);
});
test('duplicate VTU assignments are rejected and students cannot publish seating',async()=>{
 const admin=await login(owner),draft=await upload(admin);assert.equal(draft.status,201);
 assert.equal((await call(`/faculty-exams/${exam.id}/seating/${draft.data.release.id}`,'PUT',{rows:[rows[0],rows[0]],revision:0},admin)).status,400);
 assert.equal((await upload(await login(student))).status,403);
});

test('a staging workflow state cannot hide a previously reviewed published assignment',async()=>{
 const result=await publish(await login(owner)),auth=await login(student);
 await mongoose.connection.db.collection('exam_seating_releases').updateOne({_id:new mongoose.Types.ObjectId(result.release.id)},{$set:{state:'publishing'}});
 assert.equal((await call('/academics/exam-seating','GET',null,auth)).data.seating.length,1);
 assert.equal((await call(`/academics/exam-seating/${result.release.id}/file`,'GET',null,auth)).status,404);
});
test('a mutable portal username and old sync marker cannot replace the verified seating identity',async()=>{
 await AcademicLink.create({user:unverified._id,sealedToken:encryptToken('fictional-owned-token','a'.repeat(64))});
 let snapshot={profile:{portalUsername:'vtu00000',portalSynced:true},academic:{liveVerified:true}};
 const config={linkKey:'a'.repeat(64),academic:{request:async()=>snapshot}};
 assert.equal((await verifiedStudentIdentity(unverified,config)).vtuNumber,'');
 snapshot={...snapshot,identity:{verifiedPrincipal:'vtu00002',verifiedAt:new Date().toISOString()}};
 assert.equal((await verifiedStudentIdentity(unverified,config)).vtuNumber,'VTU00002');
});
test('publication rechecks the client revision after acquiring its exam lease',async()=>{
 const admin=await login(owner),draft=await upload(admin),original=FacultyExam.findOneAndUpdate;
 let advanced=false;
 FacultyExam.findOneAndUpdate=async function(query,...args){if(query.isPublished===true && !advanced){advanced=true;await ExamSeatingRelease.updateOne({_id:draft.data.release.id},{$set:{revision:1}});}return original.call(this,query,...args);};
 try{assert.equal((await call(`/faculty-exams/${exam.id}/seating/${draft.data.release.id}`,'PUT',{rows,revision:0},admin)).status,409);}
 finally{FacultyExam.findOneAndUpdate=original;}
 assert.equal((await FacultyExam.findById(exam.id)).seatingRelease,undefined);
});
test('withdrawal atomically refuses a publisher that acquired the lease after its initial read',async()=>{
 const admin=await login(owner),result=await publish(admin),original=ExamSeatingRelease.findOne;let locked=false;
 ExamSeatingRelease.findOne=async function(...args){const row=await original.apply(this,args);if(!locked){locked=true;await FacultyExam.updateOne({_id:exam._id},{$set:{seatingJobToken:'other-publication',seatingLockedUntil:new Date(Date.now()+120000)}});}return row;};
 try{assert.equal((await call(`/faculty-exams/${exam.id}/seating/${result.release.id}`,'DELETE',{},admin)).status,409);}
 finally{ExamSeatingRelease.findOne=original;}
 assert.equal(String((await FacultyExam.findById(exam.id)).seatingRelease),result.release.id);
});

async function generate(auth,{rooms=[{hall:'Main',room:'A101',capacity:2,seatPrefix:'S'}],courseCode,reportingTime}={}){
 const body=new FormData();body.append('file',new Blob(['VTU Number\nVTU00000\nVTU00001\n'],{type:'text/csv'}),'roster.csv');body.append('rooms',JSON.stringify(rooms));if(courseCode!==undefined)body.append('courseCode',courseCode);if(reportingTime!==undefined)body.append('reportingTime',reportingTime);return call(`/faculty-exams/${exam.id}/seating/allocate`,'POST',body,auth);
}
test('bulk generation creates a private draft and only reviewed seats become visible',async()=>{
 const admin=await login(owner),draft=await generate(admin,{courseCode:'cs-101',reportingTime:'09:00'});assert.equal(draft.status,201);assert.equal(draft.data.release.state,'draft');assert.equal(draft.data.release.allowDownload,false);assert.equal(draft.data.rows.length,2);assert.equal(draft.data.rows[1].seat,'S2');assert.equal(draft.data.rows[0].reportingTime,'09:00');assert.equal(draft.data.allocation.unusedSeats,0);
 assert.equal(parserCalls[0].route,'/campus/bridge/seating/roster');assert.equal(parserCalls[0].body.courseCode,'cs-101');
 const studentAuth=await login(student);assert.equal((await call('/academics/exam-seating','GET',null,studentAuth)).data.seating.length,0);assert.equal((await FacultyExam.findById(exam.id)).seatingRelease,undefined);
 const published=await call(`/faculty-exams/${exam.id}/seating/${draft.data.release.id}`,'PUT',{rows:draft.data.rows,revision:0},admin);assert.equal(published.status,200);
 const own=await call('/academics/exam-seating','GET',null,studentAuth);assert.equal(own.data.seating[0].ownSeat.seat,'S1');assert.equal(own.data.seating[0].document,null);assert.equal((await call(`/academics/exam-seating/${draft.data.release.id}/file`,'GET',null,studentAuth)).status,404);
});
test('bulk generation failures preserve the current published release without partial drafts',async()=>{
 const admin=await login(owner),published=await publish(admin),beforeCount=await ExamSeatingRelease.countDocuments();
 const result=await generate(admin,{rooms:[{room:'A101',capacity:1}]});assert.equal(result.status,400);assert.match(result.data.message,/capacity/i);assert.equal(await ExamSeatingRelease.countDocuments(),beforeCount);assert.equal(String((await FacultyExam.findById(exam.id)).seatingRelease),published.release.id);
 assert.equal((await generate(admin,{courseCode:'CS1010'})).status,400);
 assert.equal((await generate(admin,{rooms:[{room:'A1',capacity:1001}]})).status,400);
});
test('bulk allocation enforces staff scope and update permission before parsing private rosters',async()=>{
 assert.equal((await generate(await login(student))).status,403);assert.equal(parserCalls.length,0);
 const limited=await member('limited',{role:'admin',adminPermissions:['examinations'],adminActionPermissions:{examinations:['view','create']}});
 assert.equal((await generate(await login(limited))).status,403);assert.equal(parserCalls.length,0);
 const faculty=await member('faculty',{role:'faculty',department:'EEE'});assert.equal((await generate(await login(faculty))).status,404);assert.equal(parserCalls.length,0);
});

test('superseded university schedule rows hide seats and block stale seating publication',async()=>{
 const admin=await login(owner),published=await publish(admin),auth=await login(student);
 snapshotForAudience={identity:{verifiedPrincipal:'VTU00000',verifiedAt:new Date().toISOString()},officialAcademic:{source:'ams',profile:{branch:'CSE'},courses:[{courseCode:'CS101'}]}};await AcademicLink.create({user:student._id,sealedToken:encryptToken('verified-fixture-token','a'.repeat(64))});
 const plan=await ExamPlan.create({title:'Plan',createdBy:owner._id,status:'published',publishedRevision:1});await FacultyExam.updateOne({_id:exam._id},{$set:{planId:plan._id,planRevision:1}});
 assert.equal((await call('/academics/exam-seating','GET',null,auth)).data.seating.length,1);
 await ExamPlan.updateOne({_id:plan._id},{$set:{publishedRevision:2}});
 assert.equal((await call('/academics/exam-seating','GET',null,auth)).data.seating.length,0);
 assert.equal((await call(`/academics/exam-seating/${published.release.id}/file`,'GET',null,auth)).status,404);
 assert.equal((await call(`/faculty-exams/${exam.id}/seating/${published.release.id}`,'PUT',{rows,revision:published.release.revision},admin)).status,409);
 assert.equal((await generate(admin)).status,409);
});


test('name imports use verified eligible official records and exclude homonyms',async()=>{
 const principalSnapshot=principal=>({identity:{verifiedPrincipal:principal,verifiedAt:new Date().toISOString()},officialAcademic:{source:'ams',profile:{name:'Same Official Name',department:'CSE'},courses:[{courseCode:'CS101'}]}});
 await AcademicLink.create({user:student._id,sealedToken:encryptToken('student-owned-token','a'.repeat(64))});
 await AcademicLink.create({user:other._id,sealedToken:encryptToken('other-owned-token','a'.repeat(64))});
 importedCandidates=[{courseCode:'CS101',name:'Same Official Name',vtuNumber:'',room:'A1',seat:'S1',sourceRow:7}];
 snapshotForAudience=token=>principalSnapshot(token==='student-owned-token'?'VTU00000':'VTU00002');
 const auth=await login(owner),ambiguous=await upload(auth);
 assert.equal(ambiguous.status,201);assert.equal(ambiguous.data.rows.length,0);assert.equal(ambiguous.data.release.issues[0].sourceRow,7);
 snapshotForAudience=token=>token==='student-owned-token'?principalSnapshot('VTU00000'):{};
 const incomplete=await upload(auth);assert.equal(incomplete.status,201);assert.equal(incomplete.data.rows.length,0);
 await User.updateOne({_id:other._id},{$set:{isActive:false}});
 const unique=await upload(auth);assert.equal(unique.status,201);assert.equal(unique.data.rows[0].vtuNumber,'VTU00000');assert.equal(unique.data.release.review[0].method,'Unique eligible AMS name');
 assert.equal(parserCalls.at(-1).body.courseCode,'CS101');
});
