import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { canManageEvent, canCreateEvent,canCheckInEvent } from '../policy.js';
import { checkWebhook, encryptToken, decryptToken, validateId } from '../security.js';

const event={createdBy:'creator',scope:'club',department:'CSE',club:'coding'};
test('club organizer manages assigned club, never another club',()=>{
  assert.equal(canManageEvent({id:'organizer',campusRole:'club_organizer',department:'CSE',club:'coding'},event),true);
  assert.equal(canManageEvent({id:'organizer',campusRole:'club_organizer',department:'CSE',club:'music'},event),false);
});
test('department coordinator cannot manage another department or college events',()=>{
  const u={id:'staff',campusRole:'department_coordinator',department:'CSE'};
  assert.equal(canManageEvent(u,{...event,scope:'department'}),true);
  assert.equal(canManageEvent(u,{...event,scope:'department',department:'ECE'}),false);
  assert.equal(canManageEvent(u,{...event,scope:'college'}),false);
});
test('college event manager cannot manage unrelated department events',()=>{
  const u={id:'staff',campusRole:'college_event_manager'};
  assert.equal(canManageEvent(u,{...event,scope:'college'}),true);
  assert.equal(canManageEvent(u,event),false);
});
test('student cannot gain organizer access by being a scoped event creator',()=>{
  assert.equal(canManageEvent({id:'creator',role:'student'},event),false);
  assert.equal(canCreateEvent({campusRole:'student'},event),false);
  assert.equal(canCreateEvent({campusRole:'not-a-role'},event),false);
});
test('faculty may scan their department tickets without receiving event management access',()=>{
 const faculty={id:'faculty',role:'faculty',campusRole:'student',department:'CSE'},own={...event,scope:'department'};
 assert.equal(canCheckInEvent(faculty,own),true);assert.equal(canManageEvent(faculty,own),false);
 assert.equal(canCheckInEvent({...faculty,role:'student'},own),false);
 assert.equal(canCheckInEvent(faculty,{...own,department:'ECE'}),false);
 assert.equal(canCheckInEvent(faculty,{...own,scope:'college'}),false);
 assert.equal(canCheckInEvent({...faculty,isActive:false},own),false);
});
test('admin can manage scoped events; legacy unscoped creator is preserved',()=>{
  assert.equal(canManageEvent({id:'admin',role:'admin'},event),true);
  assert.equal(canManageEvent({id:'creator',role:'student'},{createdBy:'creator'}),true);
  assert.equal(canManageEvent({id:'other',role:'student'},{createdBy:'creator'}),false);
});
test('webhook verifies exact raw body and rejects malformed signatures',()=>{
  const body=Buffer.from('{"event":"payment.captured"}');
  const signature=crypto.createHmac('sha256','test-secret').update(body).digest('hex');
  assert.equal(checkWebhook(body,signature,'test-secret'),true);
  assert.equal(checkWebhook(Buffer.from('{}'),signature,'test-secret'),false);
  assert.equal(checkWebhook(body,'malformed','test-secret'),false);
  assert.equal(checkWebhook(body,signature,''),false);
});
test('academic token encryption is authenticated and bound to configured key',()=>{
  const key=crypto.randomBytes(32).toString('hex');
  const sealed=encryptToken('private-academic-token',key);
  assert.ok(!sealed.includes('private-academic-token'));
  assert.equal(decryptToken(sealed,key),'private-academic-token');
  assert.throws(()=>decryptToken(sealed,crypto.randomBytes(32).toString('hex')));
});
test('record identifiers reject arrays and objects before database casting',()=>{
 const id='1234567890abcdef12345678';
 assert.equal(validateId(id),id);
 for(const value of [[id],{id},null,undefined]) assert.throws(()=>validateId(value),e=>e.status===400);
});
