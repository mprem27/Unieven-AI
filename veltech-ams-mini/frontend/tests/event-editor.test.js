import test from 'node:test';
import assert from 'node:assert/strict';
import * as editor from '../src/lib/event-editor.js';

const profile={campusRole:'club_organizer',department:'CSE',club:'Coding Club'};
test('event edit round trip preserves college details, legacy blank end time and publication dates',()=>{
 const event={id:'a'.repeat(24),title:'College workshop',date:'2026-11-20T04:30:00.000Z',time:'10:00',location:'Main hall',category:'Workshop',scope:'club',department:'CSE',club:'Coding Club',pricePaise:12500,capacity:50,deadline:'2026-11-19T17:15:30.000Z',eventFormat:'hybrid',endTime:'12:00',meetingUrl:'https://meet.example.edu/room',agenda:[{time:'10:00',title:'Welcome',speaker:'Faculty team'}],contactName:'Event team',contactPhone:'+91 98765 43210',accessibilityNotes:'Step-free entrance',attendanceInstructions:'Bring college ID',rules:['Show your ticket'],expiresAt:'2027-02-20T10:30:45.000Z',posterFit:'contain',posterPosition:60,posterTheme:'teal',registrationCount:4};
 const draft=editor.eventEditorDraft(event,profile),payload=editor.eventEditorPayload(draft,{editing:true});
 for(const key of ['eventFormat','endTime','meetingUrl','agenda','contactName','contactPhone','accessibilityNotes','attendanceInstructions','expiresAt','deadline','rules','pricePaise','posterFit','posterPosition','posterTheme'])assert.deepEqual(payload[key],event[key],key);
 for(const key of ['id','scope','department','club','registrationCount','paid','price','rulesText'])assert.equal(key in payload,false,key);
 assert.equal(editor.eventEditorDraft({...event,endTime:undefined,eventFormat:undefined},profile).endTime,'');
});
test('new event payload has exact supported fields and explicit free or paid pricing',()=>{
 const draft=editor.createEventDraft(profile,new Date('2026-10-23T12:00:00Z'));draft.title='Workshop';draft.location='Main auditorium';draft.rulesText=' Carry ID \n\nShow ticket ';draft.paid=true;draft.price='100.50';draft.capacity='120';
 const payload=editor.eventEditorPayload(draft,{publishPost:true});assert.equal(payload.scope,'club');assert.equal(payload.pricePaise,10050);assert.equal(payload.capacity,120);assert.deepEqual(payload.rules,['Carry ID','Show ticket']);assert.equal(payload.publishPost,true);assert.equal('expiry' in payload,false);assert.equal('expiresAt' in payload,false);
 draft.paid=false;assert.equal(editor.eventEditorPayload(draft).pricePaise,0);
});
test('event workflow catches invalid times, meeting URLs and registration deadline in their steps',()=>{
 const draft={...editor.createEventDraft(profile),title:'Workshop',location:'Main hall',eventFormat:'online',time:'10:00',endTime:'09:00',meetingUrl:'http://meet.example.edu/room',deadline:'2099-01-01T10:00'};
 let errors=editor.validateEventDraft(draft,{now:new Date('2026-01-01')});assert.ok(errors.some(e=>e.field==='endTime' && e.step===1));assert.ok(errors.some(e=>e.field==='meetingUrl' && e.step===1));assert.ok(errors.some(e=>e.field==='deadline' && e.step===3));
 draft.endTime='11:00';draft.meetingUrl='https://meet.example.edu/room';draft.deadline='';assert.deepEqual(editor.validateEventDraft(draft,{now:new Date('2026-01-01')}),[]);
});
test('audience choices follow the staff role ceiling and retain an existing event scope',()=>{
 assert.deepEqual(editor.eventScopeChoices(profile),['club']);assert.deepEqual(editor.eventScopeChoices({campusRole:'department_coordinator'}),['department']);assert.deepEqual(editor.eventScopeChoices({campusRole:'college_event_manager'}),['college']);assert.deepEqual(editor.eventScopeChoices({accountRole:'admin'}),['college','department','club']);assert.deepEqual(editor.eventScopeChoices(profile,{scope:'legacy'}),['legacy']);assert.deepEqual(editor.eventScopeChoices({campusRole:'student'}),[]);
});
