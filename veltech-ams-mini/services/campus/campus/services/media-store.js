import {hasAdminAction} from '../../../../shared/admin-access.mjs';
import mongoose from 'mongoose';
import path from 'node:path';
import fs from 'node:fs/promises';
import crypto from 'node:crypto';
import User from '../../models/User.js';
import Follow from '../../models/Follow.js';
import {fail} from '../security.js';
const {Schema}=mongoose;
export const CampusMedia=mongoose.models.CampusMedia || mongoose.model('CampusMedia',new Schema({
 owner:{type:Schema.Types.ObjectId,ref:'User',required:true,index:true},key:{type:String,required:true,unique:true},
 mime:{type:String,required:true},kind:{type:String,enum:['image','video'],required:true},size:{type:Number,required:true},
 visibility:{type:String,enum:['public','followers','private'],default:'private'},orphanedAt:Date
},{timestamps:true}));
export const mediaUrl=id=>`/api/campus/media/${String(id?._id ?? id)}`;
export function mediaId(value){
 if(typeof value!=='string')return null;
 if(/^[a-f0-9]{24}$/i.test(value))return value;
 const match=value.match(/^\/api\/campus\/media\/([a-f0-9]{24})$/i);return match?.[1] || null;
}
export async function requireOwnedMedia(user,value,{kind}={}) {
 const id=mediaId(value);if(!id)fail(400,'Upload a file from your device before sharing it.');
 const item=await CampusMedia.findOne({_id:id,owner:user?._id ?? user?.id});
 if(!item)fail(403,'You can attach only your own uploaded files.');
 if(kind && item.kind!==kind)fail(400,`Choose an uploaded ${kind} file.`);
 return item;
}
function attachmentQuery(url,id){return {$in:[url,id]};}
async function activeReferences(item) {
 const db=mongoose.connection.db,url=mediaUrl(item._id),value=attachmentQuery(url,String(item._id)),owner=item.owner;
 const definitions=[
  ['CampusPost',{user:owner,isArchived:{$ne:true},$or:[{image:value},{video:value}]}],
  ['Post',{user:owner,isArchived:{$ne:true},media:value}],
  ['Reel',{user:owner,isArchived:{$ne:true},$or:[{video:value},{thumbnail:value}]}],
  ['Story',{user:owner,expiresAt:{$gt:new Date()},media:value}],
  // Event editors may differ from the creator. Event writes enforce uploader ownership;
  // access follows the current active attachment after an authorized organizer replaces it.
  ['Event',{status:{$nin:['cancelled','completed']},archivedAt:null,$or:[{image:value},{poster:value},{video:value}]}],
  ['User',{_id:owner,image:value}],
 ];
 const references=[];
 for(const [name,query] of definitions) {
  // Use the registered schema's actual collection; collection names survive legacy migrations.
  const collection=mongoose.models[name]?.collection.name || ({CampusPost:'campusposts',Post:'posts',Reel:'reels',Story:'stories',Event:'events',User:'users'}[name]);
  const docs=await db.collection(collection).find(query,{projection:{visibility:1,user:1,createdBy:1}}).limit(20).toArray();
  references.push(...docs.map(doc=>({...doc,event:name==='Event',moderatable:['CampusPost','Post','Reel'].includes(name)})));
 }
 return references;
}
export async function canAccessMedia(user,item) {
 if(!user || !item)return false;
 const viewer=String(user._id ?? user.id),ownerId=String(item.owner);
 if(viewer===ownerId)return true;
 const owner=await User.findById(ownerId).select('_id isPrivate isActive');if(!owner)return false;
 const references=await activeReferences(item);
 if(hasAdminAction(user,'moderation','view') && references.some(row=>row.moderatable))return true;
 if(owner.isActive===false)return false;
 if(!references.length)return false; // Guessed URLs and detached uploads remain owner-only.
 const follows=!!await Follow.exists({from:viewer,to:ownerId,status:'accepted'});
 for(const reference of references) {
  if(reference.event)return true;
  const visibility=reference.visibility || 'public';
  if(visibility==='private')continue;
  if((owner.isPrivate || visibility==='followers') && !follows)continue;
  return true;
 }
 return false;
}
export async function restrictOrphanedMedia(value,user) {
 const values=(Array.isArray(value)?value:[value]).map(mediaId).filter(Boolean);
 if(!values.length)return;
 const query={_id:{$in:values},...(user?{owner:user._id ?? user.id}:{})};
 await CampusMedia.updateMany(query,{$set:{visibility:'private',orphanedAt:new Date()}});
}
export function inspectMedia(bytes) {
 if(!Buffer.isBuffer(bytes) || bytes.length<12)fail(400,'This file is not a supported image or video.');
 let mime,kind='image';
 if(bytes.length>=24 && bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])) && bytes.toString('ascii',12,16)==='IHDR' && bytes.readUInt32BE(16)>0 && bytes.readUInt32BE(20)>0)mime='image/png';
 else if(bytes[0]===255 && bytes[1]===216 && bytes[2]===255 && bytes.at(-2)===255 && bytes.at(-1)===217)mime='image/jpeg';
 else if(['GIF87a','GIF89a'].includes(bytes.toString('ascii',0,6)) && bytes.readUInt16LE(6)>0 && bytes.readUInt16LE(8)>0)mime='image/gif';
 else if(bytes.toString('ascii',0,4)==='RIFF' && bytes.toString('ascii',8,12)==='WEBP' && bytes.length>=20)mime='image/webp';
 else if(bytes.length>=24 && bytes.toString('ascii',4,8)==='ftyp' && bytes.readUInt32BE(0)>=16 && bytes.readUInt32BE(0)<=bytes.length){mime='video/mp4';kind='video';}
 else if(bytes.subarray(0,4).equals(Buffer.from([26,69,223,163])) && bytes.subarray(4,Math.min(bytes.length,4096)).includes(Buffer.from('webm'))){mime='video/webm';kind='video';}
 else fail(400,'Choose a JPEG, PNG, GIF, WebP, MP4 or WebM file. File contents must match the format.');
 const max=kind==='image'?8*1024*1024:25*1024*1024;if(bytes.length>max)fail(413,`${kind==='image'?'Images are limited to 8 MB':'Videos are limited to 25 MB'}.`);
 return {mime,kind,size:bytes.length};
}
export function createMediaStore(config={}) {
 const directory=path.resolve(config.mediaDirectory || config.mediaDir || process.env.CAMPUS_MEDIA_DIR || '.campus-media');
 return {directory,async put(user,bytes,{visibility='private'}={}) {
  if(!['public','followers','private'].includes(visibility))fail(400,'Choose a valid media visibility.');
  const info=inspectMedia(bytes),key=crypto.randomBytes(24).toString('hex');
  await fs.mkdir(directory,{recursive:true,mode:0o700});await fs.writeFile(path.join(directory,key),bytes,{flag:'wx',mode:0o600});
  try{return await CampusMedia.create({owner:user._id ?? user.id,key,...info,visibility});}
  catch(error){await fs.unlink(path.join(directory,key)).catch(()=>{});throw error;}
 },pathFor(item){if(!/^[a-f0-9]{48}$/.test(item.key))fail(404,'Media not found.');return path.join(directory,item.key);}};
}
