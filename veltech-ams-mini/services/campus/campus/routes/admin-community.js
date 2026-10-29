import {duplicateKey} from '../security.js';
import User from '../../models/User.js';
import Post from '../../models/Post.js';
import Reel from '../../models/Reel.js';
import {CampusPost,Audit} from '../models.js';
import {ModerationAction,AdminDelivery} from '../models/admin-messages.js';
import {requireAdminAction} from '../services/admin-access.js';
import {accountEmail,prepareCampaign} from '../services/admin-messages.js';
import {createNotification} from '../services/notifications.js';
import {restrictOrphanedMedia} from '../services/media-store.js';
import {fail,validateId} from '../security.js';
async function target(type,id){
 validateId(id);if(!['post','reel'].includes(type))fail(400,'Choose a post or reel.');
 let item=await (type==='reel'?Reel:CampusPost).findById(id),source=type==='reel'?'Reel':'CampusPost';
 if(!item && type==='post'){item=await Post.findById(id);source='Post';}if(!item)fail(404,'Content not found.');return {item,source};
}
export function registerAdminCommunity(router,config){
 router.get('/admin/community',config.auth,async(req,res)=>{
  requireAdminAction(req.user,'moderation','view');const q=String(req.query.q || '').trim();if(q.length>100)fail(400,'Search is too long.');
  const regex=q.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'),base={isArchived:{$ne:true}};const rows=[];
  for(const [model,type] of [[CampusPost,'post'],[Post,'post'],[Reel,'reel']]){
   const query=q?{...base,$or:[{text:{$regex:regex,$options:'i'}},{caption:{$regex:regex,$options:'i'}}]}:base;
   for(const item of await model.find(query).sort({createdAt:-1}).limit(60).populate('user','name username image').lean())rows.push({id:String(item._id),type,text:item.text || item.caption || '',image:item.image || item.thumbnail || (item.mediaType==='image'?item.media:''),video:item.video || (item.mediaType==='video'?item.media:''),createdAt:item.createdAt,visibility:item.visibility,user:item.user?{id:String(item.user._id),name:item.user.name,username:item.user.username,image:item.user.image}:null});
  }
  rows.sort((a,b)=>new Date(b.createdAt)-new Date(a.createdAt));res.json({items:rows.slice(0,100)});
 });
 router.delete('/admin/community/:type/:id',config.auth,async(req,res)=>{
  requireAdminAction(req.user,'moderation','delete');const reason=req.body?.reason;
  if(typeof reason!=='string' || reason.trim().length<8 || reason.length>1000)fail(400,'Give a clear removal reason between 8 and 1,000 characters.');
  const {item,source}=await target(req.params.type,req.params.id);let action=await ModerationAction.findOne({targetType:req.params.type,targetId:item._id});
  if(!action){if(item.isArchived)fail(409,'This content is already archived.');try{action=await ModerationAction.create({targetType:req.params.type,targetId:item._id,owner:item.user,actor:req.user._id,reason:reason.trim(),excerpt:String(item.text || item.caption || '').slice(0,200),source});}catch(error){if(!duplicateKey(error))throw error;action=await ModerationAction.findOne({targetType:req.params.type,targetId:item._id});}}
  item.isArchived=true;item.moderationLocked=true;await item.save();await restrictOrphanedMedia([item.image,item.video,item.media,item.thumbnail]);
  const user=await User.findById(action.owner);if(user){
   const title=`Your ${action.targetType} was removed`,body=`Your ${action.targetType} was removed by campus moderation.\n\nReason: ${action.reason}\n\nYou can contact campus support if you believe this decision is incorrect.`;
   const campaign=await prepareCampaign({actor:{_id:action.actor},requestId:'moderation:'+action.id,title,body,audience:{kind:'moderation'},kind:'moderation',directRecipients:[{user:user._id,to:accountEmail(user)}],email:true,inApp:true,mail:config.mail});
   await ModerationAction.updateOne({_id:action._id},{$set:{campaign:campaign.id}});
   await createNotification({toUser:user._id,fromUser:action.actor,type:'moderation',eventKey:'admin-message:'+campaign.id,title,message:body,link:'/notifications',category:'community'});
   await AdminDelivery.updateMany({campaign:campaign.id,user:user._id},{$set:{notificationSent:true}});
  }
  await Audit.create({actor:req.user._id,action:'community.moderate',target:item.id,details:JSON.stringify({type:action.targetType,reason:action.reason})});res.json({removed:true,id:item.id,reason:action.reason,emailQueued:true});
 });
 router.get('/moderation/history',config.auth,async(req,res)=>{const rows=await ModerationAction.find({owner:req.user._id}).sort({createdAt:-1}).limit(100).select('targetType reason excerpt createdAt').lean();res.json({actions:rows.map(row=>({id:String(row._id),type:row.targetType,reason:row.reason,excerpt:row.excerpt,createdAt:row.createdAt}))});});
}
