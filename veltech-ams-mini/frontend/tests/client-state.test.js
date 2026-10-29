import test from 'node:test';
import assert from 'node:assert/strict';
import {createAccountGate,mergeCampusProfile,createDemoRegistrationService,cancelDemoRegistration,needsAcademicWorkspace} from '../src/lib/client-state.js';

test('staff sign-in does not attempt to open a student AMS workspace',()=>{
 assert.equal(needsAcademicWorkspace({accountRole:'faculty',campusRole:'student'}),false);
 assert.equal(needsAcademicWorkspace({accountRole:'admin',campusRole:'admin'}),false);
 assert.equal(needsAcademicWorkspace({accountRole:'student',campusRole:'club_organizer'}),true);
 assert.equal(needsAcademicWorkspace({}),true);
 const profile=mergeCampusProfile({accountRole:'faculty'},{accountRole:'student'});
 assert.equal(profile.accountRole,'faculty');
});

test('old session reads cannot apply CSRF after another account transition',()=>{
 const gate=createAccountGate(),old=gate.startRefresh();
 const login=gate.beginAccount();
 assert.equal(gate.currentRefresh(old),false);
 assert.equal(gate.startRefresh(),null);
 assert.equal(gate.currentAccount(login),true);
 gate.finishAccount(login);
 const latest=gate.startRefresh();assert.equal(gate.currentRefresh(latest),true);
});
test('switching to demo invalidates unfinished account connections and refreshes',()=>{
 const gate=createAccountGate(),login=gate.beginAccount(),request=gate.startRefresh(true);
 gate.invalidate();
 assert.equal(gate.currentAccount(login),false);assert.equal(gate.currentRefresh(request),false);
});
test('only the latest refresh can publish its result',()=>{
 const gate=createAccountGate(),first=gate.startRefresh(),second=gate.startRefresh();
 assert.equal(gate.currentRefresh(first),false);assert.equal(gate.currentRefresh(second),true);
});
test('portal display fields cannot replace campus account or organizer scope',()=>{
 const result=mergeCampusProfile({id:'campus-1',name:'Campus name',email:'me@example.edu',department:'CSE',campusRole:'department_coordinator',club:'coding'},{id:'academic-2',name:'Portal name',department:'Computer Science and Engineering',campusRole:'admin',club:'other',photo:'/student.png'});
 assert.equal(result.id,'campus-1');assert.equal(result.name,'Portal name');assert.equal(result.department,'Computer Science and Engineering');assert.equal(result.campusDepartment,'CSE');assert.equal(result.campusRole,'department_coordinator');assert.equal(result.club,'coding');
});
test('official source snapshot stays separate from editable social identity',()=>{
 const academic={name:'Official student',department:'Source department',section:'B',source:'ams'};
 const result=mergeCampusProfile({id:'me',name:'Social display',department:'CSE',socialDepartment:'Design',role:'faculty'},academic);
 assert.deepEqual(result.officialProfile,academic);
 assert.equal(result.socialName,'Social display');assert.equal(result.socialDepartment,'Design');
 academic.section='X';assert.equal(result.officialProfile.section,'B');
});
test('unconnected official fields do not fall back to editable account information',()=>{
 const result=mergeCampusProfile({name:'Editable name',department:'CSE',studentId:'editable'});
 assert.deepEqual(result.officialProfile,{});
});
function demoStore(capacity=1) {
 let state={events:[{id:'event',pricePaise:0,capacity,registrationCount:0}],registrations:[]};
 return {getState:()=>state,update:fn=>{state=fn(structuredClone(state));}};
}
test('concurrent duplicate demo registrations share one ticket and one reservation',async()=>{
 const store=demoStore();let created=0;
 const service=createDemoRegistrationService({...store,makeTicket:async(event)=>{await new Promise(r=>setTimeout(r,10));return {id:'ticket-'+ ++created,event,status:'registered'};}});
 const [a,b]=await Promise.all([service.register('event'),service.register('event')]);
 assert.equal(a.id,b.id);assert.equal(created,1);assert.equal(store.getState().registrations.length,1);assert.equal(store.getState().events[0].registrationCount,1);
 assert.equal((await service.register('event')).id,a.id);
});
test('commit rechecks capacity changed while the ticket was generated',async()=>{
 const store=demoStore();let release;
 const ready=new Promise(resolve=>release=resolve);
 const service=createDemoRegistrationService({...store,makeTicket:async(event)=>{await ready;return {id:'ticket',event,status:'registered'};}});
 const pending=service.register('event');
 store.update(d=>{d.events[0].registrationCount=1;return d;});release();
 await assert.rejects(pending,/full/);assert.equal(store.getState().registrations.length,0);assert.equal(store.getState().events[0].registrationCount,1);
});
test('duplicate demo cancellation releases capacity once',()=>{
 const state={events:[{id:'event',registrationCount:1}],registrations:[{id:'ticket',event:{id:'event'},status:'registered'}]};
 assert.equal(cancelDemoRegistration(state,'ticket'),true);assert.equal(cancelDemoRegistration(state,'ticket'),false);
 assert.equal(state.events[0].registrationCount,0);
});
test('demo reset invalidates delayed registration work',async()=>{
 const store=demoStore();let release;const ready=new Promise(resolve=>release=resolve);
 const service=createDemoRegistrationService({...store,makeTicket:async(event)=>{await ready;return {id:'ticket',event,status:'registered'};}});
 const pending=service.register('event');service.invalidate();release();
 await assert.rejects(pending,/reset/);assert.equal(store.getState().registrations.length,0);
});
test('archived demo events cannot reuse a ticket or commit an unfinished registration',async()=>{
 const state={events:[{id:'closed',capacity:10,registrationCount:1,pricePaise:0,status:'cancelled',archivedAt:new Date().toISOString()}],registrations:[{id:'history',event:{id:'closed'},status:'registered'}]};
 const service=createDemoRegistrationService({getState:()=>state,update:fn=>fn(state),makeTicket:async()=>({id:'new'})});
 await assert.rejects(service.register('closed'),/unavailable/);
});
