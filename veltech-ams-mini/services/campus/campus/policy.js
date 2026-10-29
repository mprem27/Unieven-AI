import {sameDepartment,sameClub} from '../../../shared/publishing-directory.mjs';
import {hasAdminPermission,adminPermissionsFor,isAdminOwner} from '../../../shared/admin-access.mjs';
export const ROLES = ['student','club_organizer','department_coordinator','college_event_manager','placement_officer','admin'];
export function campusRole(user) {
  if (user?.role === 'admin') return 'admin';
  return ROLES.includes(user?.campusRole) ? user.campusRole : 'student';
}
const id = value => String(value?._id ?? value ?? '');
export function canCreateEvent(user, event) {
  const role = campusRole(user);
  if (role === 'admin') return hasAdminPermission(user,'events');
  if (event.scope === 'club') return role === 'club_organizer' && !!user.club && sameClub(user.club,event.club,user.department) && !!user.department && sameDepartment(user.department,event.department);
  if (event.scope === 'department') return role === 'department_coordinator' && !!user.department && sameDepartment(user.department,event.department);
  return event.scope === 'college' && role === 'college_event_manager';
}
export function canManageEvent(user, event) {
  if (!user || !event) return false;
  if (campusRole(user) === 'admin') return hasAdminPermission(user,'events');
  if (!event.scope || event.scope === 'legacy') return id(user.id ?? user._id) === id(event.createdBy);
  return canCreateEvent(user, event);
}
export function canCheckInEvent(user,event){
  if(!user || !event || user.isActive===false)return false;
  return canManageEvent(user,event) || (user.role==='faculty' && event.scope==='department' && !!user.department?.trim() && sameDepartment(user.department,event.department));
}
export const canManagePlacements = user => campusRole(user)==='admin'?hasAdminPermission(user,'placements'):campusRole(user)==='placement_officer';
export function publicUser(user) {
  return {id:id(user._id ?? user.id),name:user.name || user.username,email:user.email,username:user.username,image:user.image,department:user.department,studentId:user.studentId,phone:user.phone,campusRole:campusRole(user),accountRole:user.role,hasEventAssignment:!!user.hasEventAssignment,adminPermissions:adminPermissionsFor(user),adminActionPermissions:user.adminActionPermissions,adminAccessRole:user.adminAccessRole || 'custom',isAdminOwner:isAdminOwner(user),adminCreatedBy:user.adminCreatedBy?String(user.adminCreatedBy):null,club:user.club || '',bio:user.bio || '',socialDepartment:user.socialDepartment || '',socialLinks:publicSocialLinks(user),isPrivate:!!user.isPrivate,isVerified:!!user.isVerified,isActive:user.isActive!==false,portalOnly:!!user.portalOnly,portalPrincipal:user.portalPrincipal || '',recoveryEmail:user.recoveryEmail || '',recoveryEmailVerifiedAt:user.recoveryEmailVerifiedAt || null};
}
import {publicSocialLinks} from './services/community-policy.js';
