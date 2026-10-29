import {activeEventQuery} from '../services/event-publication.js';
import {academicLinks} from '../services/academic-links.js';
import {Placement,CampusPost} from '../models.js';
import User from '../../models/User.js';
import Event from '../../models/Event.js';
import Registration from '../../models/EventRegistration.js';
import {Audit,AcademicLink} from '../models.js';
import {AdminAccount,AdminLoginEvent,AccountAccessEvent} from '../models/admin-records.js';
import {publicUser,campusRole} from '../policy.js';
import {hasAdminAction,isAdminOwner} from '../../../../shared/admin-access.mjs';
import {requireAdminAction} from '../services/admin-access.js';
import {syncAdminAccount} from '../services/admin-records.js';
import {fail,validateId} from '../security.js';
const admin=(req,_res,next)=>{if(campusRole(req.user)!=='admin')fail(403,'Administrator access required.');next();};
export function registerAdminDirectory(router,config){
 router.get('/admin/overview',config.auth,admin,async(req,res)=>{
  await syncAdminAccount(req.user);const can=key=>hasAdminAction(req.user,key,'view');
  const counts={};
  if(can('accounts')){counts.members=await User.countDocuments();counts.students=await User.countDocuments({role:'student'});counts.faculty=await User.countDocuments({role:'faculty'});}
  if(can('administrators'))counts.administrators=await User.countDocuments({role:'admin'});
  if(can('events')){counts.activeEvents=await Event.countDocuments(activeEventQuery());counts.registrations=await Registration.countDocuments({status:{$in:['registered','attended']}});counts.attended=await Registration.countDocuments({status:'attended'});}
  const audit=can('audit')?await Audit.find().sort({createdAt:-1}).limit(12).lean():[];
  res.json({counts,audit,mailConfigured:!!config.mail?.configured,owner:isAdminOwner(req.user),account:publicUser(req.user)});
 });
 router.get('/admin/directory',config.auth,admin,async(req,res)=>{
  const canAccounts=hasAdminAction(req.user,'accounts','view'),canAdmins=hasAdminAction(req.user,'administrators','view');
  if(!canAccounts && !canAdmins)fail(403,'Directory viewing permission is required.');
  const role=req.query.role || 'all',q=String(req.query.q || '').trim();if(!['all','student','faculty','admin'].includes(role) || q.length>120)fail(400,'Choose a valid directory filter.');
  if(role==='admin' && !canAdmins || ['student','faculty'].includes(role) && !canAccounts)fail(403,'This account type is outside your directory access.');
  const visible=canAccounts && canAdmins?{}:{role:canAdmins?'admin':{$ne:'admin'}};
  const query={$and:[visible,...(role==='all'?[]:[{role}]),...(!isAdminOwner(req.user)?[{$or:[{role:{$ne:'admin'}},{_id:req.user._id},{adminCreatedBy:req.user._id}]}]:[])]};
  if(q){const escaped=q.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');query.$and.push({$or:['name','username','email','studentId','department','portalPrincipal'].map(key=>({[key]:{$regex:escaped,$options:'i'}}))});}
  const page=Math.max(1,Math.min(10000,Number(req.query.page) || 1)),limit=50;
  const [users,total]=await Promise.all([User.find(query).sort({name:1,_id:1}).skip((page-1)*limit).limit(limit),User.countDocuments(query)]);
  res.json({users:users.map(publicUser),total,page,pages:Math.ceil(total/limit)});
 });
 router.get('/admin/directory/:id/academic',config.auth,admin,async(req,res)=>{
  requireAdminAction(req.user,'accounts','view');requireAdminAction(req.user,'academics.read','view');
  const user=await User.findById(validateId(req.params.id));if(!user || user.role!=='student')fail(404,'Student account not found.');
  const data=await academicLinks(config).read(user,'/campus/workspace');
  await Audit.create({actor:req.user._id,action:'student.academic-view',target:user.id});res.json(data);
 });

 router.get('/admin/directory/:id',config.auth,admin,async(req,res)=>{
  const user=await User.findById(validateId(req.params.id));if(!user)fail(404,'Account not found.');
  requireAdminAction(req.user,user.role==='admin'?'administrators':'accounts','view');
  if(user.role==='admin' && !isAdminOwner(req.user) && String(user._id)!==String(req.user._id) && String(user.adminCreatedBy)!==String(req.user._id))fail(403,'This administrator is outside your assigned accounts.');
  const result={account:publicUser(user)};
  if(hasAdminAction(req.user,'audit','view')){
   const rows=await Audit.find({$or:[{actor:user._id},{target:user.id}]}).sort({createdAt:-1}).limit(100).populate('actor','name username').lean();
   result.activity=rows.map(row=>({id:String(row._id),action:row.action,target:row.target,details:String(row.details || '').slice(0,2000),at:row.createdAt,actor:row.actor?{name:row.actor.name,username:row.actor.username}:null}));
   const logins=await AccountAccessEvent.find({user:user._id}).sort({at:-1}).limit(30).lean();result.signIns=logins.map(row=>({action:row.action,at:row.at}));result.activity=[...result.activity,...logins.map(row=>({id:String(row._id),action:'account.'+row.action,target:user.id,at:row.at,actor:{name:user.name,username:user.username}}))].sort((a,b)=>new Date(b.at)-new Date(a.at)).slice(0,100);
  }
  if(hasAdminAction(req.user,'events','view')){const tickets=await Registration.find({user:user._id}).select('event status createdAt checkedInAt').populate('event','title date').sort({createdAt:-1}).limit(100).lean();result.registrations=tickets.map(t=>({id:String(t._id),event:t.event?.title || 'Archived event',date:t.event?.date,status:t.status,registeredAt:t.createdAt}));}
  if(hasAdminAction(req.user,'placements','view')){const jobs=await Placement.find({'applications.user':user._id}).select('company title applications').limit(100).lean();result.applications=jobs.map(p=>({company:p.company,title:p.title,status:p.applications.find(a=>String(a.user)===user.id)?.status}));}
  if(hasAdminAction(req.user,'moderation','view'))result.community={posts:await CampusPost.countDocuments({user:user._id}),archived:await CampusPost.countDocuments({user:user._id,isArchived:true})};
  await Audit.create({actor:req.user._id,action:'account.view',target:user.id});
  res.set('Cache-Control','private, no-store');res.json(result);
 });
 router.get('/admin/access-history',config.auth,admin,async(req,res)=>{
  requireAdminAction(req.user,'audit','view');
  const rows=await AdminLoginEvent.find().sort({at:-1}).limit(100).populate('user','name username email').lean();
  res.json({entries:rows.map(row=>({id:String(row._id),action:row.action,at:row.at,account:row.user?{id:String(row.user._id),name:row.user.name,username:row.user.username,email:row.user.email}:null}))});
 });
}
