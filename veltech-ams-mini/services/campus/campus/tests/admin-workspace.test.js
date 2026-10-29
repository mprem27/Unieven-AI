import test,{before,after,beforeEach} from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import bcrypt from 'bcrypt';
import {createCampusApp} from '../server.js';
import User from '../../models/User.js';
import Event from '../../models/Event.js';
import {Session,Audit} from '../models.js';
const origin='http://localhost:5173';let server,base,password,owner,limited,student;
before(async()=>{await mongoose.connect(`mongodb://127.0.0.1:27017/campus_test_admin_workspace_${process.pid}`);await Promise.all([User.init(),Session.init()]);password=await bcrypt.hash('Fictional-password-42',4);server=createCampusApp({origins:[origin],loginLimit:1000,linkKey:'a'.repeat(64),academic:{request:async()=>({})}}).listen(0);await new Promise(r=>server.once('listening',r));base=`http://127.0.0.1:${server.address().port}/api/campus`;});
after(async()=>{await new Promise(r=>server.close(r));await mongoose.connection.dropDatabase();await mongoose.disconnect();});
beforeEach(async()=>{for(const collection of Object.values(mongoose.connection.collections))await collection.deleteMany({});owner=await member('owner',{role:'admin'});limited=await member('limited',{role:'admin',adminPermissions:['events','administrators'],adminActionPermissions:{events:['view','create'],administrators:['view','create','update']},adminCreatedBy:owner._id});student=await member('student');});
const member=(name,fields={})=>User.create({username:name,email:name+'@example.test',password,name,...fields});
async function call(path,method='GET',body,auth){const r=await fetch(base+path,{method,headers:{Origin:origin,...(body?{'Content-Type':'application/json'}:{}),...(auth?{Cookie:auth.cookie,'X-CSRF-Token':auth.data.csrfToken}:{})},body:body?JSON.stringify(body):undefined});return {status:r.status,data:await r.json(),cookie:r.headers.get('set-cookie')?.split(';')[0]};}
const login=user=>call('/login','POST',{identity:user.email,password:'Fictional-password-42'});
test('admin success creates separate metadata/login history without credentials; students cannot read it',async()=>{
 const auth=await login(owner);assert.equal(auth.status,200);await Event.create({createdBy:owner._id,title:'Expired historical event',image:'/assets/veltech-campus.jpg',date:new Date('2020-10-23'),expiresAt:new Date(1),time:'10:00',location:'Campus',scope:'college'});
 const overview=await call('/admin/overview','GET',null,auth);assert.equal(overview.status,200);assert.equal(overview.data.counts.members,3);assert.equal(overview.data.counts.activeEvents,0);
 assert.equal(await mongoose.connection.db.collection('admin_accounts').countDocuments({user:owner._id}),1);
 assert.equal(await mongoose.connection.db.collection('admin_login_events').countDocuments({user:owner._id,action:'login'}),1);
 const studentSession=await login(student);assert.equal((await call('/admin/overview','GET',null,studentSession)).status,403);assert.equal(await mongoose.connection.db.collection('account_access_events').countDocuments({user:student._id,action:'login'}),1);const detail=await call('/admin/directory/'+student.id,'GET',null,auth);assert.ok(detail.data.activity.some(row=>row.action==='account.login'));
 const history=await call('/admin/access-history','GET',null,auth);assert.equal(history.status,200);assert.doesNotMatch(JSON.stringify(history.data),/password|csrfToken|tokenHash/);
});
test('limited admin cannot edit/archive events without the corresponding action',async()=>{
 const auth=await login(limited),event=await Event.create({createdBy:owner._id,title:'Own event',image:'/assets/veltech-campus.jpg',date:new Date('2030-10-23'),time:'10:00',location:'Campus',scope:'college'});
 assert.equal((await call('/events/'+event.id,'PATCH',{title:'Denied update'},auth)).status,403);
 assert.equal((await call('/events/'+event.id,'DELETE',{},auth)).status,403);
 assert.equal((await Event.findById(event.id)).title,'Own event');
});
test('limited action checks match case-insensitive, encoded and trailing-slash Express routes',async()=>{
 const auth=await login(limited),event=await Event.create({createdBy:owner._id,title:'Protected event',image:'/assets/veltech-campus.jpg',date:new Date('2030-10-23'),time:'10:00',location:'Campus',scope:'college'});
 const encoded=event.id.split('').map(c=>'%'+c.charCodeAt(0).toString(16)).join('');
 for(const url of [`/EVENTS/${event.id}`,`/events/${event.id.toUpperCase()}`,`/events/${encoded}`,`/events/${event.id}/`])assert.equal((await call(url,'DELETE',{},auth)).status,403,url);
 assert.equal((await call(`/EVENTS/${event.id}/STAFF/`,'PUT',{userId:student.id,capabilities:{manual:true}},auth)).status,403);
 assert.equal((await Event.findById(event.id)).archivedAt,null);
});
test('an event create-only grant cannot read the event waitlist',async()=>{
 await User.updateOne({_id:limited._id},{$set:{adminActionPermissions:{events:['create']}}});
 const event=await Event.create({createdBy:owner._id,title:'Protected event',image:'/assets/veltech-campus.jpg',date:new Date('2030-10-23'),time:'10:00',location:'Campus',scope:'college'});
 assert.equal((await call(`/events/${event.id}/waitlist`,'GET',null,await login(limited))).status,403);
});
test('action grants can be changed after creation, revoke sessions and cannot exceed grantor',async()=>{
 const auth=await login(limited);
 const create={name:'Child admin',username:'child_admin',email:'child@example.test',password:'Fictional-password-42',accountRole:'admin',adminPermissions:['events'],adminActionPermissions:{events:['view','create']}};
 const made=await call('/management/users','POST',create,auth);assert.equal(made.status,201);assert.deepEqual(made.data.adminActionPermissions.events,['view','create']);
 const child=await User.findById(made.data.id);await login(child);assert.equal(await Session.countDocuments({user:child._id}),1);
 const update={campusRole:'admin',accountRole:'student',department:'',club:'',adminPermissions:['events'],adminActionPermissions:{events:['view']}};
 assert.equal((await call('/management/users/'+child.id,'PATCH',update,auth)).status,200);assert.equal(await Session.countDocuments({user:child._id}),0);
 const denied=await call('/management/users/'+child.id,'PATCH',{...update,adminActionPermissions:{events:['view','delete']}},auth);assert.equal(denied.status,403);
 assert.deepEqual((await User.findById(child.id)).adminActionPermissions.events,['view']);
});
test('directory distinguishes students, faculty and admins and protects owner access',async()=>{
 await member('faculty',{role:'faculty',department:'CSE'});const auth=await login(owner);
 const directory=await call('/admin/directory?role=faculty','GET',null,auth);assert.equal(directory.status,200);assert.equal(directory.data.users.length,1);assert.equal(directory.data.users[0].accountRole,'faculty');assert.doesNotMatch(JSON.stringify(directory.data),/password|registerOTP|resetOTP/);
 assert.equal((await call('/management/users/'+owner.id,'DELETE',{},auth)).status,409);
});

