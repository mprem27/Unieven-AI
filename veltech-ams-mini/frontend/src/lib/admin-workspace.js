import {ADMIN_ACTIONS,ADMIN_PERMISSIONS,adminActionsFor,canAccessAcademics,hasAdminAction} from '../../../shared/admin-access.mjs';
import {calendarDateRange} from './academic-calendar.js';

const NAV_GROUPS=[
 {label:'Workspace',links:[
  {to:'/management',label:'Overview',icon:'LayoutDashboard'},
  {to:'/admin/directory',label:'People & access',phoneLabel:'People',icon:'Users',permissions:['accounts','administrators']}
 ]},
 {label:'Publishing',links:[
  {to:'/faculty-exams',label:'Exam schedules',phoneLabel:'Exams',icon:'GraduationCap',permission:'examinations',end:false},
  {to:'/admin/manage/events',label:'Events',icon:'CalendarDays',permission:'events'},
  {to:'/campus-documents/manage',label:'Campus documents',icon:'FileText',academic:true},
  {to:'/admin/manage/notices',label:'News & notices',icon:'BookOpen',permission:'notices'},
  {to:'/forms',label:'Forms & responses',phoneLabel:'Forms',icon:'FileText',permission:'forms',end:false},
  {to:'/admin/manage/placements',label:'Placements',icon:'BriefcaseBusiness',permission:'placements'},
  {to:'/admin/messages',label:'Messages & email',phoneLabel:'Messages',icon:'Mail',permission:'communications'}
 ]},
 {label:'Operations',links:[
  {to:'/academic-calendar',label:'Calendar & holidays',phoneLabel:'Calendar',icon:'CalendarRange',permission:'calendar'},
  {to:'/schedules/manage',label:'Semester schedules',icon:'CalendarRange',permission:'calendar'},
  {to:'/event-operations',label:'Event operations',icon:'ClipboardList',permission:'events'},
  {to:'/admin/moderation',label:'Community moderation',icon:'ShieldCheck',permission:'moderation'},
  {to:'/academic-admin',label:'Academic records',icon:'BookOpen',academic:true}
 ]},
 {label:'System',links:[
  {to:'/app-feedback/manage',label:'Issues & feedback',icon:'MessageSquare',permission:'support'},
  {to:'/admin/manage/audit',label:'Operation audit',icon:'History',permission:'audit'},
  {to:'/admin/access-history',label:'Sign-in history',icon:'History',permission:'audit'},
  {to:'/admin/publishing-choices',label:'Departments & clubs',icon:'Users',updatePermission:'accounts'},
  {to:'/settings',label:'Settings',icon:'Settings',end:false}
 ]}
];

export function adminNavigationFor(profile){
 return NAV_GROUPS.map(group=>({...group,links:group.links.filter(link=>link.updatePermission?hasAdminAction(profile,link.updatePermission,'update'):link.academic?canAccessAcademics(profile):link.permissions?link.permissions.some(key=>hasAdminAction(profile,key,'view')):!link.permission || hasAdminAction(profile,link.permission,'view')).map(link=>({end:true,...link}))})).filter(group=>group.links.length);
}

export function adminPageTitle(pathname,groups){
 if(['/admin/manage/users','/admin/roles'].includes(pathname))return 'Roles & accounts';
 if(pathname.startsWith('/admin/directory/'))return 'Account details';
 if(pathname==='/faculty-exams/new')return 'New exam schedule';
 if(pathname.startsWith('/faculty-exams/'))return 'Review exam schedule';
 if(pathname==='/events/new')return 'Create event';
 if(/^\/events\/[^/]+\/edit$/.test(pathname))return 'Edit event';
 return groups.flatMap(group=>group.links).find(link=>pathname===link.to || !link.end && pathname.startsWith(link.to+'/'))?.label || 'Campus administration';
}

export function adminOverviewResources(profile,today){
 return {plans:hasAdminAction(profile,'examinations','view')?'/exam-plans':null,calendar:hasAdminAction(profile,'calendar','view')?'/academic-calendar/manage?'+new URLSearchParams(calendarDateRange(today,{before:0,after:30})):null};
}

const METRICS=[
 {key:'students',label:'Students',permission:'accounts',icon:'GraduationCap',to:'/admin/directory?role=student'},
 {key:'faculty',label:'Faculty',permission:'accounts',icon:'Users',to:'/admin/directory?role=faculty'},
 {key:'administrators',label:'Administrators',permission:'administrators',icon:'ShieldCheck',to:'/admin/directory?role=admin'},
 {key:'activeEvents',label:'Active events',permission:'events',icon:'CalendarDays',to:'/admin/manage/events'},
 {key:'registrations',label:'Registrations',permission:'events',icon:'Ticket',to:'/event-operations'},
 {key:'attended',label:'Event check-ins',permission:'events',icon:'ClipboardList',to:'/event-operations'}
];
export function adminOverviewMetrics(profile,counts={}){
 return METRICS.filter(metric=>hasAdminAction(profile,metric.permission,'view') && typeof counts[metric.key]==='number' && Number.isFinite(counts[metric.key])).map(metric=>({...metric,value:counts[metric.key]}));
}

const PERMISSION_GROUPS=[
 {label:'People & access',keys:['accounts','administrators']},
 {label:'Publishing',keys:['examinations','events','notices','forms','placements','communications']},
 {label:'Campus operations',keys:['calendar','moderation','academics.read','academics.write','academics.rules']},
 {label:'System & support',keys:['support','audit']}
];
export function adminPermissionGroups(actor,query=''){
 const search=query.trim().toLowerCase();
 return PERMISSION_GROUPS.map(group=>({label:group.label,modules:group.keys.map(key=>({key,label:ADMIN_PERMISSIONS[key],actions:adminActionsFor(actor,key)})).filter(module=>module.actions.length && `${group.label} ${module.label} ${module.key}`.toLowerCase().includes(search))})).filter(group=>group.modules.length);
}

function grantableSelection(actor,permissions,actions){
 const selected=permissions.filter(key=>adminActionsFor(actor,key).length);
 return {permissions:selected,actions:Object.fromEntries(selected.map(key=>[key,adminActionsFor(actor,key).filter(action=>actions==null || actions[key]?.includes(action))]))};
}
export function toggleAdminModule(actor,permissions,actions,key,checked){
 const next=grantableSelection(actor,permissions,actions),available=adminActionsFor(actor,key);
 if(!available.length)return next;
 next.permissions=checked?[...new Set([...next.permissions,key])]:next.permissions.filter(value=>value!==key);
 if(checked)next.actions[key]=available.includes('view')?['view']:[available[0]];
 else delete next.actions[key];
 return next;
}
export function toggleAdminAction(actor,permissions,actions,key,action,checked){
 const next=grantableSelection(actor,permissions,actions);
 if(!next.permissions.includes(key) || !adminActionsFor(actor,key).includes(action))return next;
 next.actions[key]=Object.keys(ADMIN_ACTIONS).filter(value=>checked?next.actions[key].includes(value) || value===action:next.actions[key].includes(value) && value!==action);
 return next;
}

export function eventWorkspaceTabs(profile,event){
 const admin=[profile?.role,profile?.accountRole,profile?.campusRole].includes('admin'),staff=profile?.accountRole==='faculty' || ['club_organizer','department_coordinator','college_event_manager'].includes(profile?.campusRole);
 const can=action=>!event.archivedAt && (admin?hasAdminAction(profile,'events',action):staff);
 return [['analytics','Analytics'],...(can('update')?[['edit','Edit event']]:[]),['waitlist','Waitlist'],...(can('delete')?[['archive','Archive']]:[])];
}
