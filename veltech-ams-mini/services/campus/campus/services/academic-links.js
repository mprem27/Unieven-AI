import {duplicateKey} from '../security.js';
import {AcademicLink} from '../models.js';
import {encryptToken,decryptToken,fail} from '../security.js';
// Shared per-application resolver. Admin reads use the student's identity, never
// the administrator's email or credentials. Concurrent renewals are coalesced.
const resolvers=new WeakMap();
export function academicLinks(config){
 if(resolvers.has(config))return resolvers.get(config);
 const preparing=new Map();
 const verifiedPortal=(user,link)=>!!(user.portalPrincipalVerifiedAt && /^vtu[0-9]{3,12}$/i.test(user.portalPrincipal || '') && user.portalAcademicId && user.portalAcademicId===link?.academicId && link?.email===user.email);
  async function managedLink(user,academicId,expectedId,automatic=false,expectedManaged=true) {
    if(!config.linkKey) fail(503,'The persistent academic encryption key is missing');
    const result=await config.academic.bootstrap({campusId:String(user._id),email:user.email,name:user.name,department:user.department || ''},academicId);
    if(result.user?.email?.toLowerCase()!==user.email || !result.token || !result.user.id) fail(403,'Academic workspace identity does not match your campus account');
    if((expectedId && result.user.id!==expectedId) || (user.portalAcademicId && result.user.id!==user.portalAcademicId))fail(403,'Academic workspace ownership changed. Verify your academic connection in Settings.');
    const fields={academicId:result.user.id,email:user.email,sealedToken:encryptToken(result.token,config.linkKey),managed:true};
    let link;
    try {
      if(automatic && !expectedId)link=await AcademicLink.create({user:user._id,...fields,linkedAt:new Date()});
      else link=await AcademicLink.findOneAndUpdate({user:user._id,...(expectedId?{academicId:expectedId,managed:expectedManaged}:{})},{$set:fields,$setOnInsert:{linkedAt:new Date()}},{upsert:!expectedId,returnDocument:'after'}).select('+sealedToken');
    }catch(error){
      if(!duplicateKey(error))throw error;
      link=await AcademicLink.findOne({user:user._id}).select('+sealedToken');
      if(!link || link.academicId!==result.user.id || link.email!==user.email || !link.managed)fail(409,'The academic connection changed. Reload your workspace and retry.');
    }
    if(!link)fail(409,'The academic connection changed. Reload your workspace and retry.');
    return {link,token:result.token};
  }
  function storedToken(user,link) {
    if(!config.linkKey)fail(503,'The persistent academic encryption key is missing');
    if(link.email?.toLowerCase()!==user.email?.toLowerCase() || (user.portalAcademicId && user.portalAcademicId!==link.academicId))fail(403,'The academic connection does not belong to this campus identity.');
    let token;try {token=decryptToken(link.sealedToken,config.linkKey);}catch {return null;}
    if(!link.managed && !(config.bridgeEnabled && verifiedPortal(user,link)))return token;
    // The AES-GCM seal authenticates these claims as a service-issued token.
    // Python still verifies its signature and the active owner on every read.
    let claims;try {claims=JSON.parse(Buffer.from(token.split('.')[1] || '','base64url').toString('utf8'));}catch {return null;}
    if(claims?.sub!==link.academicId || claims?.role!=='student')fail(403,'The academic connection token does not match its workspace owner.');
    return Number.isFinite(claims.exp) && claims.exp>Date.now()/1000+60?token:null;
  }
  async function linkFor(user,force=false) {
    const link=await AcademicLink.findOne({user:user._id}).select('+sealedToken');
    if(config.bridgeEnabled && (!link || link.managed || verifiedPortal(user,link))) {
      if(link){const token=storedToken(user,link);if(token && !force)return {link,token};}
      const owner=String(user._id);
      if(!preparing.has(owner)){
        const task=(async()=>{
          // Concurrent status/overview/poll requests may have read before the
          // first bootstrap committed. Re-read their durable owner link once.
          const latest=await AcademicLink.findOne({user:user._id}).select('+sealedToken');
          if(latest && !latest.managed && !verifiedPortal(user,latest))fail(409,'The academic connection changed. Verify it before renewal.');
          if(latest){const token=storedToken(user,latest);if(token && !force)return {link:latest,token};}
          return managedLink(user,latest && !latest.managed?latest.academicId:undefined,latest?.academicId,true,latest?.managed ?? true);
        })();
        preparing.set(owner,task);
        task.finally(()=>{if(preparing.get(owner)===task)preparing.delete(owner);}).catch(()=>{});
      }
      return preparing.get(owner);
    }
    if(!link) fail(409,'Connect your academic account in Settings to load your student data');
    const token=storedToken(user,link);
    if(!token)fail(409,'The academic connection could not be opened. Reconnect your academic account.');
    return {link,token};
  }

 async function read(user,path,method='GET',body){
  let current=await linkFor(user);
  try{return await config.academic.request(current.token,path,method,body);}
  catch(error){
   if(error.status!==401 || !config.bridgeEnabled || (!current.link.managed && !verifiedPortal(user,current.link)))throw error;
   current=await linkFor(user,true);
   return config.academic.request(current.token,path,method,body);
  }
 }
 const resolver={linkFor,managedLink,read};resolvers.set(config,resolver);return resolver;
}
