export const ADMIN_PERMISSIONS={communications:'Campus and event messages',events:'Events and check-in',accounts:'Student and faculty accounts',administrators:'Create and manage limited admins',placements:'Placements',notices:'College notices',moderation:'Community reports',forms:'Faculty forms and evidence',support:'App issues and feedback',calendar:'Calendar and room overrides',examinations:'Faculty examinations','academics.read':'View academic workspaces','academics.write':'Edit app academic records','academics.rules':'Batch percentage rules',audit:'Audit history'};
const admin=user=>!!user && user.isActive!==false && [user.role,user.accountRole,user.campusRole].includes('admin');
export const isAdminOwner=user=>admin(user) && (user.isAdminOwner===true || user.adminPermissions==null);
export const adminPermissionsFor=user=>!admin(user)?[]:isAdminOwner(user)?Object.keys(ADMIN_PERMISSIONS):Array.isArray(user.adminPermissions)?Object.keys(ADMIN_PERMISSIONS).filter(key=>user.adminPermissions.includes(key)):[];
export const hasAdminPermission=(user,permission)=>{const keys=adminPermissionsFor(user);return keys.includes(permission) || permission==='academics.read' && keys.includes('academics.write');};
export const canAccessAcademics=user=>hasAdminAction(user,'academics.read','view') || hasAdminAction(user,'academics.write','view') || hasAdminAction(user,'academics.rules','view');
export function workspaceStartPage(user){
 if(!admin(user))return (user?.accountRole || user?.role)==='faculty'?'forms':'home';
 if(['events','accounts','administrators','placements','notices','moderation','support','audit'].some(key=>hasAdminPermission(user,key)))return 'management';
 if(canAccessAcademics(user))return 'academic-admin';
 if(hasAdminPermission(user,'calendar'))return 'academic-calendar';
 if(hasAdminPermission(user,'examinations'))return 'faculty-exams';
 return hasAdminPermission(user,'forms')?'forms':'management';
}

export const ADMIN_ACTIONS={view:'View',create:'Create',update:'Update',delete:'Delete / deactivate',export:'Export'};
export const ADMIN_ROLE_PRESETS={
 event_admin:{label:'Event administrator',grants:{events:['view','create','update','delete','export']}},
 exam_admin:{label:'Examination administrator',grants:{examinations:['view','create','update','delete','export'],calendar:['view','create','update']}},
 moderator:{label:'Community moderator',grants:{moderation:['view','delete'],support:['view','update']}},
 news_editor:{label:'News editor',grants:{notices:['view','create','update','delete'],communications:['view','create']}},
 student_support:{label:'Student support administrator',grants:{accounts:['view'],support:['view','update'],'academics.read':['view']}},
 access_manager:{label:'Account and access administrator',grants:{accounts:['view','create','update','delete'],administrators:['view','create','update','delete']}}
};
export const adminRoleLabel=user=>isAdminOwner(user)?'Owner administrator':ADMIN_ROLE_PRESETS[user?.adminAccessRole]?.label || 'Custom administrator';
export function adminRoleGrant(actor,role){
 const preset=typeof role==='string' && Object.hasOwn(ADMIN_ROLE_PRESETS,role)?ADMIN_ROLE_PRESETS[role]:null;if(!preset)throw Object.assign(new Error('Choose a valid administrator role.'),{status:400});
 const actions={};for(const [permission,values] of Object.entries(preset.grants)){const permitted=values.filter(action=>hasAdminAction(actor,permission,action));if(permitted.length)actions[permission]=permitted;}
 return {role,permissions:Object.keys(actions),actions};
}
export function validateAdminRole(value,permissions,actions){
 const role=value ?? 'custom';if(role==='custom')return role;
 const preset=typeof role==='string' && Object.hasOwn(ADMIN_ROLE_PRESETS,role)?ADMIN_ROLE_PRESETS[role]:null;
 if(!preset)throw Object.assign(new Error('Choose a valid administrator role.'),{status:400});
 if(!permissions.length || permissions.some(key=>!preset.grants[key] || (actions[key] || []).some(action=>!preset.grants[key].includes(action))))throw Object.assign(new Error('The selected permissions exceed this administrator role. Choose Custom access to configure different limits.'),{status:403});
 return role;
}
export function adminActionsFor(user,permission){
 if(!hasAdminPermission(user,permission))return [];
 if(isAdminOwner(user) || user.adminActionPermissions==null)return Object.keys(ADMIN_ACTIONS);
 const own=user.adminActionPermissions[permission] ?? (permission==='academics.read'?user.adminActionPermissions['academics.write']:undefined);
 return Array.isArray(own)?Object.keys(ADMIN_ACTIONS).filter(action=>own.includes(action)):[];
}
export const hasAdminAction=(user,permission,action='view')=>adminActionsFor(user,permission).includes(action);
export function validateAdminActions(actor,permissions,input){
 const reject=message=>{throw Object.assign(new Error(message),{status:403});};
 if(!Array.isArray(permissions) || permissions.some(key=>!Object.hasOwn(ADMIN_PERMISSIONS,key)))reject('Choose valid administrator permissions.');
 if(input!==undefined && (!input || typeof input!=='object' || Array.isArray(input) || Object.keys(input).some(key=>!permissions.includes(key))))reject('Choose valid action permissions for the selected areas.');
 const result={};
 for(const key of permissions){
  const actions=input===undefined?Object.keys(ADMIN_ACTIONS):input[key] || [];
  if(!Array.isArray(actions) || actions.some(action=>!Object.hasOwn(ADMIN_ACTIONS,action)))reject('Unknown administrator action. Choose valid actions.');
  if(actions.some(action=>!hasAdminAction(actor,key,action)))reject('You cannot grant action permissions beyond your own access.');
  result[key]=Object.keys(ADMIN_ACTIONS).filter(action=>actions.includes(action));
 }
 return result;
}
