import {AcademicLink} from '../models.js';
import {decryptToken} from '../security.js';
import {academicLinks} from './academic-links.js';
const canonical=value=>typeof value==='string' && /^vtu[0-9]{3,12}$/i.test(value.trim())?value.trim().toUpperCase():'';
export async function verifiedStudentIdentity(user,config,{includeAcademicFields=false}={}){
 if(user?.role!=='student')return {vtuNumber:'',department:user?.department || ''};
 const principal=user.portalPrincipalVerifiedAt?canonical(user.portalPrincipal):'';
 if(principal && user.department && !includeAcademicFields)return {vtuNumber:principal,department:user.department};
 const link=await AcademicLink.findOne({user:user._id}).select('+sealedToken');
 if(!link)return {vtuNumber:principal,department:user.department || ''};
 try{
  const snapshot=!link.managed && !link.email?await config.academic.request(decryptToken(link.sealedToken,config.linkKey),'/campus/snapshot'):await academicLinks(config).read(user,'/campus/snapshot');
  const verified=snapshot.identity?.verifiedAt?canonical(snapshot.identity.verifiedPrincipal):'';
  if(!verified)return {vtuNumber:principal,department:user.department || ''};
  return {vtuNumber:principal || verified,department:snapshot.profile?.branch || snapshot.profile?.department || user.department || '',semester:snapshot.profile?.semester || '',section:snapshot.profile?.section || ''};
 }catch{return {vtuNumber:principal,department:user.department || ''};}
}
