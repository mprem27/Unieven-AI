import test from 'node:test';
import assert from 'node:assert/strict';
import * as access from '../../shared/admin-access.mjs';
const limited={role:'admin',isActive:true,adminPermissions:['events','administrators'],adminActionPermissions:{events:['view','create'],administrators:['view','create']}};
test('limited admin module access does not grant unassigned update or delete actions',()=>{
 assert.equal(typeof access.hasAdminAction,'function');
 assert.equal(access.hasAdminAction(limited,'events','create'),true);assert.equal(access.hasAdminAction(limited,'events','delete'),false);assert.equal(access.hasAdminAction(limited,'events','update'),false);
 assert.equal(access.hasAdminAction({...limited,isActive:false},'events','view'),false);
});
test('owners and existing module-only grants remain compatible while new action maps fail closed',()=>{
 assert.equal(typeof access.hasAdminAction,'function');
 assert.equal(access.hasAdminAction({role:'admin'},'events','delete'),true);
 assert.equal(access.hasAdminAction({role:'admin',adminPermissions:['events']},'events','delete'),true);
 assert.equal(access.hasAdminAction({...limited,adminActionPermissions:{}},'events','create'),false);
 assert.equal(access.hasAdminAction(limited,'accounts','view'),false);
});
test('new action grants cannot exceed the grantor and unknown grants are rejected',()=>{
 assert.equal(typeof access.validateAdminActions,'function');
 assert.deepEqual(access.validateAdminActions(limited,['events'],{events:['view']}),{events:['view']});
 assert.throws(()=>access.validateAdminActions(limited,['events'],{events:['view','delete']}),/permission|grant|access/i);
 assert.throws(()=>access.validateAdminActions(limited,['events'],{events:['view','unknown']}),/valid|unknown/i);
 assert.throws(()=>access.validateAdminActions(limited,['events'],undefined),/permission|grant|access/i);
});
test('named administrator roles include only actions the creating admin may grant',()=>{
 assert.equal(typeof access.adminRoleGrant,'function');
 const owner=access.adminRoleGrant({role:'admin'},'event_admin');assert.ok(owner.permissions.includes('events'));assert.ok(owner.actions.events.includes('delete'));
 const child=access.adminRoleGrant(limited,'event_admin');assert.deepEqual(child.permissions,['events']);assert.deepEqual(child.actions.events,['view','create']);assert.equal(child.role,'event_admin');
 assert.equal(child.permissions.includes('administrators'),false);
});
test('role labels cannot disguise permissions outside that role or create an owner',()=>{
 assert.equal(typeof access.validateAdminRole,'function');
 assert.equal(access.validateAdminRole('event_admin',['events'],{events:['view']}),'event_admin');
 assert.throws(()=>access.validateAdminRole('event_admin',['accounts'],{accounts:['view']}),/role|permission/i);
 assert.throws(()=>access.validateAdminRole('owner',[],{}),/role|valid/i);
 assert.equal(access.validateAdminRole(undefined,['events'],{events:['view']}),'custom');
});
