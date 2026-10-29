import {academicLinks} from '../services/academic-links.js';
import User from '../../models/User.js';
import {hasAdminPermission} from '../../../../shared/admin-access.mjs';
import {campusRole} from '../policy.js';
import {AcademicLink,Audit} from '../models.js';
import {encryptToken,decryptToken,fail,validateId} from '../security.js';

export function registerAcademics(router,config) {
  // Persisted, authenticated ciphertext is the cache. Do not keep a second
  // process-local token cache that could outlive a deleted owner link.
  const {linkFor,managedLink,read}=academicLinks(config);
  router.get('/university/sources',async(_req,res)=>res.json(await config.academic.request('','/campus/sources')));
  router.get('/university/news',async(_req,res)=>res.json(await config.academic.request('','/campus/news')));
  router.get('/academics/status',config.auth,async(req,res)=>{
    let link=await AcademicLink.findOne({user:req.user._id});
    if(config.bridgeEnabled && (!link || link.managed)) {
      try {({link}=await linkFor(req.user));}
      catch(error) {if(error.status===409)return res.json({connected:false,automatic:true,migrationRequired:true,message:error.message});throw error;}
    }
    res.json({connected:!!link,managed:!!link?.managed,automatic:config.bridgeEnabled,email:link?.email,linkedAt:link?.linkedAt});
  });
  router.post('/academics/link',config.auth,async(req,res)=>{
    const {email,password}=req.body;
    if(typeof email!=='string' || typeof password!=='string' || password.length>200) fail(400,'Enter your academic account email and password');
    if(email.trim().toLowerCase()!==req.user.email) fail(403,'Only your own academic account can be linked');
    if(!config.linkKey) fail(503,'The administrator must configure the persistent academic-link encryption key');
    let result;try {result=await config.academic.login(req.user.email,password);} catch {fail(401,'Could not verify your academic account credentials');}
    if(result.user?.email?.toLowerCase()!==req.user.email || !result.token || !result.user.id) fail(403,'Academic identity does not match your campus account');
    if(config.bridgeEnabled) {await managedLink(req.user,result.user.id);return res.json({connected:true,managed:true,email:req.user.email});}
    await AcademicLink.findOneAndUpdate({user:req.user._id},{$set:{academicId:result.user.id,email:req.user.email,sealedToken:encryptToken(result.token,config.linkKey),linkedAt:new Date()}},{upsert:true});
    res.json({connected:true,email:req.user.email});
  });
  router.delete('/academics/link',config.auth,async(req,res)=>{const link=await AcademicLink.findOne({user:req.user._id});if(link?.managed)fail(409,'Your academic workspace belongs to your campus account. Sign out to end access.');await AcademicLink.deleteOne({user:req.user._id});res.json({connected:false});});
  router.patch('/academics/notifications/read',config.auth,async(req,res)=>{
    const {token}=await linkFor(req.user);
    res.json(await config.academic.request(token,'/notifications/read-all','PATCH',{}));
  });
  router.get('/academics/overview',config.auth,async(req,res)=>{
    // New deployments use one private cached read instead of seven repeated
    // authentication/database round trips. Retain compatibility during upgrade.
    let bundle;
    try{bundle=await read(req.user,'/campus/workspace');}
    catch(error){if(![404,405].includes(error.status))throw error;}
    if(bundle?.workspaceVersion===1 && bundle.profile){res.set('Cache-Control','private, no-store');return res.json(bundle);}
    const {token}=await linkFor(req.user);
    const paths={profile:'/profile',summary:'/attendance/summary',records:'/attendance',timetable:'/timetable',subjects:'/subjects',snapshot:'/campus/snapshot',notifications:'/notifications'};
    const results=await Promise.allSettled(Object.values(paths).map(path=>config.academic.request(token,path)));
    const data={},errors={};Object.keys(paths).forEach((key,i)=>{if(results[i].status==='fulfilled') data[key]=results[i].value;else errors[key]=results[i].reason.message;});
    if(!data.profile) fail(502,errors.profile || 'Academic profile unavailable');
    const snapshot=data.snapshot && !Array.isArray(data.snapshot)?data.snapshot:{};
    if(snapshot.profile) data.profile={...data.profile,...snapshot.profile};
    if(Array.isArray(snapshot.attendanceSummary))data.summary=snapshot.attendanceSummary;
    if(Array.isArray(snapshot.attendanceRecords))data.records=snapshot.attendanceRecords;
    data.academic=snapshot.academic || {};delete data.snapshot;
    data.syncStatus=data.academic.syncStatus || null;
    res.json({...data,errors,lastSyncedAt:data.profile.lastSyncedAt || null,source:data.profile.source || 'academic-service'});
  });
  router.get('/academics/sync-status',config.auth,async(req,res)=>{
    const {token}=await linkFor(req.user);
    res.set('Cache-Control','private, no-store');
    res.json(await config.academic.request(token,'/campus/sync-status'));
  });
  router.get('/academics/documents/:id',config.auth,async(req,res)=>{
    const {token}=await linkFor(req.user);
    const file=await config.academic.request(token,`/campus/documents/${validateId(req.params.id)}`);
    if(!file || !['application/pdf','image/png','image/jpeg'].includes(file.contentType) || typeof file.base64!=='string' || file.base64.length>2666672 || !/^[A-Za-z0-9+/]*={0,2}$/.test(file.base64))fail(502,'AMS file is unavailable. Sync the source and retry.');
    const content=Buffer.from(file.base64,'base64');
    if(!content.length || content.length>2000000)fail(502,'AMS file is unavailable.');
    const name=String(file.name || 'AMS document').replace(/[^\w .-]/g,'').slice(0,120) || 'AMS document';
    res.set({'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff','Content-Disposition':`attachment; filename="${name}"`});
    res.type(file.contentType).send(content);
  });
  router.post('/academics/import',config.auth,async(req,res)=>{
    const {format,content}=req.body || {};
    if(!['json','csv','html'].includes(format) || typeof content!=='string')fail(400,'Choose a JSON, CSV or HTML export.');
    if(Buffer.byteLength(content,'utf8')>5000000)fail(413,'Import limit is 5 MB.');
    const {token}=await linkFor(req.user);
    res.json(await config.academic.request(token,'/campus/import','POST',{format,content}));
  });
  router.get('/academics/course-registration',config.auth,async(req,res)=>{const {token}=await linkFor(req.user);res.json(await config.academic.request(token,'/campus/course-registration'));});
  router.patch('/academics/preferences',config.auth,async(req,res)=>{
    const {token}=await linkFor(req.user);const body={};for(const key of ['smsEnabled','notificationsEnabled','absentAlertsEnabled'])if(typeof req.body?.[key]==='boolean')body[key]=req.body[key];
    res.json(await config.academic.request(token,'/profile','PUT',body));
  });
  router.patch('/academics/notifications/:id/read',config.auth,async(req,res)=>{const {token}=await linkFor(req.user);res.json(await config.academic.request(token,`/notifications/${validateId(req.params.id)}/read`,'PATCH',{}));});
  router.delete('/academics/notifications/:id',config.auth,async(req,res)=>{const {token}=await linkFor(req.user);res.json(await config.academic.request(token,`/notifications/${validateId(req.params.id)}`,'DELETE'));});
  for(const [method,path,target] of [['get','status','status'],['post','subscribe','subscribe'],['delete','unsubscribe','unsubscribe'],['post','test','test'],['patch','preferences','push/preferences']])router[method](`/academics/push/${path}`,config.auth,async(req,res)=>{const {token}=await linkFor(req.user);res.json(await config.academic.request(token,`/notifications/${target}`,req.method,req.body));});
  router.all('/academic-admin/{*path}',config.auth,async(req,res)=>{
    if(campusRole(req.user)!=='admin' || req.user.isActive===false)fail(403,'College administrator access required.');
    const parts=req.params.path;const path='/'+(Array.isArray(parts)?parts.join('/'):parts || '');
    if(!academicAdminAllowed(req.method,path))fail(404,'Academic administration endpoint is not available.');
    const permission=['/audit-logs','/sms-logs'].includes(path)?'audit':['GET','HEAD','OPTIONS'].includes(req.method)?'academics.read':'academics.write';
    if(!hasAdminPermission(req.user,permission))fail(403,'This administrator account is not assigned that permission.');
    const session=await config.academic.internal('/campus/bridge/admin-session',{campusAdminId:String(req.user._id),name:req.user.name || 'College administrator'});
    if(!session.token || session.user?.role!=='admin')fail(403,'Academic administration workspace unavailable.');
    const query=new URLSearchParams();for(const [key,value] of Object.entries(req.query || {})){if(!['studentId','branch','semester','section','day','date','status','limit'].includes(key) || typeof value!=='string' || value.length>150)fail(400,'Unsupported academic filter.');query.set(key,value);}
    let body=req.body;if(req.method==='POST' && path==='/users')body={...body,role:'student'};
    const value=await config.academic.request(session.token,'/admin'+path+(query.size?'?'+query:''),req.method,body);
    if(!['GET','HEAD','OPTIONS'].includes(req.method))await Audit.create({actor:req.user._id,action:`academic:${req.method}`,target:path,details:'Academic workspace administration change'});
    if(req.method==='GET' && path==='/audit-logs'){
      const local=await Audit.find({action:/^academic:/}).sort({createdAt:-1}).limit(100).populate('actor','name').lean();
      const rows=local.map(row=>({id:String(row._id),adminName:row.actor?.name || 'College administrator',action:row.action,target:row.target,description:row.details,createdAt:row.createdAt}));
      return res.json([...rows,...(Array.isArray(value)?value:[])].sort((a,b)=>new Date(b.createdAt)-new Date(a.createdAt)).slice(0,100));
    }
    res.json(value ?? {success:true});
  });
  router.post('/academics/portal',config.auth,async(req,res)=>{
    const {token}=await linkFor(req.user);
    const {portalUsername,portalPassword}=req.body;
    if(typeof portalUsername!=='string' || typeof portalPassword!=='string' || !portalPassword || portalPassword.length>200) fail(400,'Enter your authorized portal login');
    const result=await config.academic.request(token,'/profile/portal-credentials','PUT',{portalUsername,portalPassword});
    res.json(result);
  });
  router.post('/academics/sync',config.auth,async(req,res)=>{
    fail(410,'The parent-portal sync is retired. Load a fresh AMS challenge in Settings to sync your own records.');
  });
  router.post('/academics/ams/challenge',config.auth,async(req,res)=>{
    const {token}=await linkFor(req.user);
    res.json(await config.academic.request(token,'/campus/ams/challenge','POST',{}));
  });
  router.post('/academics/ams/sync',config.auth,async(req,res)=>{
    const {token}=await linkFor(req.user);
    const {challengeId,answer}=req.body || {};
    if(typeof challengeId!=='string' || challengeId.length>100 || typeof answer!=='string' || !answer.trim() || answer.length>30)fail(400,'Enter the official challenge answer');
    const result=await config.academic.request(token,'/campus/ams/sync','POST',{challengeId,answer});
    if(result.success && typeof result.portalPrincipal==='string' && result.portalPrincipal.length<=100 && /^[a-f0-9]{24}$/i.test(result.academicId || '') && req.user.role==='student' && campusRole(req.user)!=='admin'){
      const link=await AcademicLink.findOne({user:req.user._id});
      if(!link || link.academicId!==result.academicId)fail(403,'The verified academic workspace does not match this account.');
      await User.updateOne({_id:req.user._id},{$set:{portalPrincipal:result.portalPrincipal,portalAcademicId:result.academicId,portalPrincipalVerifiedAt:new Date()}});
    }
    res.json(result);
  });
}


export function academicAdminAllowed(method,path){
 const id='[a-fA-F0-9]{24}';
 const rules={
 GET:[/^\/users$/,/^\/(attendance|subjects|sms-logs|audit-logs|sync\/status)$/,new RegExp(`^/users/${id}(?:/(?:attendance(?:/(?:summary|changes))?|subjects|timetable|notifications))?$`),new RegExp(`^/students/${id}/(?:overview|portal-test|attendance(?:/(?:summary|changes))?|timetable|notifications)$`)],
 POST:[/^\/(users|attendance|subjects|timetable|sync)$/,new RegExp(`^/users/${id}/(?:activate|reset-password)$`),new RegExp(`^/students/${id}/(?:sync-profile|subjects/cleanup)$`)],
 PUT:[new RegExp(`^/(?:users|attendance|subjects|timetable)/${id}$`)],
 DELETE:[new RegExp(`^/users/${id}$`)]};
 return (rules[method] || []).some(pattern=>pattern.test(path));
}
