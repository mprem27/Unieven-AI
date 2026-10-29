import {academicLinks} from '../services/academic-links.js';
import {duplicateKey} from '../security.js';
import crypto from 'node:crypto';
import bcrypt from 'bcrypt';
import User from '../../models/User.js';
import {AcademicLink} from '../models.js';
import {publicUser,campusRole} from '../policy.js';
import {encryptToken,decryptToken,newToken,fail} from '../security.js';
import {issueSession} from '../services/sessions.js';
import {verifiedPortalStudent,canUsePortalPassword} from '../services/portal-password.js';
const cookieName='campus_portal_browser';
const cookiePath='/api/campus/portal';
function browserOwner(req,config){
 const token=(req.headers.cookie || '').split(';').map(v=>v.trim()).find(v=>v.startsWith(cookieName+'='))?.slice(cookieName.length+1);
 if(!/^[a-f0-9]{64}$/.test(token || ''))fail(409,'Load a fresh AMS challenge in this browser.');
 return crypto.createHmac('sha256',config.linkKey).update(token).digest('hex');
}
export async function resolveCampusPortal(result){
 const principal=result.portalPrincipal;
 if(typeof principal!=='string' || !principal.trim() || principal.length>100 || !/^[a-f0-9]{24}$/i.test(result.user?.id || '') || typeof result.token!=='string' || !result.user?.email)fail(502,'AMS did not confirm a supported student identity.');
 let user=await User.findOne({portalPrincipal:principal});
 if(user){
  if(user.role!=='student' || campusRole(user)==='admin' || user.isActive===false || !user.portalPrincipalVerifiedAt || user.portalAcademicId!==result.user.id)fail(403,'Use campus password sign-in for this account, or contact the administrator.');
  return user;
 }
 try{user=await User.create({username:'ams_'+newToken().slice(0,24),email:result.user.email,password:await bcrypt.hash(newToken(),12),name:String(result.user.name || 'Student').slice(0,120),role:'student',isActive:true,portalOnly:true,portalPrincipal:principal,portalAcademicId:result.user.id,portalPrincipalVerifiedAt:new Date()});}
 catch(error){if(!duplicateKey(error))throw error;user=await User.findOne({portalPrincipal:principal});if(!user || user.role!=='student' || campusRole(user)==='admin' || user.isActive===false || !user.portalPrincipalVerifiedAt || user.portalAcademicId!==result.user.id)fail(409,'An existing campus identity needs a verified migration. No account was merged by email.');}
 return user;
}
export function registerPortalLogin(router,config){
 router.post('/academics/ams/refresh',config.auth,async(req,res)=>{
  const link=await AcademicLink.findOne({user:req.user._id}).select('+sealedToken');
  if(!link || !config.linkKey)fail(409,'Sign in with your AMS username and password to refresh your records.');
  res.json(await academicLinks(config).read(req.user,'/campus/ams/refresh','POST',{}));
 });
 router.post('/portal/challenge',async(req,res)=>{
  if(!config.linkKey)fail(503,'Configure the persistent academic encryption key before AMS sign-in.');
  const browser=newToken(),owner=crypto.createHmac('sha256',config.linkKey).update(browser).digest('hex');
  const result=await config.academic.internal('/campus/portal-login/challenge',{owner});
  res.cookie(cookieName,browser,{httpOnly:true,sameSite:'strict',secure:config.cookieSecure,maxAge:5*60000,path:cookiePath});
  res.json(result);
 });
 const portalSignIn=async(req,res)=>{
  if(!config.linkKey)fail(503,'Configure the persistent academic encryption key before AMS sign-in.');
  const {username,password,challengeId,answer=''}=req.body || {};
  if(typeof username!=='string' || !username.trim() || username.length>100 || typeof password!=='string' || !password || password.length>200 || (challengeId!==undefined && (typeof challengeId!=='string' || challengeId.length<20 || challengeId.length>100)) || typeof answer!=='string' || answer.length>30)fail(400,'Enter your AMS username and password, and the verification answer if requested.');
  let owner;
  if(challengeId)owner=browserOwner(req,config);
  else {
   const browser=newToken();owner=crypto.createHmac('sha256',config.linkKey).update(browser).digest('hex');
   res.cookie(cookieName,browser,{httpOnly:true,sameSite:'strict',secure:config.cookieSecure,maxAge:5*60000,path:cookiePath});
  }
  const result=await config.academic.internal('/campus/portal-login/session',{owner,username:username.trim(),password,...(challengeId?{challengeId}:{}),answer});
  if(result.verificationRequired){
   const challenge=result.challenge;
   if(!challenge || typeof challenge.challengeId!=='string' || !challenge.requiresCaptcha)fail(502,'AMS requested unsupported verification. Retry when the portal is available.');
   return res.json({verificationRequired:true,challenge});
  }
  if(req.user?.portalPrincipal && req.user.portalPrincipal!==result.portalPrincipal){
   try{await config.academic.request(result.token,'/campus/ams/logout','POST',{});}catch{}
   fail(403,'Sign in with the AMS account already linked to this workspace. Sign out before switching accounts.');
  }
  if(typeof result.portalPrincipal!=='string' || result.portalPrincipal.trim().toLowerCase()!==username.trim().toLowerCase()){
   try{if(result.token)await config.academic.request(result.token,'/campus/ams/logout','POST',{});}catch{}
   fail(502,'AMS returned a different student identity. No workspace was linked.');
  }
  const user=await resolveCampusPortal(result);
  // Only an exact, upstream-verified portal-only student binding may acquire
  // an application verifier. bcrypt must never silently truncate credentials.
  if(verifiedPortalStudent(user)){
   const supported=Buffer.byteLength(password,'utf8')<=72;
   user.password=await bcrypt.hash(supported?password:newToken(),12);user.portalPasswordSetAt=supported?new Date():undefined;await user.save();
  }
  await AcademicLink.findOneAndUpdate({user:user._id},{$set:{academicId:result.user.id,email:user.email,sealedToken:encryptToken(result.token,config.linkKey),managed:false,linkedAt:new Date()}},{upsert:true});
  const {csrfToken}=await issueSession(user,res,config);
  res.clearCookie(cookieName,{httpOnly:true,sameSite:'strict',secure:config.cookieSecure,path:cookiePath});
  res.json({user:publicUser(user),csrfToken,partial:!!result.partial,syncPending:!!result.syncPending,notes:result.notes || [],syncStatus:result.syncStatus,refreshAvailable:!!result.refreshAvailable,amsSessionExpiresIn:result.amsSessionExpiresIn || 0,source:'ams-manual-login'});
 };
 router.post('/portal/login',portalSignIn);
 router.post('/portal/sign-in',async(req,res)=>{
  const {identity,password}=req.body || {};
  if(typeof identity!=='string' || !identity.trim() || identity.length>200 || typeof password!=='string' || !password || password.length>200)fail(400,'Enter your username or email and password.');
  const clean=identity.trim().toLowerCase();
  const mailbox=/^(vtu[0-9]{3,12})(?:@veltech\.edu\.in)?$/.exec(clean);
  const user=await User.findOne({$or:[{email:clean},{username:clean},{recoveryEmail:clean,recoveryEmailVerifiedAt:{$type:'date'}},...(mailbox?[{portalPrincipal:mailbox[1]}]:[])]});
  if(user?.isActive===false)fail(401,'Incorrect username or password.');
  if(req.body.challengeId===undefined && canUsePortalPassword(user) && mailbox?.[1]===user.portalPrincipal && Buffer.byteLength(password,'utf8')<=72 && await bcrypt.compare(password,user.password)){
   if(req.user?.portalPrincipal && req.user.portalPrincipal!==user.portalPrincipal)fail(403,'Sign in with the AMS account already linked to this workspace. Sign out before switching accounts.');
   const {csrfToken}=await issueSession(user,res,config);return res.json({user:publicUser(user),csrfToken,source:'workspace-password'});
  }
  if(user && !user.portalOnly && Buffer.byteLength(password,'utf8')<=72 && await bcrypt.compare(password,user.password)){
   const {csrfToken}=await issueSession(user,res,config);return res.json({user:publicUser(user),csrfToken});
  }
  // A known staff member's password must never be sent to AMS.
  if(user && (user.role!=='student' || campusRole(user)==='admin'))fail(401,'Incorrect username or password.');
  if(!mailbox)fail(401,'Incorrect username or password.');
  req.body={username:mailbox[1],password,...(req.body.challengeId?{challengeId:req.body.challengeId,answer:req.body.answer}:{})};
  await portalSignIn(req,res);
 });
}
