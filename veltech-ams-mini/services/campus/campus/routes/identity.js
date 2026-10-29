import {duplicateKey} from '../security.js';
import crypto from 'node:crypto';
import bcrypt from 'bcrypt';
import validator from 'validator';
import {rateLimit} from 'express-rate-limit';
import User from '../../models/User.js';
import {Session} from '../models.js';
import {IdentityChallenge,IdentityProof} from '../models/identity.js';
import {hashToken,newToken,fail} from '../security.js';
import {publicUser} from '../policy.js';
import {verifiedPortalStudent} from '../services/portal-password.js';
import {issueSession,clearSessionCookie} from '../services/sessions.js';
import {createMailProvider,verificationEmail} from '../services/mail.js';
const lifetime=5*60000;
const readCookie=(req,name)=>(req.headers.cookie || '').split(';').map(s=>s.trim()).find(s=>s.startsWith(name+'='))?.slice(name.length+1);
const secureEqual=(a,b)=>typeof a==='string' && typeof b==='string' && a.length===b.length && crypto.timingSafeEqual(Buffer.from(a),Buffer.from(b));
function password(value){if(typeof value!=='string' || value.length<10 || Buffer.byteLength(value,'utf8')>72)fail(400,'Use a password with at least 10 characters and at most 72 UTF-8 bytes.');return value;}
function email(value){if(typeof value!=='string' || value.length>254 || !validator.isEmail(value.trim()))fail(400,'Enter a valid email address.');return value.trim().toLowerCase();}
function resetAccount(address){
 const mailbox=/^(vtu[0-9]+)@veltech\.edu\.in$/.exec(address);
 return {isActive:{$ne:false},$or:[{recoveryEmail:address,recoveryEmailVerifiedAt:{$type:'date'}},...(mailbox?[{portalPrincipal:new RegExp('^'+mailbox[1]+'$','i'),portalPrincipalVerifiedAt:{$type:'date'}}]:[])]};
}
export function registerIdentity(router,config) {
 const mail=config.mail || createMailProvider();
 const cookieOptions={httpOnly:true,sameSite:'strict',secure:config.cookieSecure,path:'/api/campus/identity'};
 const proofOptions={...cookieOptions,path:'/api/campus/identity/reset'};
 const secret=()=>{const value=config.identitySecret || process.env.CAMPUS_IDENTITY_SECRET || config.linkKey;if(typeof value!=='string' || value.length<32)fail(503,'Account verification requires a persistent server identity key.');return value;};
 const hmac=(value)=>crypto.createHmac('sha256',secret()).update(value).digest('hex');
 function browser(req,res,create=false){let token=readCookie(req,'campus_identity');if(!/^[a-f0-9]{64}$/.test(token || '')){if(!create)fail(400,'Restart verification in the browser that requested the code.');token=newToken();res.cookie('campus_identity',token,{...cookieOptions,maxAge:3600000});}return hmac('browser:'+token);}
 const limit=rateLimit({windowMs:15*60000,limit:config.identityRateLimit || 35,standardHeaders:'draft-8',legacyHeaders:false,message:{message:'Too many verification attempts. Please wait before retrying.'}});
 router.use('/identity',config.trafficControls?.identity || limit);
 router.use('/identity',(req,_res,next)=>{if(req.method==='POST' && (!req.body || typeof req.body!=='object' || Array.isArray(req.body)))fail(400,'Send a valid account verification request.');next();});
 async function issue(req,res,purpose) {
  if(purpose==='signup' && config.selfRegistration!==true)fail(403,'Self-registration is unavailable. Use AMS sign-in or ask an administrator for staff access.');
  secret();if(mail.configured===false)fail(503,'Email delivery is not configured. Ask the administrator to configure SMTP or Brevo.');
  const address=email(req.body.email),browserHash=browser(req,res,true),now=new Date(),scopeHash=hmac(`${purpose}:${address}`);
  let payload,user;
  if(purpose==='signup') {
   const username=typeof req.body.username==='string'?req.body.username.trim().toLowerCase():'';
   const name=typeof req.body.name==='string'?req.body.name.trim():'';
   if(!/^[a-z0-9][a-z0-9._-]{2,29}$/.test(username) || !name || name.length>100)fail(400,'Enter your name and a username with 3–30 letters, numbers, dots, dashes or underscores.');
   password(req.body.password);
   const exists=await User.exists({$or:[{email:address},{username}]});
   if(!exists)payload={name,username,passwordHash:await bcrypt.hash(req.body.password,12)};
  } else if(purpose==='recovery'){
   user=req.user;
   if(await User.exists({_id:{$ne:user._id},$or:[{email:address},{recoveryEmail:address,recoveryEmailVerifiedAt:{$type:'date'}}]}))fail(409,'This recovery email is already verified for an account.');
  } else user=await User.findOne(resetAccount(address)).select('_id');
  const current=await IdentityChallenge.findOne({scopeHash});
  if(current && now-current.issuedAt<60000)fail(429,'Wait 60 seconds before requesting another code.');
  const sameWindow=current?.issueWindowAt && now-current.issueWindowAt<3600000;
  if(sameWindow && current.issueCount>=5)fail(429,'Too many code requests. Please try again in an hour.');
  const code=crypto.randomInt(0,1000000).toString().padStart(6,'0'),challengeId=newToken();
  const values={purpose,challengeHash:hashToken(challengeId),browserHash,codeHash:hmac(`${purpose}:${challengeId}:${code}`),email:address,user:user?._id || null,payload:payload || null,attempts:0,expiresAt:new Date(+now+lifetime),consumedAt:null,issuedAt:now,issueWindowAt:sameWindow?current.issueWindowAt:now,issueCount:sameWindow?current.issueCount+1:1,purgeAt:new Date(+now+86400000)};
  // Compare the prior issue time so simultaneous requests cannot bypass the cooldown.
  let saved;
  try{saved=current?await IdentityChallenge.findOneAndUpdate({_id:current._id,issuedAt:current.issuedAt},{$set:values},{returnDocument:'after'}):await IdentityChallenge.create({scopeHash,...values});}catch(error){if(duplicateKey(error))fail(429,'A code was just requested. Wait 60 seconds.');throw error;}
  if(!saved)fail(429,'A code was just requested. Wait 60 seconds.');
  if((purpose==='signup' && payload) || (['reset','recovery'].includes(purpose) && user)) {
   try{await mail.send({to:address,...verificationEmail({purpose,code,appUrl:config.publicUrl || process.env.CAMPUS_PUBLIC_URL})});}
   catch {await IdentityChallenge.updateOne({_id:saved._id,challengeHash:values.challengeHash},{$set:{consumedAt:new Date(),issuedAt:new Date(0)},$unset:{codeHash:1,payload:1}});fail(503,'The verification email could not be sent. Please retry later.');}
  }
  res.status(202).json({challengeId,expiresIn:300,message:'If these account details can be verified, a code has been sent to that email address.'});
 }
 async function verify(req,res,purpose) {
  if(purpose==='signup' && config.selfRegistration!==true)fail(403,'Self-registration is unavailable. Use AMS sign-in or ask an administrator for staff access.');
  const {challengeId,code}=req.body;
  if(typeof challengeId!=='string' || !/^[a-f0-9]{64}$/.test(challengeId) || typeof code!=='string' || !/^\d{6}$/.test(code))fail(400,'Enter the six-digit code from your email.');
  const browserHash=browser(req,res),now=new Date();
  const challenge=await IdentityChallenge.findOneAndUpdate({purpose,challengeHash:hashToken(challengeId),browserHash,consumedAt:null,expiresAt:{$gt:now},attempts:{$lt:5}},{$inc:{attempts:1}},{returnDocument:'after'});
  if(!challenge || !secureEqual(challenge.codeHash,hmac(`${purpose}:${challengeId}:${code}`)))fail(400,'The code is incorrect, expired or has too many attempts. Request a new code.');
  if((purpose==='signup' && !challenge.payload?.passwordHash) || (['reset','recovery'].includes(purpose) && !challenge.user))fail(400,'The code is incorrect or expired.');
  if(purpose==='recovery' && String(challenge.user)!==String(req.user._id))fail(400,'Verify the recovery email from the account that requested it.');
  if(purpose==='reset' && !await User.exists({_id:challenge.user,...resetAccount(challenge.email)}))fail(400,'The code is incorrect or expired.');
  const consumed=await IdentityChallenge.findOneAndUpdate({_id:challenge._id,consumedAt:null,expiresAt:{$gt:new Date()}},{$set:{consumedAt:new Date()},$unset:{codeHash:1,payload:1}},{returnDocument:'before'});
  if(!consumed)fail(400,'This verification code has already been used.');
  if(purpose==='signup') {
   const user=await User.create({email:consumed.email,username:consumed.payload.username,name:consumed.payload.name,password:consumed.payload.passwordHash,role:'student',campusRole:'student',isVerified:true,recoveryEmail:consumed.email,recoveryEmailVerifiedAt:new Date()});
   const {csrfToken}=await issueSession(user,res,config);
   return res.status(201).json({user:publicUser(user),csrfToken});
  }
  if(purpose==='recovery'){
   const user=await User.findByIdAndUpdate(consumed.user,{$set:{recoveryEmail:consumed.email,recoveryEmailVerifiedAt:new Date()}},{returnDocument:'after'});
   if(!user)fail(400,'This account is no longer available.');
   // A previously verified address loses its ability to reset this account immediately.
   await IdentityProof.updateMany({user:user._id,consumedAt:null},{$set:{consumedAt:new Date()}});
   await IdentityChallenge.updateMany({purpose:'reset',user:user._id,consumedAt:null},{$set:{consumedAt:new Date()},$unset:{codeHash:1}});
   return res.json({verified:true,recoveryEmail:user.recoveryEmail,recoveryEmailVerifiedAt:user.recoveryEmailVerifiedAt,message:'Recovery email verified.'});
  }
  const token=newToken();await IdentityProof.findOneAndUpdate({user:consumed.user},{$set:{tokenHash:hashToken(token),browserHash,consumedAt:null,expiresAt:new Date(Date.now()+lifetime)}},{upsert:true});
  res.cookie('campus_reset_proof',token,{...proofOptions,maxAge:lifetime});res.json({verified:true,message:'Email verified. Choose a new password.'});
 }
 router.post('/identity/signup/request',(req,res)=>issue(req,res,'signup'));
 router.post('/identity/signup/verify',(req,res)=>verify(req,res,'signup'));
 router.post('/identity/recovery/request',config.auth,(req,res)=>issue(req,res,'recovery'));
 router.post('/identity/recovery/verify',config.auth,(req,res)=>verify(req,res,'recovery'));
 router.get('/identity/recovery',config.auth,(req,res)=>res.json({recoveryEmail:req.user.recoveryEmail || '',recoveryEmailVerifiedAt:req.user.recoveryEmailVerifiedAt || null}));
 router.post('/identity/reset/request',(req,res)=>issue(req,res,'reset'));
 router.post('/identity/reset/verify',(req,res)=>verify(req,res,'reset'));
 router.post('/identity/reset/complete',async(req,res)=>{
  password(req.body.password);const browserHash=browser(req,res),token=readCookie(req,'campus_reset_proof');
  if(!/^[a-f0-9]{64}$/.test(token || ''))fail(400,'Verify your email before resetting your password.');
  const passwordHash=await bcrypt.hash(req.body.password,12);
  const proof=await IdentityProof.findOneAndUpdate({tokenHash:hashToken(token),browserHash,consumedAt:null,expiresAt:{$gt:new Date()}},{$set:{consumedAt:new Date()}},{returnDocument:'before'});
  if(!proof)fail(400,'Password reset verification expired or was already used.');
  const recovering=await User.findById(proof.user);
  const portalPasswordSetAt=verifiedPortalStudent(recovering)?new Date():undefined;
  const changed=await User.updateOne({_id:proof.user},{$set:{password:passwordHash,...(portalPasswordSetAt?{portalPasswordSetAt}:{})},$unset:{resetOTP:1,registerOTP:1,otpExpires:1}});
  if(!changed.matchedCount)fail(400,'This account is no longer available.');
  await Session.deleteMany({user:proof.user});await IdentityProof.updateMany({user:proof.user,consumedAt:null},{$set:{consumedAt:new Date()}});
  res.clearCookie('campus_reset_proof',proofOptions);clearSessionCookie(res,config);
  res.json({success:true,message:'Application password changed. Sign in again on your devices. Your AMS password is unchanged.'});
 });
}
