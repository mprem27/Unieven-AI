import test from 'node:test';
import assert from 'node:assert/strict';
import * as forms from '../src/lib/forms.js';
import * as workspace from '../src/lib/admin-workspace.js';

const viewer={accountRole:'admin',adminPermissions:['events','forms'],adminActionPermissions:{events:['view'],forms:['view']}};
test('publishing form controls require the matching administrator action and persisted scope',()=>{
 assert.equal(typeof forms.canFormAction,'function');
 assert.equal(forms.canFormAction(viewer,{canManage:true},'update'),false);
 assert.equal(forms.canFormAction(viewer,{canManage:true},'delete'),false);
 assert.equal(forms.canAuthorForms(viewer),false);
 const editor={...viewer,adminActionPermissions:{forms:['view','update']}};
 assert.equal(forms.canFormAction(editor,{canManage:true},'update'),true);
 assert.equal(forms.canFormAction(editor,{canManage:false},'update'),false);
 assert.equal(forms.canFormAction({accountRole:'faculty'},{canManage:true},'delete'),true);
 assert.equal(forms.canFormAction({accountRole:'faculty'},{canManage:false},'update'),false);
 assert.equal(forms.canFormAction({accountRole:'student',campusRole:'college_event_manager'},{canManage:true},'update'),false);
});
test('an existing form edit preserves question identifiers, dates and choices without creating a new form',()=>{
 assert.equal(typeof forms.formEditorDraft,'function');
 assert.equal(typeof forms.buildFormChanges,'function');
 const original={id:'a'.repeat(24),title:'Published feedback',description:'Existing form',scope:'department',department:'CSE',club:'',state:'published',eventId:'b'.repeat(24),opensAt:'2026-10-22T04:30:00Z',closesAt:'2026-10-22T12:30:00Z',fields:[{id:'original_question',label:'Choose',type:'radio',required:true,choices:['A','B']}],responseCount:0,geofence:{latitude:13,longitude:80,radiusMeters:100}};
 const draft=forms.formEditorDraft(original);draft.title='Updated feedback';
 const changes=forms.buildFormChanges(draft,original);
 assert.equal(changes.title,'Updated feedback');
 assert.deepEqual(changes.fields,original.fields);
 assert.equal(changes.opensAt,new Date(original.opensAt).toISOString());
 assert.equal('scope' in changes,false);
 assert.equal('eventId' in changes,false);
 assert.equal('id' in changes,false);
});
test('forms with responses only send a state change and never replace answered questions',()=>{
 assert.equal(typeof forms.buildFormChanges,'function');
 const original={responseCount:1},changes=forms.buildFormChanges({state:'closed',title:'Discarded edit',fields:[]},original);
 assert.deepEqual(changes,{state:'closed'});
});
test('view-only event managers have no edit/archive tabs and archived events remain historical',()=>{
 assert.equal(typeof workspace.eventWorkspaceTabs,'function');
 assert.deepEqual(workspace.eventWorkspaceTabs(viewer,{}).map(([key])=>key),['analytics','waitlist']);
 assert.deepEqual(workspace.eventWorkspaceTabs({accountRole:'admin'},{}).map(([key])=>key),['analytics','edit','waitlist','archive']);
 assert.deepEqual(workspace.eventWorkspaceTabs({accountRole:'admin'},{archivedAt:'2026-10-22'}).map(([key])=>key),['analytics','waitlist']);
 assert.deepEqual(workspace.eventWorkspaceTabs({accountRole:'faculty',campusRole:'department_coordinator'},{}).map(([key])=>key),['analytics','edit','waitlist','archive']);
});
