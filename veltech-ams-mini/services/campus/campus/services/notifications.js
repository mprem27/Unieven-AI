import {sameDepartment,departmentQuery} from '../../../../shared/publishing-directory.mjs';
import {duplicateKey} from '../security.js';
import {createHash} from 'node:crypto';
import Notification from '../../models/Notification.js';
import User from '../../models/User.js';
import Post from '../../models/Post.js';
import Reel from '../../models/Reel.js';
import Registration from '../../models/EventRegistration.js';
import Event from '../../models/Event.js';
import Comment from '../../models/Comment.js';
import Follow from '../../models/Follow.js';
import {CampusPost,Notice} from '../models.js';
import {NotificationState} from '../models/notification-state.js';
import {AppFeedback} from '../models/app-feedback.js';
import {AUTHOR_FIELDS,acceptedAuthors,authorView,canReadContent,sameId} from './community-policy.js';
import {eventStartsAt} from './event-time.js';

const socialTypes=new Set(['like','comment','reply','mention','follow','follow_request','follow_accepted']);
const knownTypes=new Set([...socialTypes,'event_registration','event_update','event_reminder','event_attendance','campus_notice','app_feedback_reply','moderation','campus_message','exam_update','placement_update']);
const id=value=>String(value?._id ?? (typeof value?.id==='string'?value.id:value) ?? '');
const blockedIds=user=>[...(user?.blockedUsers || []),...(user?.blockedBy || [])].map(id);
async function socialParticipantsAllowed(left,right){
  const users=await User.find({_id:{$in:[id(left),id(right)]}}).select('isActive blockedUsers blockedBy').lean();
  const from=users.find(user=>sameId(user,left)),to=users.find(user=>sameId(user,right));
  return !!from && !!to && from.isActive!==false && to.isActive!==false && !blockedIds(from).includes(id(to)) && !blockedIds(to).includes(id(from));
}
const safeLink=value=>typeof value==='string' && /^\/(?!\/)[a-zA-Z0-9_/?=&%#.-]*$/.test(value)?value:'/notifications';

/** Internal server hook: the caller must have authorized the source action. */
export async function createNotification({toUser,fromUser,type,eventKey,post,reel,event,notice,follow,comment,title,message,link,category,createdAt}) {
  if(!knownTypes.has(type) || !toUser || (fromUser && sameId(toUser,fromUser)))return null;
  const recipient=await User.exists({_id:id(toUser),isActive:{$ne:false}});if(!recipient)return null;
  if(socialTypes.has(type) && (!fromUser || !await socialParticipantsAllowed(fromUser,toUser)))return null;
  const key=eventKey || [type,id(fromUser),id(post),id(reel),id(event),id(notice),id(follow),id(comment)].join(':');
  const doc={toUser:id(toUser),type,eventKey:key,isRead:false,dismissedAt:null,createdAt:createdAt || new Date(),updatedAt:createdAt || new Date()};
  for(const [name,value] of Object.entries({fromUser,post,reel,event,notice,follow,comment}))if(value)doc[name]=id(value);
  if(!socialTypes.has(type)){doc.title=String(title || '').slice(0,180);doc.message=String(message || '').slice(0,500);doc.link=safeLink(link);doc.category=category || 'system';}
  try{return await Notification.findOneAndUpdate({toUser:doc.toUser,eventKey:key},{$setOnInsert:doc},{upsert:true,returnDocument:'after',timestamps:false,runValidators:true});}
  catch(error){if(!duplicateKey(error))throw error;return Notification.findOne({toUser:doc.toUser,eventKey:key});}
}

export async function notifySocial({actor,recipient,type,content,post,reel,comment,follow,eventKey}) {
  const target=recipient?._id?recipient:await User.findById(id(recipient)).select(AUTHOR_FIELDS);
  if(!target || sameId(actor,target))return null;
  if(content && (content.isArchived || !canReadContent(content,target,await acceptedAuthors(target)) || !await socialParticipantsAllowed(content.user ?? content.author,target)))return null;
  return createNotification({toUser:target,fromUser:actor,type,post,reel,comment,follow,eventKey});
}

const mentionedNames=text=>[...String(text || '').matchAll(/(?:^|\s)@([a-z0-9_.]{3,30})\b/gi)].map(match=>match[1].toLowerCase());
export async function notifyMentions({actor,content,post,reel,comment,eventKey,mentionText}) {
  const text=mentionText ?? [content?.text,content?.caption,content?.overlayText].filter(Boolean).join(' ');
  const names=[...new Set([...(content?.mentions || []),...mentionedNames(text)])].slice(0,20);const tags=(content?.tags || []).map(id).filter(value=>/^[a-f0-9]{24}$/i.test(value));
  if(!names.length && !tags.length)return [];
  const recipients=await User.find({isActive:{$ne:false},$or:[{username:{$in:names}},{_id:{$in:tags}}]}).select(AUTHOR_FIELDS);
  return Promise.all(recipients.map(recipient=>notifySocial({actor,recipient,type:'mention',content,post,reel,comment,eventKey:`${eventKey || `mention:${id(post || reel)}`}:${recipient.id}`})));
}

export async function notifyComment({actor,content,post,reel,comment,parent}) {
  const jobs=[notifySocial({actor,recipient:content.user,type:'comment',content,post,reel,comment:comment._id,eventKey:`comment:${id(comment)}`})];
  if(parent?.user && !sameId(parent.user,content.user))jobs.push(notifySocial({actor,recipient:parent.user,type:'reply',content,post,reel,comment:comment._id,eventKey:`reply:${id(comment)}`}));
  const usernames=mentionedNames(comment.text);
  jobs.push(notifyMentions({actor,content:{...content.toObject?.() || content,mentions:usernames,tags:[]},post,reel,comment:comment._id,mentionText:comment.text,eventKey:`comment-mention:${id(comment)}`}));
  return Promise.all(jobs);
}

async function changedSinceLastSeen(owner,key,value){
  let previous;
  try{previous=await NotificationState.findOneAndUpdate({owner,key},{$set:{value}},{upsert:true,returnDocument:'before'}).lean();}
  catch(error){if(!duplicateKey(error))throw error;previous=await NotificationState.findOneAndUpdate({owner,key},{$set:{value}},{returnDocument:'before'}).lean();}
  return !!previous && previous.value!==value;
}

/** Materialize only records this account can already access; retries keep read/dismissed state. */
export async function deliverFeedbackNotifications(owner){
 const rows=await AppFeedback.find({owner,notificationPending:true}).sort({updatedAt:1}).limit(20);
 for(const row of rows){
  const key=row.notificationEventKey;if(!key)continue;
  await createNotification({toUser:row.owner,fromUser:row.respondedBy,type:'app_feedback_reply',eventKey:key,title:'App feedback update',message:row.reply?'An administrator replied to your app feedback.':'Your app feedback status was updated.',link:'/settings/feedback',category:'system'});
  await AppFeedback.updateOne({_id:row._id,notificationEventKey:key,notificationPending:true},{$set:{notificationPending:false}},{timestamps:false});
 }
}
export async function syncRelevantNotifications(user,{now=new Date()}={}) {
  await deliverFeedbackNotifications(user._id);
  const since=new Date(now.getTime()-30*86400000);
  const [tickets,notices]=await Promise.all([
    Registration.find({user:user._id}).sort({updatedAt:-1}).limit(100).populate('event'),
    Notice.find({createdAt:{$gte:since},$or:[{department:''},{department:departmentQuery(user.department)}]}).sort({createdAt:-1}).limit(50).lean()
  ]);
  const tasks=notices.map(notice=>createNotification({toUser:user,type:'campus_notice',notice:notice._id,fromUser:notice.createdBy,eventKey:`notice:${notice._id}${notice.updatedAt && +notice.updatedAt!==+notice.createdAt?':'+new Date(notice.updatedAt).toISOString():''}`,title:notice.title,message:'An authorized campus notice is available.',link:`/notifications?notice=${notice._id}`,category:'notices',createdAt:notice.createdAt}));
  for(const ticket of tickets){
    const event=ticket.event;if(!event)continue;
    const base={toUser:user,event:event._id,category:'events',link:`/events/${event._id}`};
    if(ticket.updatedAt>=since){
      const titles={registered:'Registration confirmed',attended:'Event check-in confirmed',cancelled:'Registration cancelled',payment_pending:'Registration awaits payment'};
      tasks.push(createNotification({...base,type:ticket.status==='attended'?'event_attendance':'event_registration',eventKey:`registration:${ticket.id}:${ticket.status}`,title:titles[ticket.status],message:`${event.title}. Open your event for details.`,createdAt:ticket.updatedAt}));
    }
    if(['registered','attended','payment_pending'].includes(ticket.status)){
      const fingerprint=createHash('sha256').update(JSON.stringify([event.title,event.date,event.time,event.location,event.status,event.archivedAt,event.startsAt])).digest('hex').slice(0,24);
      if(await changedSinceLastSeen(user._id,`event:${event._id}`,fingerprint) || event.status==='cancelled')tasks.push(createNotification({...base,type:'event_update',eventKey:`event:${event._id}:${fingerprint}`,title:event.status==='cancelled'?'Your event was cancelled':'Your event has changed',message:`${event.title}. Check the latest date, venue and status.`}));
      let start;try{start=event.startsAt || eventStartsAt(event);}catch{continue;}
      if(ticket.status==='registered' && event.status==='upcoming' && !event.archivedAt && start>now && start.getTime()-now.getTime()<=86400000)tasks.push(createNotification({...base,type:'event_reminder',eventKey:`reminder:${event._id}:${start.toISOString()}`,title:'Your event starts soon',message:`${event.title}. Open your event and ticket before you go.`}));
    }
  }
  await Promise.all(tasks);
}

export async function notificationView(row,user,accepted) {
  let link=safeLink(row.link),category=row.category || 'community',message=row.message || '',title=row.title || 'Campus update';
  if(row.notice){const notice=await Notice.findById(row.notice).select('title department').lean();if(!notice || (notice.department && !sameDepartment(notice.department,user.department)))return null;title=notice.title;}
  if(socialTypes.has(row.type) && (!row.fromUser || !await socialParticipantsAllowed(row.fromUser,user)))return null;
  if(row.event){
    const [ticket,event]=await Promise.all([Registration.findOne({user:user._id,event:row.event}).select('status').lean(),Event.findById(row.event).select('status archivedAt date time startsAt').lean()]);
    if(!ticket || !event)return null;
    if(row.type==='event_reminder'){
      let start;try{start=event.startsAt || eventStartsAt(event);}catch{return null;}
      const now=new Date();
      if(ticket.status!=='registered' || event.status!=='upcoming' || event.archivedAt || start<=now || start.getTime()-now.getTime()>86400000 || row.eventKey!==`reminder:${event._id}:${start.toISOString()}`)return null;
    }
  }
  if(row.follow){
    const follow=await Follow.findById(row.follow).lean();
    if(!follow || (row.type==='follow_request' && follow.status!=='requested') || (['follow','follow_accepted'].includes(row.type) && follow.status!=='accepted'))return null;
  }
  if(row.post || row.reel){
    let content=row.reel?await Reel.findById(row.reel).populate('user',AUTHOR_FIELDS):await CampusPost.findById(row.post).populate('user',AUTHOR_FIELDS);
    if(!content && row.post)content=await Post.findById(row.post).populate('user',AUTHOR_FIELDS);
    if(!content || content.isArchived || !canReadContent(content,user,accepted) || !await socialParticipantsAllowed(content.user,user))return null;
    if(row.comment){
      const embedded=content.comments?.find(value=>value?.text && sameId(value,row.comment));
      if(!embedded){
        const attached=(content.comments || []).some(value=>sameId(value,row.comment));
        if(!attached || !await Comment.exists({_id:row.comment,targetId:content._id,targetType:row.reel?'reel':'post'}))return null;
      }
    }
    link=row.reel?`/reels/${row.reel}/comments`:`/community/posts/${row.post}`;
    if(row.comment)link+=`?comment=${row.comment}`;
  }
  if(socialTypes.has(row.type)){
    const actor=row.fromUser?.isActive===false?null:row.fromUser;const name=actor?.name || actor?.username || 'A campus member';
    const action={like:'liked your content',comment:'commented on your content',reply:'replied to your comment',mention:'mentioned you',follow:'started following you',follow_request:'requested to follow you',follow_accepted:'accepted your follow request'}[row.type];
    title=`${name} ${action}`;message=row.type==='follow_request'?'Review this request in Connections.':row.type==='mention'?'Open the conversation to see the mention.':'Open to view the update.';
    if(!row.post && !row.reel)link=row.type==='follow_request'?'/connections':actor?.username?`/members/${encodeURIComponent(actor.username)}`:'/connections';
    category='community';
  }
  if(row.event && !row.post && !row.reel)link=`/events/${row.event}`;
  return {id:String(row._id),actor:row.fromUser?authorView(row.fromUser):null,type:row.type,title,message,link,category,isRead:!!row.isRead,read:!!row.isRead,createdAt:row.createdAt,postId:row.post?String(row.post):null,reelId:row.reel?String(row.reel):null,eventId:row.event?String(row.event):null,noticeId:row.notice?String(row.notice):null,commentId:row.comment?String(row.comment):null,requestId:row.follow?String(row.follow):null,source:'social'};
}

export async function listInbox(user){
  await syncRelevantNotifications(user);
  const [rows,accepted]=await Promise.all([Notification.find({toUser:user._id,dismissedAt:null}).sort({createdAt:-1}).limit(150).populate('fromUser',AUTHOR_FIELDS).lean(),acceptedAuthors(user)]);
  return (await Promise.all(rows.map(row=>notificationView(row,user,accepted)))).filter(Boolean);
}
