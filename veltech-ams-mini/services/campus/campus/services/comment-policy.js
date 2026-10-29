import {fail} from '../security.js';
import {authorView,hasId,sameId} from './community-policy.js';

export const COMMENT_EDIT_WINDOW_MS=5*60*1000;
export function canEditComment(comment,user,now=new Date()) {
  const stamp=comment.createdAt?new Date(comment.createdAt).getTime():NaN,clock=new Date(now).getTime();
  return sameId(comment.user,user) && Number.isFinite(stamp) && stamp<=clock && clock<stamp+COMMENT_EDIT_WINDOW_MS;
}
export function commentView(comment,user,contentAuthor,now=new Date()) {
  const stamp=comment.createdAt?new Date(comment.createdAt).getTime():NaN;
  return {id:String(comment._id),text:comment.text,author:authorView(comment.user),createdAt:comment.createdAt || null,editedAt:comment.editedAt || null,editableUntil:Number.isFinite(stamp)?new Date(stamp+COMMENT_EDIT_WINDOW_MS):null,canEdit:canEditComment(comment,user,now),canDelete:sameId(comment.user,user)||sameId(contentAuthor,user),likes:(comment.likes || []).length,liked:hasId(comment.likes,user._id),parentComment:comment.parentComment?String(comment.parentComment):null};
}
export function commentText(value,max=300) {
  if(typeof value!=='string'||!value.trim()||value.trim().length>max)fail(400,`Write a comment up to ${max} characters`);
  return value.trim();
}
export function assertCommentEdit(comment,user,now=new Date()) {
  if(!sameId(comment.user,user))fail(403,'Only the comment author can edit this comment');
  if(!canEditComment(comment,user,now))fail(409,'Comments can be edited only during the first five minutes');
}
export function commentEditDates(now=new Date()) {return {$gt:new Date(now.getTime()-COMMENT_EDIT_WINDOW_MS),$lte:now};}
