import {recordAdminAccess} from '../services/admin-records.js';
import bcrypt from 'bcrypt';
import User from '../../models/User.js';
import {Session,AcademicLink} from '../models.js';
import {publicUser,campusRole} from '../policy.js';
import {decryptToken,fail} from '../security.js';
import {issueSession,clearSessionCookie} from '../services/sessions.js';
import {canUsePortalPassword} from '../services/portal-password.js';
export function registerAuth(router,config) {
  const login=area=>async(req,res)=>{
    const {identity,password}=req.body || {};
    if(typeof identity!=='string' || typeof password!=='string' || identity.length>200 || password.length>200) fail(400,'Enter your email and password');
    if(Buffer.byteLength(password,'utf8')>72) fail(400,'Campus passwords must be at most 72 UTF-8 bytes. Reset a longer existing password through the original app before using campus sign-in.');
    const clean=identity.trim().toLowerCase();
    const user=await User.findOne({$or:[{email:clean},{username:clean},{recoveryEmail:clean,recoveryEmailVerifiedAt:{$type:'date'}}]});
    if(!user || user.isActive===false || (user.portalOnly && !canUsePortalPassword(user)) || !await bcrypt.compare(password,user.password)) fail(401,'Incorrect email or password');
    if(area==='admin' && campusRole(user)!=='admin' || area==='faculty' && user.role!=='faculty')fail(401,'Incorrect email or password for this sign-in area');
    const {csrfToken}=await issueSession(user,res,config);
    res.json({user:publicUser(user),csrfToken});
  };
  router.post('/login',login(''));router.post('/login/faculty',login('faculty'));router.post('/login/admin',login('admin'));
  router.get('/session',config.auth,(req,res)=>res.json({user:publicUser(req.user),csrfToken:req.session.csrfToken}));
  router.post('/logout',config.auth,async(req,res)=>{
    if(req.user.portalPrincipal){
      // Ending campus access must still succeed if AMS is unavailable.
      try{const link=await AcademicLink.findOne({user:req.user._id}).select('+sealedToken');if(link)await config.academic.request(decryptToken(link.sealedToken,config.linkKey),'/campus/ams/logout','POST',{});}catch{}
    }
    await recordAdminAccess(req.user,'logout',req.session._id);await Session.deleteOne({_id:req.session._id});clearSessionCookie(res,config);res.json({success:true});
  });
  router.patch('/profile',config.auth,async(req,res)=>{
    const changes={};
    if(!req.body||typeof req.body!=='object'||Array.isArray(req.body)||Object.keys(req.body).some(key=>key!=='bio'))fail(400,'Official records and account permissions are read-only; use the social profile editor');
    if(req.body.bio!==undefined){if(typeof req.body.bio!=='string'||req.body.bio.length>300)fail(400,'bio must be at most 300 characters');changes.bio=req.body.bio.trim();}
    const user=await User.findByIdAndUpdate(req.user._id,{$set:changes},{returnDocument:'after'});
    res.json(publicUser(user));
  });
}
