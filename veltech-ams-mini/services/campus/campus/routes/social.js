import {departmentQuery} from '../../../../shared/publishing-directory.mjs';
import {CampusPost,Notice} from '../models.js';
import User from '../../models/User.js';
import LegacyPost from '../../models/Post.js';
import LegacyComment from '../../models/Comment.js';
import Follow from '../../models/Follow.js';
import Notification from '../../models/Notification.js';
import Event from '../../models/Event.js';
import mongoose from 'mongoose';
import {commentView} from '../services/comment-policy.js';
import {readable,overlayInput,authorView as safeAuthorView} from '../services/community-policy.js';
import {visiblePosts} from './community-extra.js';
import {requireOwnedMedia,mediaUrl,restrictOrphanedMedia} from '../services/media-store.js';
import {refreshKeyQuery,refreshedItems} from '../services/recommendations.js';
import {notifySocial,notifyComment,notifyMentions} from '../services/notifications.js';
import {fail,validateId} from '../security.js';
const includesId=(ids,id)=>(ids || []).some(value=>String(value)===String(id));
export function registerSocial(router,config) {
  async function ownPost(id,user) {
    validateId(id);
    let post=await CampusPost.findOne({_id:id,isArchived:{$ne:true}}).populate('user','name username image department isPrivate isActive');
    const legacy=!post;
    if(legacy) post=await LegacyPost.findOne({_id:id,isArchived:{$ne:true}}).populate('user','name username image department isPrivate isActive');
    if(!post || !post.user) fail(404,'Post not found');
    if(!await readable(post,user)) fail(403,'This profile is private');
    return {post,legacy};
  }
  router.get('/feed',config.auth,async(req,res)=>{const refreshKey=refreshKeyQuery(req.query);res.json(refreshedItems(await visiblePosts(req.user),refreshKey));});
  router.get('/feed/:id',config.auth,async(req,res)=>{
    const rows=await visiblePosts(req.user,{_id:validateId(req.params.id)});
    if(!rows.length)fail(404,'Post not found');res.json(rows[0]);
  });
  router.post('/feed',config.auth,async(req,res)=>{
    const {text,category='campus',image='',video=''}=req.body;
    const styles=overlayInput(req.body);
    let ownedImage='',ownedVideo='';if(image)ownedImage=mediaUrl((await requireOwnedMedia(req.user,image,{kind:'image'}))._id);if(video)ownedVideo=mediaUrl((await requireOwnedMedia(req.user,video,{kind:'video'}))._id);if(image && video)fail(400,'Choose one attachment per post');
    if(req.body.eventId){validateId(req.body.eventId);if(!await Event.exists({_id:req.body.eventId,status:{$ne:'cancelled'},archivedAt:null}))fail(404,'Event not found');styles.eventId=req.body.eventId;}
    if(typeof text!=='string' || !text.trim() || text.length>2200 || !['campus','achievement','project','opportunity'].includes(category)) fail(400,'Write a post up to 2,200 characters and choose a category');
    const post=await CampusPost.create({user:req.user._id,text:text.trim(),category,image:ownedImage,video:ownedVideo,...styles});
    await notifyMentions({actor:req.user,content:{...post.toObject(),user:req.user},post:post._id});res.status(201).json({id:post.id});
  });
  router.patch('/feed/:id',config.auth,async(req,res)=>{
    const {post,legacy}=await ownPost(req.params.id,req.user);
    if(String(post.user._id)!==req.user.id)fail(403,'Only the author can edit this post');
    const {text}=req.body,max=legacy?2200:2200;
    if(typeof text!=='string' || !text.trim() || text.length>max)fail(400,'Write a post up to 2,200 characters');
    await (legacy?LegacyPost:CampusPost).updateOne({_id:post._id,user:req.user._id},{$set:{[legacy?'caption':'text']:text.trim()}});
    res.json({success:true});
  });
  router.delete('/feed/:id',config.auth,async(req,res)=>{
    const {post,legacy}=await ownPost(req.params.id,req.user);
    if(String(post.user._id)!==req.user.id)fail(403,'Only the author can remove this post');
    if(legacy)await LegacyPost.updateOne({_id:post._id,user:req.user._id},{$set:{isArchived:true}});
    else {await restrictOrphanedMedia([post.image,post.video],req.user);await CampusPost.deleteOne({_id:post._id,user:req.user._id});}
    res.json({success:true});
  });
  router.put('/feed/:id/like',config.auth,async(req,res)=>{
    if(typeof req.body.liked!=='boolean') fail(400,'Like state must be true or false');
    const {post,legacy}=await ownPost(req.params.id,req.user);
    const changed=await (legacy?LegacyPost:CampusPost).updateOne({_id:post._id},req.body.liked?{$addToSet:{likes:req.user._id}}:{$pull:{likes:req.user._id}});
    if(req.body.liked && changed.modifiedCount)await notifySocial({actor:req.user,recipient:post.user,type:'like',content:post,post:post._id});
    if(!req.body.liked)await Notification.updateMany({toUser:post.user._id,fromUser:req.user._id,type:'like',post:post._id,dismissedAt:null},{$set:{dismissedAt:new Date()}});
    const latest=await (legacy?LegacyPost:CampusPost).findById(post._id).select('likes');if(!latest)fail(404,'Post not found');res.json({liked:req.body.liked,likes:latest.likes.length});
  });
  router.put('/feed/:id/save',config.auth,async(req,res)=>{
    if(typeof req.body.saved!=='boolean') fail(400,'Save state must be true or false');
    const {post,legacy}=await ownPost(req.params.id,req.user);
    if(legacy) await User.updateOne({_id:req.user._id},req.body.saved?{$addToSet:{savedPosts:post._id}}:{$pull:{savedPosts:post._id}});
    else await CampusPost.updateOne({_id:post._id},req.body.saved?{$addToSet:{savedBy:req.user._id}}:{$pull:{savedBy:req.user._id}});
    res.json({saved:req.body.saved});
  });
  router.post('/feed/:id/comments',config.auth,async(req,res)=>{
    const {post,legacy}=await ownPost(req.params.id,req.user);
    const text=req.body.text,maxLength=legacy?300:500;
    if(typeof text!=='string' || !text.trim() || text.trim().length>maxLength) fail(400,`Write a comment up to ${maxLength} characters`);
    let parentComment=null,parent=null;
    if(req.body.parentComment!==undefined && req.body.parentComment!==null){
      validateId(req.body.parentComment);
      parent=legacy?await LegacyComment.findOne({_id:req.body.parentComment,targetId:post._id,targetType:'post'}):post.comments.id(req.body.parentComment);
      if(!parent || (legacy&&!includesId(post.comments,parent._id)))fail(400,'Reply to a comment on this post');
      parentComment=parent.parentComment || parent._id;
    }
    let created;
    if(legacy) {
      const comment=await LegacyComment.create({user:req.user._id,post:post._id,targetId:post._id,targetType:'post',text:text.trim(),parentComment});
      const updated=await LegacyPost.updateOne({_id:post._id,isArchived:{$ne:true}},{$push:{comments:comment._id}});
      if(!updated.matchedCount) {await LegacyComment.deleteOne({_id:comment._id});fail(404,'Post not found');}
      created=comment.toObject();
    } else {
      created={_id:new mongoose.Types.ObjectId(),user:req.user._id,text:text.trim(),parentComment,createdAt:new Date()};
      const updated=await CampusPost.updateOne({_id:post._id},{$push:{comments:created}});
      if(!updated.matchedCount)fail(404,'Post not found');
    }
    await notifyComment({actor:req.user,content:post,post:post._id,comment:created,parent});
    res.status(201).json({success:true,comment:commentView({...created,user:req.user},req.user,post.user)});
  });
  router.get('/people',config.auth,async(req,res)=>{
    const users=await User.find({_id:{$ne:req.user._id},isPrivate:false,isActive:{$ne:false}}).select('name username image department bio followers').limit(30).lean();
    res.json(users.map(u=>({...safeAuthorView(u),bio:u.bio,following:req.user.following.map(String).includes(String(u._id)),followers:u.followers.length})));
  });
  router.put('/people/:id/follow',config.auth,async(req,res)=>{
    validateId(req.params.id);if(req.params.id===req.user.id) fail(400,'You cannot follow yourself');
    if(typeof req.body.following!=='boolean') fail(400,'Follow state must be true or false');
    const target=await User.findById(req.params.id);if(!target) fail(404,'Member not found');
    if(target.isPrivate && req.body.following) {
      if(!includesId(req.user.following,target._id)) fail(403,'Follow private profiles through the original app request flow');
      return res.json({following:true});
    }
    if(req.body.following){const follow=await Follow.findOneAndUpdate({from:req.user._id,to:target._id},{$set:{status:'accepted'}},{upsert:true,returnDocument:'after'});await notifySocial({actor:req.user,recipient:target,type:'follow',follow:follow._id,eventKey:`follow:${follow.id}:accepted`});}
    else {
      await Follow.deleteOne({from:req.user._id,to:target._id});
      await Notification.deleteMany({toUser:target._id,fromUser:req.user._id,type:{$in:['follow','follow_request']}});
    }
    await Promise.all([User.updateOne({_id:req.user._id},req.body.following?{$addToSet:{following:target._id}}:{$pull:{following:target._id}}),User.updateOne({_id:target._id},req.body.following?{$addToSet:{followers:req.user._id}}:{$pull:{followers:req.user._id}})]);res.json({following:req.body.following});
  });
  router.get('/notices',config.auth,async(req,res)=>res.json(await Notice.find({$or:[{department:''},{department:departmentQuery(req.user.department)}]}).sort({createdAt:-1}).limit(100).lean()));
}
