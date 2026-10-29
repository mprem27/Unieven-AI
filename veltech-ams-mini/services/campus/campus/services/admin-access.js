import {hasAdminAction} from '../../../../shared/admin-access.mjs';
import {campusRole} from '../policy.js';
import {fail} from '../security.js';
export function requireAdminAction(user,permission,action='view'){
 if(campusRole(user)!=='admin' || !hasAdminAction(user,permission,action))fail(403,'This administrator is not assigned that action permission.');
}
export function adminAccessGuard(req,_res,next){
 if(!req.user || campusRole(req.user)!=='admin')return next();
 let path;try{path=decodeURIComponent(req.path).toLowerCase().replace(/\/+$/,'') || '/';}catch{fail(400,'Invalid request path.');}
 const read=['GET','HEAD','OPTIONS'].includes(req.method);let permission,action=read?'view':req.method==='DELETE'?'delete':['PATCH','PUT'].includes(req.method)?'update':'create';
 if(path.startsWith('/academic-admin/'))permission=['/academic-admin/audit-logs','/academic-admin/sms-logs'].includes(path)?'audit':read?'academics.read':'academics.write';
 else if(path==='/academic-rules' && !read || path.startsWith('/academic-rules/'))permission='academics.rules';
 else if(path.startsWith('/community/reports/admin') || path.startsWith('/admin/community'))permission='moderation';
 else if(path==='/app-feedback/manage' || path.startsWith('/app-feedback/') && !read)permission='support';
 else if(path.startsWith('/faculty-exams') || path.startsWith('/exam-plans'))permission='examinations';
 else if(path.startsWith('/academic-calendar/manage') || path.startsWith('/academic-calendar') && !read || path.startsWith('/timetable-rooms') && !read)permission='calendar';
 else if(path.startsWith('/notices') && !read)permission='notices';
 else if(path==='/event-policy' && !read || path==='/events' && !read || /^\/events\/[a-f0-9]{24}\/(?:participants|analytics|operations|staff|messages|waitlist|community-post)/.test(path) || /^\/events\/[a-f0-9]{24}$/.test(path) && !read || path.startsWith('/check-in') || /^\/registrations\/[a-f0-9]{24}\/check-in/.test(path))permission='events';
 else if(path.startsWith('/placements') && !read && !/\/(?:save|application)$/.test(path))permission='placements';
 else if(path.startsWith('/forms/proofs/') || /^\/forms\/[a-f0-9]{24}\/responses\/[a-f0-9]{24}\/review$/.test(path))permission='forms';
 else if(path==='/forms' && !read || /^\/forms\/[a-f0-9]{24}(?:\/responses(?:\/export)?|\/export)?$/.test(path) && (!read || path.includes('/responses') || path.endsWith('/export')))permission='forms';
 if(path.startsWith('/exam-plans/') && /\/(?:publish|import)$/.test(path) || /\/seating\/allocate$/.test(path))action='update';
 if(path.startsWith('/exam-plans/') && path.endsWith('/withdraw'))action='delete';
 if(path.endsWith('/community-post'))action='update';
 if(path.endsWith('/export'))action='export';
 if(path.startsWith('/check-in') || /\/check-in$/.test(path) || /\/staff$/.test(path) && !read)action='update';
 if(permission)requireAdminAction(req.user,permission,action);
 next();
}
