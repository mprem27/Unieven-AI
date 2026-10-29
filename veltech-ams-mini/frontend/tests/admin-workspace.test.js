import test from 'node:test';
import assert from 'node:assert/strict';
import * as workspace from '../src/lib/admin-workspace.js';

const owner={role:'admin'};
const limited={role:'admin',adminPermissions:['examinations','calendar'],adminActionPermissions:{examinations:['view','create'],calendar:['view']}};

test('administrator navigation groups assigned modules and keeps nested exam pages selected',()=>{
 assert.equal(typeof workspace.adminNavigationFor,'function');
 const groups=workspace.adminNavigationFor(limited);
 assert.deepEqual(groups.map(group=>group.label),['Workspace','Publishing','Operations','System']);
 const links=groups.flatMap(group=>group.links);
 assert.ok(links.some(link=>link.to==='/faculty-exams' && link.end===false));
 assert.ok(links.some(link=>link.to==='/academic-calendar'));
 assert.ok(links.some(link=>link.to==='/settings'));
 assert.equal(links.some(link=>link.to==='/admin/directory'),false);
 assert.equal(links.some(link=>link.to==='/admin/manage/events'),false);
 assert.equal(workspace.adminPageTitle('/faculty-exams/new',groups),'New exam schedule');
 assert.equal(workspace.adminPageTitle('/faculty-exams/plan123',groups),'Review exam schedule');
 assert.equal(workspace.adminPageTitle('/admin/manage/users',workspace.adminNavigationFor(owner)),'Roles & accounts');
});

test('overview data resources never request unassigned modules or actions',()=>{
 assert.equal(typeof workspace.adminOverviewResources,'function');
 assert.deepEqual(workspace.adminOverviewResources({role:'admin',adminPermissions:[]},'2026-10-22'),{plans:null,calendar:null});
 assert.deepEqual(workspace.adminOverviewResources({...limited,adminActionPermissions:{examinations:['create']}},'2026-10-22'),{plans:null,calendar:null});
 const paths=workspace.adminOverviewResources(limited,'2026-10-22');
 assert.equal(paths.plans,'/exam-plans');
 assert.equal(paths.calendar,'/academic-calendar/manage?from=2026-10-22&to=2026-11-21');
});

test('overview metrics require both authorized access and real numeric data',()=>{
 assert.equal(typeof workspace.adminOverviewMetrics,'function');
 const counts={students:100,faculty:8,administrators:2,activeEvents:5,registrations:20,attended:12};
 assert.deepEqual(workspace.adminOverviewMetrics(limited,counts),[]);
 assert.deepEqual(workspace.adminOverviewMetrics(owner,{students:0,faculty:null,activeEvents:4}).map(metric=>[metric.key,metric.value]),[['students',0],['activeEvents',4]]);
});

test('permission search finds module groups and only exposes grantable actions',()=>{
 assert.equal(typeof workspace.adminPermissionGroups,'function');
 const groups=workspace.adminPermissionGroups(limited,'publishing');
 assert.deepEqual(groups.flatMap(group=>group.modules.map(module=>module.key)),['examinations']);
 assert.deepEqual(groups[0].modules[0].actions,['view','create']);
 assert.equal(workspace.adminPermissionGroups(limited,'unassigned').length,0);
});

test('permission changes keep legacy grants within the grantor action ceiling',()=>{
 assert.equal(typeof workspace.toggleAdminModule,'function');
 const selected=workspace.toggleAdminModule(limited,[],undefined,'examinations',true);
 assert.deepEqual(selected,{permissions:['examinations'],actions:{examinations:['view']}});
 const changed=workspace.toggleAdminAction(limited,['examinations'],undefined,'examinations','view',false);
 assert.deepEqual(changed,{permissions:['examinations'],actions:{examinations:['create']}});
 const forbidden=workspace.toggleAdminAction(limited,['examinations'],{examinations:['view']},'examinations','delete',true);
 assert.deepEqual(forbidden,{permissions:['examinations'],actions:{examinations:['view']}});
 const absent=workspace.toggleAdminModule(limited,[],{},'accounts',true);
 assert.deepEqual(absent,{permissions:[],actions:{}});
});
