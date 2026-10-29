import {sameDepartment} from '../../../../shared/publishing-directory.mjs';
import {syncAdminAccount} from '../services/admin-records.js';
import {ADMIN_PERMISSIONS,hasAdminPermission,adminPermissionsFor,isAdminOwner,hasAdminAction,adminActionsFor,validateAdminActions,validateAdminRole} from '../../../../shared/admin-access.mjs';
import bcrypt from 'bcrypt';
import User from '../../models/User.js';
import Event from '../../models/Event.js';
import {Audit,Notice,Session,AcademicLink} from '../models.js';
import {ROLES,campusRole,publicUser,canManageEvent} from '../policy.js';
import {fail,validateId,httpUrl} from '../security.js';
export function registerManagement(router,config) {
  const admin=(req,_res,next)=>{if(campusRole(req.user)!=='admin')fail(403,'Administrator access required');next();};
  const requirePermission=(user,key,action='view')=>{if(!hasAdminAction(user,key,action))fail(403,'This administrator account is not assigned that permission.');};
  const grant=(actor,value)=>{
    requirePermission(actor,'administrators');
    if(!Array.isArray(value) || value.some(key=>typeof key!=='string' || !Object.hasOwn(ADMIN_PERMISSIONS,key)) || new Set(value).size!==value.length)fail(400,'Choose explicit administrator permissions.');
    const permissions=Object.keys(ADMIN_PERMISSIONS).filter(key=>value.includes(key));
    if(permissions.some(key=>!hasAdminPermission(actor,key)))fail(403,'You cannot grant permissions you do not hold.');
    return permissions;
  };
  async function targetAccount(req){validateId(req.params.id);const user=await User.findById(req.params.id);if(!user)fail(404,'User not found');return user;}
  function manageTarget(actor,target,wantsAdmin=false,action='update'){
    if(campusRole(target)==='admin' || wantsAdmin){
      requirePermission(actor,'administrators',action);
      if(!isAdminOwner(actor) && (String(actor._id)===String(target._id) || isAdminOwner(target) || String(target.adminCreatedBy)!==String(actor._id) || adminPermissionsFor(target).some(key=>adminActionsFor(target,key).some(action=>!hasAdminAction(actor,key,action)))))fail(403,'You can manage only limited administrators you created within your own permissions.');
    }else requirePermission(actor,'accounts',action);
  }
  router.get('/management',config.auth,async(req,res)=>{
    if(campusRole(req.user)==='student')fail(403,'Staff access required');
    const events=campusRole(req.user)==='admin' && !hasAdminAction(req.user,'events','view')?[]:(await Event.find().lean()).filter(e=>canManageEvent(req.user,e));
    const canAccounts=hasAdminAction(req.user,'accounts','view'),canAdmins=hasAdminAction(req.user,'administrators','view');
    let users=canAccounts || canAdmins?await User.find().limit(200):[];
    users=users.filter(user=>campusRole(user)==='admin'?canAdmins && (isAdminOwner(req.user) || String(user.adminCreatedBy)===String(req.user._id)):canAccounts);
    const notices=hasAdminAction(req.user,'notices','view')?await Notice.find().sort({createdAt:-1}).limit(100).lean():[];
    res.json({events:events.map(e=>({...e,id:String(e._id)})),roles:ROLES,users:users.map(publicUser),notices:notices.map(n=>({...n,id:String(n._id)})),permissions:ADMIN_PERMISSIONS,audit:hasAdminAction(req.user,'audit','view')?await Audit.find().sort({createdAt:-1}).limit(30).lean():[]});
  });
  router.patch('/management/users/:id',config.auth,admin,async(req,res)=>{
    const target=await targetAccount(req),{campusRole:role,department='',club='',accountRole='student'}=req.body || {};
    manageTarget(req.user,target,role==='admin');
    if(!ROLES.includes(role) || typeof department!=='string' || typeof club!=='string' || department.length>120 || club.length>120)fail(400,'Choose a valid role and scope');
    if(['club_organizer','department_coordinator'].includes(role) && !department.trim())fail(400,'A department is required for this role');
    if(role==='club_organizer' && !club.trim())fail(400,'A club is required for a club organizer');
    if(!['student','faculty'].includes(accountRole) || accountRole==='faculty' && (role!=='student' || !department.trim()))fail(400,'Faculty accounts need an assigned department and student campus role');
    if(isAdminOwner(target) && (role!=='admin' || req.body.adminPermissions!==undefined))fail(409,'Owner administrator access is protected. Configure a limited administrator instead.');
    if(target.id===req.user.id && role!=='admin')fail(409,'Ask another administrator to change your own administrator role');
    const fields={campusRole:role,role:role==='admin'?'admin':accountRole,department:department.trim(),club:club.trim()};
    if(role==='admin' && !isAdminOwner(target)){fields.adminPermissions=grant(req.user,req.body.adminPermissions ?? target.adminPermissions ?? []);fields.adminActionPermissions=validateAdminActions(req.user,fields.adminPermissions,req.body.adminActionPermissions ?? target.adminActionPermissions);fields.adminAccessRole=validateAdminRole(req.body.adminAccessRole ?? target.adminAccessRole,fields.adminPermissions,fields.adminActionPermissions);fields.adminCreatedBy=target.adminCreatedBy || req.user._id;}
    if(role!=='admin'){fields.adminPermissions=[];fields.adminActionPermissions={};fields.adminAccessRole='custom';}
    const user=await User.findByIdAndUpdate(target.id,{$set:fields},{returnDocument:'after'});await Session.deleteMany({user:user._id});await syncAdminAccount(user);
    await Audit.create({actor:req.user._id,action:'role.assign',target:user.id,details:JSON.stringify({role,accessRole:fields.adminAccessRole,permissions:fields.adminPermissions || []})});res.json(publicUser(user));
  });
  async function setAccountActive(req,res,active){
    const user=await targetAccount(req);manageTarget(req.user,user,false,active?'update':'delete');
    if(!active && isAdminOwner(user))fail(409,'Owner administrator accounts cannot be deactivated here');
    if(!active && user.id===req.user.id)fail(409,'You cannot deactivate your own account');
    await User.updateOne({_id:user._id},{$set:{isActive:active}});if(!active)await Session.deleteMany({user:user._id});await syncAdminAccount({...user.toObject(),isActive:active});
    await Audit.create({actor:req.user._id,action:active?'user.activate':'user.deactivate',target:user.id});res.json({id:user.id,isActive:active,deactivated:!active});
  }
  router.patch('/management/users/:id/status',config.auth,admin,async(req,res)=>{if(typeof req.body?.active!=='boolean')fail(400,'Choose an active state');await setAccountActive(req,res,req.body.active);});
  router.delete('/management/users/:id',config.auth,admin,async(req,res)=>setAccountActive(req,res,false));
  router.post('/management/users/:id/reset-password',config.auth,admin,async(req,res)=>{
    const user=await targetAccount(req);manageTarget(req.user,user);const password=req.body?.password;
    if((user.portalPrincipal || await AcademicLink.exists({user:user._id})) && !hasAdminPermission(req.user,'academics.write'))fail(403,'Changing a linked student account requires academic write permission.');
    if(typeof password!=='string' || password.length<12 || Buffer.byteLength(password,'utf8')>72)fail(400,'Use a password of at least 12 characters and at most 72 UTF-8 bytes');
    await User.updateOne({_id:user._id},{$set:{password:await bcrypt.hash(password,12),portalOnly:false}});await Session.deleteMany({user:user._id});
    await Audit.create({actor:req.user._id,action:'user.password-reset',target:user.id});res.json({success:true});
  });
  router.post('/management/users',config.auth,admin,async(req,res)=>{
    const {name,email,username,password,department='',studentId='',accountRole='student'}=req.body || {};
    if(!['student','faculty','admin'].includes(accountRole))fail(400,'Choose a valid account type.');
    requirePermission(req.user,accountRole==='admin'?'administrators':'accounts','create');
    const permissions=accountRole==='admin'?grant(req.user,req.body.adminPermissions ?? []):[];
    const actions=accountRole==='admin'?validateAdminActions(req.user,permissions,req.body.adminActionPermissions):undefined;
    const accessRole=accountRole==='admin'?validateAdminRole(req.body.adminAccessRole,permissions,actions):'custom';
    if(typeof name!=='string' || !name.trim() || name.length>120 || typeof email!=='string' || email.length>254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || typeof username!=='string' || !/^[a-z0-9_.]{3,30}$/.test(username) || typeof password!=='string' || password.length<12 || Buffer.byteLength(password,'utf8')>72 || typeof department!=='string' || department.length>120 || typeof studentId!=='string' || studentId.length>100 || accountRole==='faculty' && !department.trim())fail(400,'Enter valid account details, faculty department and a password of 12 characters to 72 UTF-8 bytes');
    const user=await User.create({name:name.trim(),email:email.toLowerCase().trim(),username,password:await bcrypt.hash(password,12),department:department.trim(),studentId,role:accountRole,campusRole:accountRole==='admin'?'admin':'student',...(accountRole==='admin'?{adminPermissions:permissions,adminActionPermissions:actions,adminAccessRole:accessRole,adminCreatedBy:req.user._id}:{}),isVerified:true});
    await syncAdminAccount(user);
    await Audit.create({actor:req.user._id,action:'user.create',target:user.id,details:JSON.stringify({accountRole,accessRole,permissions})});res.status(201).json(publicUser(user));
  });
  function noticeFields(body,user){
    const role=campusRole(user);if(!['admin','department_coordinator','college_event_manager','placement_officer'].includes(role))fail(403,'Staff publishing access required');
    if(role==='admin')requirePermission(user,'notices');
    const {title,body:content='',category='General',department='',url=''}=body || {};
    if(typeof title!=='string' || !title.trim() || title.length>160 || typeof content!=='string' || content.length>5000 || typeof category!=='string' || category.length>80 || typeof department!=='string' || department.length>120)fail(400,'Enter a notice title and content');
    if(role==='department_coordinator' && !sameDepartment(department,user.department))fail(403,'Publish only for your assigned department');
    return {title:title.trim(),body:content,category,department,url:httpUrl(url)};
  }
  async function editableNotice(req){
    const notice=await Notice.findById(validateId(req.params.id));if(!notice)fail(404,'Notice not found');
    if(campusRole(req.user)==='admin')requirePermission(req.user,'notices');
    else if(String(notice.createdBy)!==String(req.user._id))fail(403,'You can edit only your own notices');
    return notice;
  }
  router.post('/notices',config.auth,async(req,res)=>{const value=noticeFields(req.body,req.user),notice=await Notice.create({...value,createdBy:req.user._id});await Audit.create({actor:req.user._id,action:'notice.create',target:notice.id});res.status(201).json({id:notice.id});});
  router.patch('/notices/:id',config.auth,async(req,res)=>{const notice=await editableNotice(req),value=noticeFields(req.body,req.user);Object.assign(notice,value);await notice.save();await Audit.create({actor:req.user._id,action:'notice.update',target:notice.id});res.json({id:notice.id,...value});});
  router.delete('/notices/:id',config.auth,async(req,res)=>{const notice=await editableNotice(req);noticeFields(notice.toObject(),req.user);await notice.deleteOne();await Audit.create({actor:req.user._id,action:'notice.delete',target:notice.id});res.json({id:notice.id,deleted:true});});
}
