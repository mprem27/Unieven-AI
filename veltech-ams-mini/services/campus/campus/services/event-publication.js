import {duplicateKey} from '../security.js';
import {AppPolicy} from '../models/app-policy.js';
import {CampusPost} from '../models.js';
import {fail} from '../security.js';
export const activeEventQuery=(now=new Date())=>({archivedAt:null,$or:[{expiresAt:null},{expiresAt:{$gt:now}}]});
export function eventExpired(event,now=new Date()){return !!event.expiresAt && new Date(event.expiresAt)<=now;}
export async function eventPublicationInput(body,start,{existing}={}){
 const out={};
 if(body.expiresAt!==undefined){
  if(body.expiresAt===null)out.expiresAt=null;
  else {const date=new Date(body.expiresAt);if(typeof body.expiresAt!=='string' || !Number.isFinite(+date) || date<=start || date>new Date(+start+3660*86400000))fail(400,'Event expiry must follow the event and be within ten years.');out.expiresAt=date;}
 }else if(!existing){const policy=await AppPolicy.findOne({key:'events'}).lean();const date=new Date(start);date.setUTCMonth(date.getUTCMonth()+(policy?.eventExpiryMonths || 6));out.expiresAt=date;}
 for(const [key,values] of Object.entries({posterFit:['cover','contain'],posterTheme:['navy','teal','indigo']}))if(body[key]!==undefined){if(!values.includes(body[key]))fail(400,'Choose a supported poster style.');out[key]=body[key];}
 if(body.posterPosition!==undefined){if(!Number.isInteger(body.posterPosition) || body.posterPosition<0 || body.posterPosition>100)fail(400,'Poster position must be from 0 to 100.');out.posterPosition=body.posterPosition;}
 if(body.publishPost!==undefined && typeof body.publishPost!=='boolean')fail(400,'Choose whether to also publish a community post.');
 return out;
}
export async function publishEventPost(event,user){
 if(event.archivedAt || eventExpired(event))fail(409,'Archived or expired events cannot be posted.');
 const key=`event:${event.id}`;
 let post;
 try{post=await CampusPost.findOneAndUpdate({publicationKey:key},{$setOnInsert:{publicationKey:key,user:user._id,text:`${event.title}\n\n${event.description || ''}`.slice(0,2200),image:event.image,eventId:event._id,visibility:'account',category:'campus',link:`/events/${event.id}`}},{upsert:true,returnDocument:'after',runValidators:true});}
 catch(error){if(!duplicateKey(error))throw error;post=await CampusPost.findOne({publicationKey:key});}
 return post?.id;
}
