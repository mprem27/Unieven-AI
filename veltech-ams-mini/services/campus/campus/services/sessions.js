import {recordAdminAccess} from './admin-records.js';
import User from '../../models/User.js';
import {Session} from '../models.js';
import {hashToken,newToken,fail} from '../security.js';

export const sessionLifetime=30*86400000;
const renewalWindow=29*86400000;
const cookieName='campus_session';
export const sessionCookieOptions=config=>({httpOnly:true,sameSite:'strict',secure:config.cookieSecure,path:'/api/campus'});
export function clearSessionCookie(res,config){res.clearCookie(cookieName,sessionCookieOptions(config));}
export async function issueSession(user,res,config){
 const token=newToken(),csrfToken=newToken(),now=new Date();
 const session=await Session.create({user:user._id,tokenHash:hashToken(token),csrfToken,lastSeenAt:now,expiresAt:new Date(+now+sessionLifetime)});
 await recordAdminAccess(user,'login',session._id);
 res.cookie(cookieName,token,{...sessionCookieOptions(config),maxAge:sessionLifetime});
 return {csrfToken};
}
export function sessionMiddleware(config){
 return async(req,res,next)=>{
  if(req.path==='/payments/webhook')return next();
  const token=(req.headers.cookie || '').split(';').map(value=>value.trim()).find(value=>value.startsWith(cookieName+'='))?.slice(cookieName.length+1);
  if(token && /^[a-f0-9]{64}$/.test(token)){
   req.session=await Session.findOne({tokenHash:hashToken(token),expiresAt:{$gt:new Date()}});
   if(req.session)req.user=await User.findById(req.session.user);
   if(!req.user || req.user.isActive===false){req.session=null;req.user=null;}
  }
  if(!['GET','HEAD','OPTIONS'].includes(req.method)){
   if(!config.origins.includes(req.headers.origin))fail(403,'Request origin is not allowed');
   if(req.session && req.headers['x-csrf-token']!==req.session.csrfToken)fail(403,'Security token missing. Refresh the page and retry.');
  }
  // A cookie can change in another tab while this tab still displays its old
  // account. Require the requesting UI and resolved session to agree.
  const expected=req.headers['x-campus-account'];
  if(req.path!=='/session' && expected && req.user && expected!==String(req.user._id))return res.status(409).json({code:'ACCOUNT_CHANGED',message:'The signed-in account changed. Restoring the current workspace.'});
  const now=new Date();
  if(req.session && req.path!=='/logout' && req.session.expiresAt-new Date()<renewalWindow){
   // Update an existing, still-valid session only: a concurrent revocation must never be upserted back into existence.
   const renewed=await Session.findOneAndUpdate({_id:req.session._id,tokenHash:hashToken(token),expiresAt:{$gt:now}},{$set:{expiresAt:new Date(+now+sessionLifetime),lastSeenAt:now}},{returnDocument:'after'});
   if(renewed){req.session=renewed;res.cookie(cookieName,token,{...sessionCookieOptions(config),maxAge:sessionLifetime});}
   else {req.session=null;req.user=null;}
  }
  next();
 };
}
