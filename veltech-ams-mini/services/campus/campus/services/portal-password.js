import {campusRole} from '../policy.js';
// This verifies an existing application binding, not a new university session.
export function verifiedPortalStudent(user){
 return user?.portalOnly===true && user.isActive!==false && user.role==='student' && campusRole(user)!=='admin'
  && /^vtu[0-9]{3,12}$/i.test(user.portalPrincipal || '') && !!user.portalPrincipalVerifiedAt
  && /^[a-f0-9]{24}$/i.test(user.portalAcademicId || '');
}
export const canUsePortalPassword=user=>verifiedPortalStudent(user) && !!user.portalPasswordSetAt;
