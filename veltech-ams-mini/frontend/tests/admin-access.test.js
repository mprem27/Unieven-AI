import test from 'node:test';import assert from 'node:assert/strict';
import * as access from '../../shared/admin-access.mjs';
test('one sign-in opens a useful permitted workspace for students, faculty, owners and limited administrators',()=>{
 assert.equal(typeof access.workspaceStartPage,'function');
 assert.equal(access.workspaceStartPage({accountRole:'student'}),'home');
 assert.equal(access.workspaceStartPage({accountRole:'faculty'}),'forms');
 assert.equal(access.workspaceStartPage({accountRole:'admin',isAdminOwner:true,adminPermissions:[]}),'management');
 assert.equal(access.workspaceStartPage({accountRole:'admin',adminPermissions:['support']}),'management');
 assert.equal(access.workspaceStartPage({accountRole:'admin',adminPermissions:['academics.read']}),'academic-admin');
 assert.equal(access.workspaceStartPage({accountRole:'admin',adminPermissions:['calendar']}),'academic-calendar');
 assert.equal(access.workspaceStartPage({accountRole:'admin',adminPermissions:['forms']}),'forms');
});
