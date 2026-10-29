import {duplicateKey} from '../security.js';
import User from '../../models/User.js';
import Follow from '../../models/Follow.js';
import Notification from '../../models/Notification.js';
import {notifySocial} from '../services/notifications.js';
import Post from '../../models/Post.js';
import Comment from '../../models/Comment.js';
import Reel from '../../models/Reel.js';
import Event from '../../models/Event.js';
import {CampusPost} from '../models.js';
import {fail,validateId} from '../security.js';
import {requireOwnedMedia,mediaUrl} from '../services/media-store.js';
import {AUTHOR_FIELDS,authorView,socialLinksInput,hasId,sameId,acceptedAuthors,canReadContent,boundedQuery,escapeRegex,overlayView} from '../services/community-policy.js';
import {reelView} from './media-social.js';
import {commentView,commentText,assertCommentEdit,commentEditDates} from '../services/comment-policy.js';

export function postView(post,user,{legacy=false}={}) {
  const comments=(post.comments || []).filter(comment=>comment?.text && comment?.user).map(comment=>commentView(comment,user,post.user));
  return {id:String(post._id),author:authorView(post.user),text:legacy?post.caption:post.text,image:legacy?(post.type==='image'?post.media:''):post.image || '',video:legacy?(post.type==='video'?post.media:''):post.video || '',category:legacy?'campus':post.category,createdAt:post.createdAt,likes:(post.likes || []).length,liked:hasId(post.likes,user._id),saved:legacy?hasId(user.savedPosts,post._id):hasId(post.savedBy,user._id),canEdit:sameId(post.user,user),...overlayView(post),tags:(post.tags || []).map(String),hashtags:post.hashtags || [],mentions:post.mentions || [],comments,legacy,eventId:post.eventId?String(post.eventId):null};
}
function legacyFields(query) {
  if(Array.isArray(query))return query.map(legacyFields);
  if(!query || query.constructor!==Object)return query;
  return Object.fromEntries(Object.entries(query).map(([key,value])=>[key==='text'?'caption':key,legacyFields(value)]));
}
export async function visiblePosts(user,query={}) {
  const accepted=await acceptedAuthors(user);
  const campus=await CampusPost.find({...query,isArchived:{$ne:true}}).sort({createdAt:-1}).limit(100).populate('user',AUTHOR_FIELDS).populate('comments.user',AUTHOR_FIELDS);
  const legacyQuery={isArchived:{$ne:true},...legacyFields(query)};
  const legacy=await Post.find(legacyQuery).sort({createdAt:-1}).limit(100).populate('user',AUTHOR_FIELDS).populate({path:'comments',populate:{path:'user',select:AUTHOR_FIELDS}});
  return [...campus.filter(post=>canReadContent(post,user,accepted)).map(post=>postView(post,user)),...legacy.filter(post=>canReadContent(post,user,accepted)).map(post=>postView(post,user,{legacy:true}))].sort((a,b)=>new Date(b.createdAt)-new Date(a.createdAt)).slice(0,100);
}
const ownView=user=>authorView(user);
async function relation(user,target){return Follow.findOne({from:user._id,to:target._id}).lean();}
async function memberView(user,viewer) {
  const follow=await relation(viewer,user);
  return {...authorView(user),following:follow?.status==='accepted',requestStatus:follow?.status || null,followersCount:await Follow.countDocuments({to:user._id,status:'accepted'}),followingCount:await Follow.countDocuments({from:user._id,status:'accepted'})};
}
async function syncAccepted(from,to) {
  await Promise.all([User.updateOne({_id:from},{$addToSet:{following:to}}),User.updateOne({_id:to},{$addToSet:{followers:from},$pull:{followRequests:from}})]);
}
async function targetPost(id,user) {
  validateId(id);let post=await CampusPost.findOne({_id:id,isArchived:{$ne:true}}).populate('user',AUTHOR_FIELDS),legacy=false;
  if(!post){legacy=true;post=await Post.findOne({_id:id,isArchived:{$ne:true}}).populate('user',AUTHOR_FIELDS);}
  if(!post?.user)fail(404,'Post not found');if(!canReadContent(post,user,await acceptedAuthors(user)))fail(403,'This post is private');return {post,legacy};
}
export function registerCommunityExtras(router,config) {
  router.get('/members/me',config.auth,async(req,res)=>res.json(ownView(req.user)));
  router.patch('/members/me',config.auth,async(req,res)=>{
    const body=req.body,fields={};
    const allowed=['name','username','bio','image','isPrivate','socialDepartment','socialLinks'];
    if(!body||typeof body!=='object'||Array.isArray(body)||Object.keys(body).some(key=>!allowed.includes(key)))fail(400,'Only social profile fields can be edited; official records and account permissions are read-only');
    for(const [key,max] of [['name',100],['bio',300],['socialDepartment',100]])if(body[key]!==undefined){if(typeof body[key]!=='string'||body[key].length>max||(key==='name'&&!body[key].trim()))fail(400,`${key} must be ${key==='name'?'1–':'at most '}${max} characters`);fields[key]=body[key].trim();}
    if(body.username!==undefined){if(typeof body.username!=='string'||!/^[a-z0-9_.]{3,30}$/i.test(body.username))fail(400,'Username must be 3–30 letters, numbers, dots, or underscores');fields.username=body.username.toLowerCase();}
    if(body.isPrivate!==undefined){if(typeof body.isPrivate!=='boolean')fail(400,'Privacy must be true or false');fields.isPrivate=body.isPrivate;}
    if(body.socialLinks!==undefined)fields.socialLinks=socialLinksInput(body.socialLinks);
    if(body.image!==undefined && body.image!==req.user.image){fields.image=body.image?mediaUrl((await requireOwnedMedia(req.user,body.image,{kind:'image'}))._id):'';}
    await User.updateOne({_id:req.user._id},{$set:fields},{runValidators:true});const user=await User.findById(req.user._id);res.json({success:true,user:ownView(user)});
  });
  router.patch('/members/:username',config.auth,async()=>{fail(403,'Only your own social profile can be edited through /members/me');});
  router.get('/members/check-username',config.auth,async(req,res)=>{
    const username=boundedQuery(req.query.username,30).toLowerCase();
    if(!/^[a-z0-9_.]{3,30}$/.test(username))fail(400,'Username must be 3–30 letters, numbers, dots, or underscores');
    res.json({available:!await User.exists({username,_id:{$ne:req.user._id}})});
  });
  router.get('/community/saved',config.auth,async(req,res)=>{
    const accepted=await acceptedAuthors(req.user);
    const [posts,reels]=await Promise.all([
      visiblePosts(req.user,{$or:[{savedBy:req.user._id},{_id:{$in:req.user.savedPosts || []}}]}),
      Reel.find({_id:{$in:req.user.savedReels || []},isArchived:{$ne:true}}).sort({createdAt:-1}).limit(100).populate('user',AUTHOR_FIELDS).populate({path:'comments',populate:{path:'user',select:AUTHOR_FIELDS}})
    ]);
    res.json({posts,reels:reels.filter(reel=>canReadContent(reel,req.user,accepted)).map(reel=>reelView(reel,req.user))});
  });
  router.get('/members',config.auth,async(req,res)=>{
    const q=boundedQuery(req.query.q,64),pattern=q?new RegExp(escapeRegex(q),'i'):null;
    const query={_id:{$ne:req.user._id},isActive:{$ne:false},...(pattern?{$or:[{name:pattern},{username:pattern},{bio:pattern}]}:{})};
    const users=await User.find(query).select(AUTHOR_FIELDS).sort({createdAt:-1}).limit(30).lean();res.json(await Promise.all(users.map(user=>memberView(user,req.user))));
  });
  router.get('/members/:username',config.auth,async(req,res)=>{
    const name=boundedQuery(req.params.username,30);const member=await User.findOne({username:name.toLowerCase(),isActive:{$ne:false}}).select(AUTHOR_FIELDS);
    if(!member)fail(404,'Member not found');const dto=await memberView(member,req.user);
    const allowed=canReadContent({user:member},req.user,await acceptedAuthors(req.user));
    let posts=[],reels=[];
    if(allowed){posts=await visiblePosts(req.user,{user:member._id});const rows=await Reel.find({user:member._id,isArchived:{$ne:true}}).sort({createdAt:-1}).limit(100).populate('user',AUTHOR_FIELDS).populate({path:'comments',populate:{path:'user',select:AUTHOR_FIELDS}});const accepted=await acceptedAuthors(req.user);reels=rows.filter(row=>canReadContent(row,req.user,accepted)).map(row=>reelView(row,req.user));}
    res.json({member:dto,canViewContent:allowed,posts,reels,following:dto.following,requestStatus:dto.requestStatus,followersCount:dto.followersCount,followingCount:dto.followingCount});
  });
  for(const kind of ['followers','following'])router.get(`/members/:id/${kind}`,config.auth,async(req,res)=>{
    validateId(req.params.id);const member=await User.findById(req.params.id).select(AUTHOR_FIELDS);if(!member)fail(404,'Member not found');
    if(!canReadContent({user:member},req.user,await acceptedAuthors(req.user)))fail(403,'This connection list is private');
    const rows=await Follow.find({[kind==='followers'?'to':'from']:member._id,status:'accepted'}).sort({createdAt:-1}).limit(100).populate(kind==='followers'?'from':'to',AUTHOR_FIELDS);
    res.json(rows.map(row=>row[kind==='followers'?'from':'to']).filter(Boolean).map(authorView));
  });
  router.get('/connections',config.auth,async(req,res)=>{
    const rows=await Follow.find({$or:[{from:req.user._id},{to:req.user._id}]}).sort({createdAt:-1}).limit(300).populate('from',AUTHOR_FIELDS).populate('to',AUTHOR_FIELDS);
    const map=row=>({id:String(row._id),from:authorView(row.from),to:authorView(row.to),status:row.status,createdAt:row.createdAt});
    const valid=rows.filter(row=>row.from && row.to && row.from.isActive!==false && row.to.isActive!==false);
    res.json({incoming:valid.filter(row=>row.status==='requested'&&sameId(row.to,req.user)).map(map),outgoing:valid.filter(row=>row.status==='requested'&&sameId(row.from,req.user)).map(map),following:valid.filter(row=>row.status==='accepted'&&sameId(row.from,req.user)).map(row=>authorView(row.to))});
  });
  router.post('/connections/:id',config.auth,async(req,res)=>{
    validateId(req.params.id);if(sameId(req.params.id,req.user))fail(400,'You cannot follow yourself');
    const target=await User.findOne({_id:req.params.id,isActive:{$ne:false}}).select(AUTHOR_FIELDS);if(!target)fail(404,'Member not found');
    let follow=await Follow.findOne({from:req.user._id,to:target._id});
    if(!follow){try{follow=await Follow.create({from:req.user._id,to:target._id,status:target.isPrivate?'requested':'accepted'});}catch(error){if(!duplicateKey(error))throw error;follow=await Follow.findOne({from:req.user._id,to:target._id});}}
    if(!target.isPrivate && follow.status!=='accepted'){follow.status='accepted';await follow.save();}
    if(follow.status==='accepted')await syncAccepted(req.user._id,target._id);else await User.updateOne({_id:target._id},{$addToSet:{followRequests:req.user._id}});
    await notifySocial({actor:req.user,recipient:target,type:follow.status==='accepted'?'follow':'follow_request',follow:follow._id,eventKey:`follow:${follow.id}:${follow.status}`});
    res.json({id:follow.id,status:follow.status,following:follow.status==='accepted'});
  });
  for(const action of ['accept','reject'])router.post(`/connections/:id/${action}`,config.auth,async(req,res)=>{
    validateId(req.params.id);const follow=await Follow.findById(req.params.id);if(!follow)fail(404,'Connection request not found');
    if(!sameId(follow.to,req.user))fail(403,'Only the recipient can answer this request');
    if(follow.status!=='requested'){if(action==='accept')return res.json({success:true,status:follow.status});fail(409,'Only pending requests can be rejected');}
    if(action==='accept'){await Follow.updateOne({_id:follow._id,status:'requested'},{$set:{status:'accepted'}});await syncAccepted(follow.from,follow.to);await notifySocial({actor:req.user,recipient:follow.from,type:'follow_accepted',follow:follow._id,eventKey:`follow-accepted:${follow.id}`});}
    else {await Follow.deleteOne({_id:follow._id,status:'requested'});await User.updateOne({_id:follow.to},{$pull:{followRequests:follow.from}});}
    await Notification.deleteMany({follow:follow._id,type:'follow_request'});res.json({success:true,status:action==='accept'?'accepted':'rejected'});
  });
  router.delete('/connections/:id',config.auth,async(req,res)=>{
    validateId(req.params.id);
    await Follow.deleteOne({from:req.user._id,to:req.params.id});
    await Promise.all([User.updateOne({_id:req.user._id},{$pull:{following:req.params.id}}),User.updateOne({_id:req.params.id},{$pull:{followers:req.user._id,followRequests:req.user._id}}),Notification.deleteMany({toUser:req.params.id,fromUser:req.user._id,type:{$in:['follow','follow_request']}})]);res.json({success:true,following:false});
  });
  router.get('/search',config.auth,async(req,res)=>{
    const q=boundedQuery(req.query.q,64);if(!q)return res.json({members:[],posts:[],reels:[],events:[]});
    const pattern=new RegExp(escapeRegex(q),'i'),accepted=await acceptedAuthors(req.user);
    const [members,posts,reels,events]=await Promise.all([
      User.find({isActive:{$ne:false},$or:[{name:pattern},{username:pattern},{bio:pattern}]}).select(AUTHOR_FIELDS).limit(30).lean(),
      visiblePosts(req.user,{$or:[{text:pattern},{hashtags:pattern},{overlayText:pattern}]}),
      Reel.find({$or:[{caption:pattern},{hashtags:pattern},{overlayText:pattern}],isArchived:{$ne:true}}).sort({createdAt:-1}).limit(100).populate('user',AUTHOR_FIELDS),
      Event.find({title:pattern,status:{$ne:'cancelled'},archivedAt:null}).select('title date time location image scope category').sort({date:1}).limit(30).lean()
    ]);
    res.json({members:members.map(authorView),posts:posts.slice(0,30),reels:reels.filter(reel=>canReadContent(reel,req.user,accepted)).slice(0,30).map(reel=>reelView(reel,req.user)),events:events.map(event=>({id:String(event._id),title:event.title,date:event.date,time:event.time,location:event.location,image:event.image,scope:event.scope,category:event.category}))});
  });
  router.get('/feed/:postId/comments',config.auth,async(req,res)=>{
    const {post,legacy}=await targetPost(req.params.postId,req.user);
    if(legacy)await post.populate({path:'comments',populate:{path:'user',select:AUTHOR_FIELDS}});else await post.populate('comments.user',AUTHOR_FIELDS);
    res.json(postView(post,req.user,{legacy}).comments);
  });
  router.patch('/feed/:postId/comments/:commentId',config.auth,async(req,res)=>{
    const {post,legacy}=await targetPost(req.params.postId,req.user);validateId(req.params.commentId);
    const comment=legacy?await Comment.findOne({_id:req.params.commentId,targetId:post._id,targetType:'post'}):post.comments.id(req.params.commentId);
    if(!comment || (legacy&&!hasId(post.comments,comment._id)))fail(404,'Comment not found');
    const now=new Date();assertCommentEdit(comment,req.user,now);const text=commentText(req.body.text,legacy?300:500);
    let changed;
    if(legacy)changed=await Comment.findOneAndUpdate({_id:comment._id,user:req.user._id,targetId:post._id,targetType:'post',createdAt:commentEditDates(now)},{$set:{text,editedAt:now}},{returnDocument:'after',runValidators:true}).populate('user',AUTHOR_FIELDS);
    else {
      const updated=await CampusPost.findOneAndUpdate({_id:post._id,comments:{$elemMatch:{_id:comment._id,user:req.user._id,createdAt:commentEditDates(now)}}},{$set:{'comments.$.text':text,'comments.$.editedAt':now}},{returnDocument:'after',runValidators:true}).populate('comments.user',AUTHOR_FIELDS);
      changed=updated?.comments.id(comment._id);
    }
    if(!changed)fail(409,'This comment was removed or its five-minute edit window ended');
    res.json({success:true,comment:commentView(changed,req.user,post.user)});
  });
  router.put('/feed/:postId/comments/:commentId/like',config.auth,async(req,res)=>{
    const {post,legacy}=await targetPost(req.params.postId,req.user);validateId(req.params.commentId);if(typeof req.body.liked!=='boolean')fail(400,'Like state must be true or false');
    const liked=req.body.liked;
    const comment=legacy?await Comment.findOne({_id:req.params.commentId,targetId:post._id,targetType:'post'}):post.comments.id(req.params.commentId);
    if(!comment || (legacy&&!hasId(post.comments,comment._id)))fail(404,'Comment not found');
    const changed=legacy?await Comment.updateOne({_id:comment._id},liked?{$addToSet:{likes:req.user._id}}:{$pull:{likes:req.user._id}}):await CampusPost.updateOne({_id:post._id,'comments._id':comment._id},liked?{$addToSet:{'comments.$.likes':req.user._id}}:{$pull:{'comments.$.likes':req.user._id}});
    if(liked && changed.modifiedCount)await notifySocial({actor:req.user,recipient:comment.user,type:'like',content:post,post:post._id,comment:comment._id});
    if(!liked)await Notification.updateMany({fromUser:req.user._id,type:'like',post:post._id,comment:comment._id,dismissedAt:null},{$set:{dismissedAt:new Date()}});
    const latest=legacy?await Comment.findById(req.params.commentId).select('likes'):await CampusPost.findOne({_id:post._id,'comments._id':req.params.commentId},{'comments.$':1});
    const selected=legacy?latest:latest?.comments[0];if(!selected)fail(404,'Comment not found');
    res.json({liked,likes:(selected.likes || []).length});
  });
  router.delete('/feed/:postId/comments/:commentId',config.auth,async(req,res)=>{
    const {post,legacy}=await targetPost(req.params.postId,req.user);validateId(req.params.commentId);
    const comment=legacy?await Comment.findOne({_id:req.params.commentId,targetId:post._id,targetType:'post'}):post.comments.id(req.params.commentId);
    if(!comment || (legacy&&!hasId(post.comments,comment._id)))fail(404,'Comment not found');
    if(!sameId(comment.user,req.user)&&!sameId(post.user,req.user))fail(403,'Only the comment or post author can remove this comment');
    if(legacy){await Comment.deleteOne({_id:comment._id});await Post.updateOne({_id:post._id},{$pull:{comments:comment._id}});}else await CampusPost.updateOne({_id:post._id},{$pull:{comments:{_id:comment._id}}});res.json({success:true});
  });
}
