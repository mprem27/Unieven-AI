import Story from '../../models/Story.js';
import StoryArchive from '../../models/StoryArchive.js';
import Reel from '../../models/Reel.js';
import Comment from '../../models/Comment.js';
import User from '../../models/User.js';
import Event from '../../models/Event.js';
import Notification from '../../models/Notification.js';
import {notifySocial,notifyComment,notifyMentions} from '../services/notifications.js';
import {fail,validateId} from '../security.js';
import {commentView,commentText,assertCommentEdit,commentEditDates} from '../services/comment-policy.js';
import {refreshKeyQuery,refreshedItems} from '../services/recommendations.js';
import {requireOwnedMedia,mediaUrl} from '../services/media-store.js';
import {AUTHOR_FIELDS,authorView,sameId,hasId,acceptedAuthors,canReadContent,overlayInput,overlayView} from '../services/community-policy.js';

const STORY_FIELDS=['media','type','text','textColor','textFont','textStyle','textSize','textX','textY','bgGradient','filter','link','tags','views','comments','visibility','hashtags','mentions'];
export async function initializeMediaSocialIndexes() {
  // An older TTL index deleted stories before they could be archived. Remove only that index.
  let indexes=[];try{indexes=await Story.collection.indexes();}catch(error){if(error.code!==26)throw error;}
  for(const index of indexes)if(index.key?.expiresAt===1 && Object.keys(index.key).length===1 && index.expireAfterSeconds!==undefined)await Story.collection.dropIndex(index.name);
  await Story.createIndexes();
  await Promise.all([StoryArchive.init(),Reel.init(),Comment.init()]);
}
export async function archiveStory(story,now=new Date()) {
  const snapshot=Object.fromEntries(STORY_FIELDS.map(key=>[key,story[key]]));
  const archive=await StoryArchive.findOneAndUpdate({originalStory:story._id},{$setOnInsert:{...snapshot,user:story.user,originalStory:story._id,originalCreatedAt:story.createdAt,expiredAt:now}},{upsert:true,returnDocument:'after',setDefaultsOnInsert:true});
  // The archive write must finish before the source is removed, including after a process restart.
  await Story.deleteOne({_id:story._id});return archive;
}
export async function expireAndArchiveStories(now=new Date()) {
  const expired=await Story.find({expiresAt:{$lte:now}}).limit(500).lean();
  for(const story of expired)await archiveStory(story,now);
  return expired.length;
}
export function storyView(story,user,{archive=false}={}) {
  return {id:String(story._id),author:authorView(story.user),type:story.type,media:story.media || '',text:story.text || '',...overlayView(story),tags:(story.tags || []).map(String),hashtags:story.hashtags || [],mentions:story.mentions || [],createdAt:archive?story.originalCreatedAt:story.createdAt,expiresAt:story.expiresAt,expiredAt:story.expiredAt,viewCount:(story.views || []).length,viewed:hasId(story.views,user._id),canEdit:sameId(story.user,user)};
}
export function reelView(reel,user) {
  const own=sameId(reel.user,user);
  const dto={id:String(reel._id),author:authorView(reel.user),caption:reel.caption || '',video:reel.video,thumbnail:reel.thumbnail || '',...overlayView(reel),tags:(reel.tags || []).map(String),hashtags:reel.hashtags || [],mentions:reel.mentions || [],eventId:reel.eventId?String(reel.eventId._id ?? reel.eventId):null,likes:(reel.likes || []).length,liked:hasId(reel.likes,user._id),saved:hasId(user.savedReels,reel._id),views:reel.views || 0,canEdit:own,createdAt:reel.createdAt,isMuted:!!reel.isMuted};
  dto.comments=(reel.comments || []).filter(comment=>comment?.user && comment?.text).map(comment=>commentView(comment,user,reel.user));
  return dto;
}
const populateReel=query=>query.populate('user',AUTHOR_FIELDS).populate({path:'comments',populate:{path:'user',select:AUTHOR_FIELDS}});
async function ownedMedia(user,value,kind) {const media=await requireOwnedMedia(user,value,{kind});return mediaUrl(media._id);}
async function assertEvent(value) {
  if(!value)return null;validateId(value);
  if(!await Event.exists({_id:value,status:{$ne:'cancelled'},archivedAt:null}))fail(404,'Active event not found');
  return value;
}
async function accessibleReel(id,user) {
  validateId(id);const reel=await populateReel(Reel.findOne({_id:id,isArchived:{$ne:true}}));
  if(!reel?.user)fail(404,'Reel not found');
  if(!canReadContent(reel,user,await acceptedAuthors(user)))fail(403,'This reel is private');
  return reel;
}
function booleanState(value,label){if(typeof value!=='boolean')fail(400,`${label} state must be true or false`);return value;}
export function registerMediaSocial(router,config) {
  router.get('/stories/archive',config.auth,async(req,res)=>{
    await expireAndArchiveStories();
    const rows=await StoryArchive.find({user:req.user._id}).sort({originalCreatedAt:-1}).limit(100).populate('user',AUTHOR_FIELDS);
    res.json(rows.map(story=>storyView(story,req.user,{archive:true})));
  });
  router.get('/stories/archive/:id/views',config.auth,async(req,res)=>{
    validateId(req.params.id);const story=await StoryArchive.findOne({_id:req.params.id,user:req.user._id});
    if(!story)fail(404,'Your archived story was not found');
    const viewers=await User.find({_id:{$in:story.views},isActive:{$ne:false}}).select(AUTHOR_FIELDS).limit(100).lean();res.json(viewers.map(authorView));
  });
  router.get('/stories',config.auth,async(req,res)=>{
    const now=new Date();await expireAndArchiveStories(now);
    const accepted=await acceptedAuthors(req.user);
    const rows=await Story.find({expiresAt:{$gt:now}}).sort({createdAt:-1}).limit(200).populate('user',AUTHOR_FIELDS);
    res.json(rows.filter(story=>canReadContent(story,req.user,accepted)).map(story=>storyView(story,req.user)));
  });
  router.post('/stories',config.auth,async(req,res)=>{
    const {type='text',text=''}=req.body;
    if(!['text','image','video'].includes(type) || typeof text!=='string' || text.length>250)fail(400,'Choose a story type and up to 250 characters');
    if(type==='text' && !text.trim())fail(400,'Write your text story');
    const overlay=overlayInput(req.body);
    const media=type==='text'?'':await ownedMedia(req.user,req.body.mediaId || req.body.media || req.body.mediaUrl,type);
    const story=await Story.create({user:req.user._id,type,text:text.trim(),media,...overlay,expiresAt:new Date(Date.now()+86400000)});
    res.status(201).json({id:story.id});
  });
  router.get('/stories/:id/views',config.auth,async(req,res)=>{
    validateId(req.params.id);const story=await Story.findById(req.params.id);
    if(!story)fail(404,'Story not found');if(!sameId(story.user,req.user))fail(403,'Only the author can see story viewers');
    const viewers=await User.find({_id:{$in:story.views}}).select(AUTHOR_FIELDS).limit(100).lean();res.json(viewers.map(authorView));
  });
  router.post('/stories/:id/view',config.auth,async(req,res)=>{
    validateId(req.params.id);const story=await Story.findOne({_id:req.params.id,expiresAt:{$gt:new Date()}}).populate('user',AUTHOR_FIELDS);
    if(!story?.user)fail(404,'Story not found');if(!canReadContent(story,req.user,await acceptedAuthors(req.user)))fail(403,'This story is private');
    if(!sameId(story.user,req.user))await Story.updateOne({_id:story._id,expiresAt:{$gt:new Date()}},{$addToSet:{views:req.user._id}});
    res.json({success:true});
  });
  router.post('/stories/:id/archive',config.auth,async(req,res)=>{
    validateId(req.params.id);const story=await Story.findById(req.params.id).lean();if(!story)fail(404,'Story not found');
    if(!sameId(story.user,req.user))fail(403,'Only the author can archive this story');const archive=await archiveStory(story);res.json({id:archive.id});
  });
  router.delete('/stories/:id',config.auth,async(req,res)=>{
    validateId(req.params.id);const deleted=await Story.findOneAndDelete({_id:req.params.id,user:req.user._id});
    if(!deleted)fail(404,'Your story was not found');await Comment.deleteMany({targetId:deleted._id,targetType:'story'});res.json({success:true});
  });
  router.delete('/stories/archive/:id',config.auth,async(req,res)=>{
    validateId(req.params.id);if(!await StoryArchive.findOneAndDelete({_id:req.params.id,user:req.user._id}))fail(404,'Your archived story was not found');res.json({success:true});
  });
  router.get('/reels',config.auth,async(req,res)=>{
    const refreshKey=refreshKeyQuery(req.query);
    const query={isArchived:{$ne:true}};
    if(req.query.eventId){validateId(req.query.eventId);query.eventId=req.query.eventId;}
    if(req.query.userId){validateId(req.query.userId);query.user=req.query.userId;}
    const accepted=await acceptedAuthors(req.user);
    const reels=await populateReel(Reel.find(query).sort({createdAt:-1}).limit(100));
    res.json(refreshedItems(reels.filter(reel=>canReadContent(reel,req.user,accepted)).map(reel=>reelView(reel,req.user)),refreshKey));
  });
  router.post('/reels',config.auth,async(req,res)=>{
    const {caption='',isMuted=false}=req.body;
    if(typeof caption!=='string'||caption.length>2200||typeof isMuted!=='boolean')fail(400,'Write a reel caption up to 2,200 characters');
    const overlay=overlayInput(req.body);
    const video=await ownedMedia(req.user,req.body.videoId || req.body.video,'video');
    const thumbnail=req.body.thumbnail?await ownedMedia(req.user,req.body.thumbnail,'image'):'';
    const eventId=await assertEvent(req.body.eventId);
    const reel=await Reel.create({user:req.user._id,caption:caption.trim(),video,thumbnail,isMuted,eventId,...overlay});
    await notifyMentions({actor:req.user,content:{...reel.toObject(),user:req.user},reel:reel._id});res.status(201).json({id:reel.id});
  });
  router.patch('/reels/:id',config.auth,async(req,res)=>{
    const reel=await accessibleReel(req.params.id,req.user);if(!sameId(reel.user,req.user))fail(403,'Only the author can edit this reel');
    const fields=overlayInput({...req.body,visibility:req.body.visibility ?? reel.visibility ?? 'account'});
    if(req.body.caption!==undefined){if(typeof req.body.caption!=='string'||req.body.caption.length>2200)fail(400,'Caption must be at most 2,200 characters');fields.caption=req.body.caption.trim();}
    if(req.body.eventId!==undefined)fields.eventId=await assertEvent(req.body.eventId);
    await Reel.updateOne({_id:reel._id,user:req.user._id},{$set:fields},{runValidators:true});res.json({success:true});
  });
  router.put('/reels/:id/like',config.auth,async(req,res)=>{
    const liked=booleanState(req.body.liked,'Like'),reel=await accessibleReel(req.params.id,req.user);
    const update=await Reel.updateOne({_id:reel._id},liked?{$addToSet:{likes:req.user._id}}:{$pull:{likes:req.user._id}});
    if(liked && update.modifiedCount)await notifySocial({actor:req.user,recipient:reel.user,type:'like',content:reel,reel:reel._id});
    if(!liked)await Notification.updateMany({toUser:reel.user._id,fromUser:req.user._id,type:'like',reel:reel._id,dismissedAt:null},{$set:{dismissedAt:new Date()}});
    const latest=await Reel.findById(reel._id).select('likes');if(!latest)fail(404,'Reel not found');res.json({liked,likes:latest.likes.length});
  });
  router.put('/reels/:id/save',config.auth,async(req,res)=>{
    const saved=booleanState(req.body.saved,'Save'),reel=await accessibleReel(req.params.id,req.user);
    await User.updateOne({_id:req.user._id},saved?{$addToSet:{savedReels:reel._id}}:{$pull:{savedReels:reel._id}});res.json({saved});
  });
  router.post('/reels/:id/view',config.auth,async(req,res)=>{
    const seconds=req.body.playedSeconds;
    if(typeof seconds!=='number'||!Number.isFinite(seconds)||seconds<2||seconds>86400)fail(400,'A playback view requires at least two seconds of playback');
    const reel=await accessibleReel(req.params.id,req.user);
    if(!sameId(reel.user,req.user))await Reel.updateOne({_id:reel._id,viewedBy:{$ne:req.user._id}},{$addToSet:{viewedBy:req.user._id},$inc:{views:1}});
    const latest=await Reel.findById(reel._id).select('views');res.json({views:latest.views});
  });
  router.post('/reels/:id/comments',config.auth,async(req,res)=>{
    const reel=await accessibleReel(req.params.id,req.user),{text,parentComment}=req.body;
    if(typeof text!=='string'||!text.trim()||text.trim().length>300)fail(400,'Write a comment up to 300 characters');
    let parent=null;
    if(parentComment){validateId(parentComment);parent=await Comment.findOne({_id:parentComment,targetId:reel._id,targetType:'reel'});if(!parent)fail(400,'Reply to a comment on this reel');}
    const comment=await Comment.create({user:req.user._id,text:text.trim(),reel:reel._id,targetId:reel._id,targetType:'reel',parentComment:parentComment || null});
    const updated=await Reel.updateOne({_id:reel._id,isArchived:{$ne:true}},{$push:{comments:comment._id}});
    if(!updated.matchedCount){await Comment.deleteOne({_id:comment._id});fail(404,'Reel not found');}
    await notifyComment({actor:req.user,content:reel,reel:reel._id,comment,parent});
    res.status(201).json({id:comment.id,comment:commentView({...comment.toObject(),user:req.user},req.user,reel.user)});
  });
  router.get('/reels/:id/comments',config.auth,async(req,res)=>{
    const reel=await accessibleReel(req.params.id,req.user);res.json(reelView(reel,req.user).comments);
  });
  async function reelComment(req) {
    const commentId=req.params.commentId || req.params.id;validateId(commentId);
    const comment=await Comment.findOne({_id:commentId,targetType:'reel'});if(!comment)fail(404,'Comment not found');
    if(req.params.commentId && !sameId(comment.targetId,req.params.id))fail(404,'Comment not found');
    const reel=await accessibleReel(String(comment.targetId),req.user);
    if(!hasId(reel.comments,comment._id))fail(404,'Comment not found');return {comment,reel};
  }
  async function editReelComment(req,res) {
    const {comment,reel}=await reelComment(req),now=new Date();assertCommentEdit(comment,req.user,now);
    const text=commentText(req.body.text);
    const changed=await Comment.findOneAndUpdate({_id:comment._id,user:req.user._id,targetId:reel._id,targetType:'reel',createdAt:commentEditDates(now)},{$set:{text,editedAt:now}},{returnDocument:'after',runValidators:true}).populate('user',AUTHOR_FIELDS);
    if(!changed)fail(409,'This comment was removed or its five-minute edit window ended');res.json({success:true,comment:commentView(changed,req.user,reel.user)});
  }
  async function likeReelComment(req,res) {
    const liked=booleanState(req.body.liked,'Like'),{comment,reel}=await reelComment(req);
    const changed=await Comment.updateOne({_id:comment._id},liked?{$addToSet:{likes:req.user._id}}:{$pull:{likes:req.user._id}});
    if(liked && changed.modifiedCount)await notifySocial({actor:req.user,recipient:comment.user,type:'like',content:reel,reel:reel._id,comment:comment._id});
    if(!liked)await Notification.updateMany({fromUser:req.user._id,type:'like',reel:reel._id,comment:comment._id,dismissedAt:null},{$set:{dismissedAt:new Date()}});const latest=await Comment.findById(comment._id).select('likes');if(!latest)fail(404,'Comment not found');res.json({liked,likes:latest.likes.length});
  }
  async function deleteReelComment(req,res) {
    const {comment,reel}=await reelComment(req);
    if(!sameId(comment.user,req.user)&&!sameId(reel.user,req.user))fail(403,'Only the comment or reel author can remove this comment');
    await Comment.deleteOne({_id:comment._id});await Reel.updateOne({_id:reel._id},{$pull:{comments:comment._id}});res.json({success:true});
  }
  router.patch('/reels/:id/comments/:commentId',config.auth,editReelComment);
  router.put('/reels/:id/comments/:commentId/like',config.auth,likeReelComment);
  router.delete('/reels/:id/comments/:commentId',config.auth,deleteReelComment);
  router.patch('/reels/comments/:id',config.auth,editReelComment);
  router.put('/reels/comments/:id/like',config.auth,likeReelComment);
  router.delete('/reels/comments/:id',config.auth,deleteReelComment);
  router.delete('/reels/:id',config.auth,async(req,res)=>{
    validateId(req.params.id);const reel=await Reel.findOneAndUpdate({_id:req.params.id,user:req.user._id,isArchived:{$ne:true}},{$set:{isArchived:true}});
    if(!reel)fail(404,'Your reel was not found');await Notification.deleteMany({reel:reel._id});res.json({success:true});
  });
}