test('placement updates and removal are reflected in the student opportunity list',async()=>{
 const admin=await login(owner),auth=await login(student),made=await call('/placements','POST',{company:'Fictional Company',title:'Student internship',type:'campus'},admin);assert.equal(made.status,201);
 assert.equal((await call('/placements/'+made.data.id,'PATCH',{company:'Fictional Company',title:'Updated internship',type:'off-campus'},admin)).status,200);
 assert.equal((await call('/placements','GET',null,auth)).data[0].title,'Updated internship');
 assert.equal((await call('/placements/'+made.data.id,'DELETE',{},admin)).status,200);assert.equal((await call('/placements','GET',null,auth)).data.length,0);
});
test('archiving a faculty form hides it from students while keeping its response history',async()=>{
 const admin=await login(owner),auth=await login(student),form=await call('/forms','POST',{title:'Fictional feedback',scope:'college',fields:[{id:'rating',label:'Your feedback',type:'text',required:true}]},admin);assert.equal(form.status,201);
 assert.equal((await call('/forms/'+form.data.id,'DELETE',{},admin)).status,200);assert.equal((await call('/forms','GET',null,auth)).data.length,0);
});
test('owner creates a named limited role and can later replace its role and limits',async()=>{
 const auth=await login(owner),body={name:'Event administrator',username:'role_admin',email:'role@example.test',password:'Fictional-password-42',accountRole:'admin',adminAccessRole:'event_admin',adminPermissions:['events'],adminActionPermissions:{events:['view','create']},isAdminOwner:true};
 const made=await call('/management/users','POST',body,auth);assert.equal(made.status,201);assert.equal(made.data.adminAccessRole,'event_admin');assert.equal(made.data.isAdminOwner,false);
 assert.equal((await mongoose.connection.db.collection('admin_accounts').findOne({user:new mongoose.Types.ObjectId(made.data.id)})).accessRole,'event_admin');
 const user=await User.findById(made.data.id);await login(user);
 const changed=await call('/management/users/'+user.id,'PATCH',{campusRole:'admin',accountRole:'student',department:'',club:'',adminAccessRole:'news_editor',adminPermissions:['notices'],adminActionPermissions:{notices:['view','create']}},auth);assert.equal(changed.status,200);assert.equal(changed.data.adminAccessRole,'news_editor');assert.equal(await Session.countDocuments({user:user._id}),0);assert.equal(changed.data.adminPermissions.includes('events'),false);
});
test('role selection cannot bypass admin-creation authority, role scope or grantor ceilings',async()=>{
 const body={name:'Restricted role',username:'restricted_role',email:'restricted-role@example.test',password:'Fictional-password-42',accountRole:'admin',adminAccessRole:'event_admin',adminPermissions:['events'],adminActionPermissions:{events:['view']}};
 assert.equal((await call('/management/users','POST',body,await login(student))).status,403);
 const auth=await login(owner);assert.equal((await call('/management/users','POST',{...body,adminAccessRole:'owner'},auth)).status,400);
 assert.equal((await call('/management/users','POST',{...body,adminPermissions:['accounts'],adminActionPermissions:{accounts:['view']}},auth)).status,403);
 assert.equal((await call('/management/users','POST',{...body,adminActionPermissions:{events:['view','delete']}},await login(limited))).status,403);
});
