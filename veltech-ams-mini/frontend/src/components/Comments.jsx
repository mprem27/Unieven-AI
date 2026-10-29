import {useEffect,useRef,useState} from 'react';
import {Link} from 'react-router-dom';
import {Heart,Send,X,Pencil,Trash2,CornerDownRight,LoaderCircle} from 'lucide-react';
import {useCampus} from '../context/CampusContext';
import {useAppPreferences} from '../context/AppPreferences';
import {request} from '../lib/api';
import {canEditContent,socialAuthor,socialCount} from '../lib/community';
import {commentThreads,commentTimestamp,createReactionController} from '../lib/social-interactions';
import {entityId} from './SocialComposer';
import {Avatar,Button,Feedback,IconButton} from './UI';
import '../community-v17.css';

export default function Comments({item,kind='post',onChange,onClose,sheet=false,open=true}) {
 const {mode,data,updateDemo,isCurrentAccount,notify}=useCampus(),{preferences}=useAppPreferences();
 const [text,setText]=useState(()=>item._unsentComment?.text || ''),[editing,setEditing]=useState(''),[draft,setDraft]=useState(''),[pending,setPending]=useState({}),[reactions,setReactions]=useState({}),[reply,setReply]=useState(()=>item._unsentComment?.reply || null),[error,setError]=useState(()=>item._unsentComment?.error || ''),[notice,setNotice]=useState(''),[failedDraft,setFailedDraft]=useState(null),[now,setNow]=useState(Date.now),[viewport,setViewport]=useState(null);
 const input=useRef(null),list=useRef(null),section=useRef(null),latest=useRef(null),locks=useRef(new Set()),controllers=useRef(new Map()),lifecycle=useRef({alive:true});
 const id=entityId(item),account=`${mode}:${entityId(data.profile)}:${kind}:${id}`,base=`/${kind==='post'?'feed':'reels'}/${encodeURIComponent(id)}/comments`,comments=Array.isArray(item.comments)?item.comments:[];
 latest.current={item,onChange,mode,profile:data.profile,text,account,base,actor:`${mode}:${entityId(data.profile)}`,isCurrentAccount};
 const token=()=>latest.current.account,valid=owner=>token()===owner && latest.current.isCurrentAccount(latest.current.actor);
 useEffect(()=>{lifecycle.current.alive=true;controllers.current.forEach(controller=>controller.invalidate());controllers.current.clear();locks.current.clear();setPending({});setReactions({});return()=>{lifecycle.current.alive=false;};},[account]);
 useEffect(()=>{const unsent=item._unsentComment;if(!unsent)return;if(!latest.current.text){setText(unsent.text);latest.current.text=unsent.text;setReply(unsent.reply);}else if(latest.current.text!==unsent.text)setFailedDraft({text:unsent.text,reply:unsent.reply});setError(unsent.error);},[item._unsentComment]);
 useEffect(()=>{if(!open)return;input.current?.focus({preventScroll:true});const frame=requestAnimationFrame(()=>{if(!sheet && matchMedia('(max-width:600px)').matches)section.current?.scrollIntoView({block:'nearest',behavior:'instant'});}),timer=setInterval(()=>setNow(Date.now()),15000);return()=>{cancelAnimationFrame(frame);clearInterval(timer);};},[open,account,sheet]);
 useEffect(()=>{if(!sheet || !open || !window.visualViewport)return;const view=window.visualViewport,resize=()=>setViewport({height:view.height,bottom:Math.max(0,window.innerHeight-view.height-view.offsetTop)});resize();view.addEventListener('resize',resize);view.addEventListener('scroll',resize);return()=>{view.removeEventListener('resize',resize);view.removeEventListener('scroll',resize);};},[sheet,open]);
 const update=(transform,extra={})=>{
  const source=latest.current,next={...source.item,...extra,comments:transform(Array.isArray(source.item.comments)?source.item.comments:[])};
  latest.current.item=next;source.onChange(current=>({...current,...extra,comments:next.comments}));
  if(source.mode==='demo')updateDemo(data=>{const found=(kind==='post'?data.posts:data.reels || []).find(entry=>entityId(entry)===id);if(found)found.comments=next.comments.filter(comment=>!comment._sending);return data;});
 };
 const setWorking=(key,value)=>{if(lifecycle.current.alive)setPending(previous=>({...previous,[key]:value}));};
 const reportError=message=>{if(lifecycle.current.alive)setError(message);else notify(message,'error');};
 const scrollToNewest=()=>requestAnimationFrame(()=>{if(list.current)list.current.scrollTop=list.current.scrollHeight;});
 const like=comment=>{
  const cid=entityId(comment);if(locks.current.has(cid) || comment._sending)return;
  if(!controllers.current.has(cid))controllers.current.set(cid,createReactionController({read:()=>latest.current.item.comments.find(row=>entityId(row)===cid),patch:patch=>update(rows=>rows.map(row=>entityId(row)===cid?{...row,...patch}:row)),scope:()=>latest.current.isCurrentAccount(latest.current.actor)?token():null,send:(action,body)=>latest.current.mode==='connected'?request(`${latest.current.base}/${encodeURIComponent(cid)}/like`,{method:'PUT',body}):Promise.resolve(body),pending:value=>{if(lifecycle.current.alive)setReactions(previous=>({...previous,[cid]:!!value.like}));}}));
  setError('');controllers.current.get(cid).act('like').catch(failure=>reportError(failure.message));
 };
 const change=async(comment,action)=>{
  const cid=entityId(comment);if(locks.current.has(cid) || reactions[cid] || comment._sending)return;
  const owner=token(),original={text:comment.text,editedAt:comment.editedAt},index=latest.current.item.comments.findIndex(row=>entityId(row)===cid),value=draft.trim();
  if(action==='edit' && (!value || !canEditContent(comment,entityId(latest.current.profile)))){setError('The five-minute edit window has ended.');return;}
  locks.current.add(cid);setWorking(cid,action);setError('');setNotice('');
  if(action==='delete')update(rows=>rows.filter(row=>entityId(row)!==cid));
  else {update(rows=>rows.map(row=>entityId(row)===cid?{...row,text:value,editedAt:new Date().toISOString(),_sending:'edit'}:row));setEditing('');}
  try {
   let result;if(latest.current.mode==='connected')result=await request(`${base}/${encodeURIComponent(cid)}`,{method:action==='delete'?'DELETE':'PATCH',body:action==='edit'?{text:value}:{}});
   if(!valid(owner))return;
   if(action==='edit')update(rows=>rows.map(row=>{if(entityId(row)!==cid)return row;const {_sending,...saved}=row;return {...saved,...(result?.comment || {})};}));
   if(lifecycle.current.alive)setNotice(action==='delete'?'Comment deleted.':'Comment updated.');
  }catch(failure){
   if(!valid(owner))return;
   if(action==='delete')update(rows=>{if(rows.some(row=>entityId(row)===cid))return rows;const restored=[...rows];restored.splice(Math.min(index,restored.length),0,comment);return restored;});
   else {update(rows=>rows.map(row=>{if(entityId(row)!==cid)return row;const {_sending,...saved}=row;return {...saved,...original};}));if(lifecycle.current.alive){setEditing(cid);setDraft(value);}}
   reportError(failure.message);
  }finally{if(valid(owner)){locks.current.delete(cid);setWorking(cid,false);}}
 };
 const submit=async event=>{
  event.preventDefault();const value=latest.current.text.trim();if(!value || locks.current.has('new'))return;
  const owner=token(),profile=latest.current.profile,parent=reply,createdAt=new Date().toISOString(),cid=`pending-${crypto.randomUUID()}`;
  const optimistic={id:cid,text:value,author:{id:entityId(profile),name:profile.socialName || profile.name,username:profile.username,image:profile.image || profile.photo},createdAt,editableUntil:new Date(Date.parse(createdAt)+300000).toISOString(),canEdit:true,canDelete:true,likes:0,liked:false,parentComment:parent?.id || null,_sending:'new'};
  locks.current.add('new');setWorking('new',true);setError('');setNotice('');setFailedDraft(null);setText('');latest.current.text='';setReply(null);update(rows=>[...rows,optimistic],{_unsentComment:null});scrollToNewest();
  try {
   let comment;
   if(mode==='connected'){const result=await request(base,{method:'POST',body:{text:value,...(parent?{parentComment:parent.id}:{})}});comment=result?.comment || result;if(!entityId(comment) || typeof comment.text!=='string')throw new Error('The server did not confirm your comment. Please try again.');}
   else {const {_sending,...saved}=optimistic;comment={...saved,id:crypto.randomUUID()};}
   if(!valid(owner))return;
   update(rows=>rows.map(row=>entityId(row)===cid?comment:row));if(lifecycle.current.alive){setNow(Date.now());setNotice(parent?'Reply posted.':'Comment posted.');}
  }catch(failure){
   if(!valid(owner))return;
   update(rows=>rows.filter(row=>entityId(row)!==cid),{_unsentComment:{text:value,reply:parent,error:failure.message}});
   if(lifecycle.current.alive){if(!latest.current.text){setText(value);latest.current.text=value;setReply(parent);}else setFailedDraft({text:value,reply:parent});}
   reportError(failure.message);
  }finally{if(valid(owner)){locks.current.delete('new');setWorking('new',false);}}
 };
 const beginReply=comment=>{const author=socialAuthor(comment);setReply({id:entityId(comment),name:author.username?`@${author.username}`:author.name || 'Campus member'});input.current?.focus({preventScroll:true});};
 return <section ref={section} hidden={!open} className={`v15-comments v17-comments ${sheet?'v15-comment-sheet':''}`} style={sheet && viewport?{'--v17-visible-height':`${viewport.height}px`,'--v17-keyboard-bottom':`${viewport.bottom}px`}:undefined} aria-label={`${kind==='post'?'Post':'Reel'} comments`} onKeyDown={event=>{if(['ArrowDown','ArrowUp','PageDown','PageUp','Home','End'].includes(event.key))event.stopPropagation();if(event.key==='Escape' && onClose){event.preventDefault();event.stopPropagation();onClose();}}}>
  <div className="v15-comments-heading"><div><h2>Comments <span>{comments.length}</span></h2><p>Keep the conversation going.</p></div>{onClose?<IconButton label="Close comments" onClick={onClose}><X size={19}/></IconButton>:null}</div>
  <div ref={list} className="v15-comments-list" tabIndex={0} aria-label="Comment conversation">
   {comments.length?commentThreads(comments).map(({comment,depth})=>{
    const author=socialAuthor(comment),cid=entityId(comment),owned=entityId(author)===entityId(data.profile),editable=canEditContent(comment,entityId(data.profile),now),stamp=commentTimestamp(comment.createdAt,now),working=!!pending[cid] || !!reactions[cid] || !!comment._sending,profilePath=author.username || entityId(author);
    return <div className={`v15-comment ${depth?'v17-comment-reply':''}`} key={cid} data-comment-id={cid} aria-busy={!!comment._sending}>
     {profilePath?<Link className="v17-comment-avatar" to={`/members/${encodeURIComponent(profilePath)}`} aria-label={`View ${author.name || 'member'} profile`}><Avatar name={author.name} src={author.image} size="small"/></Link>:<Avatar name={author.name} src={author.image} size="small"/>}
     <div className="v15-comment-copy"><div className="v15-comment-byline">{profilePath?<Link to={`/members/${encodeURIComponent(profilePath)}`}><strong>{author.name || 'Campus member'}</strong></Link>:<strong>{author.name || 'Campus member'}</strong>}{stamp?<time dateTime={comment.createdAt} title={new Date(comment.createdAt).toLocaleString()}>{stamp}</time>:null}{comment.editedAt?<small>edited</small>:null}</div>{author.username?<span className="v17-comment-username">@{author.username}</span>:null}
      {editing===cid?<form onSubmit={event=>{event.preventDefault();change(comment,'edit');}}><textarea aria-label="Edit comment" autoFocus required maxLength={300} value={draft} onChange={event=>setDraft(event.target.value)} rows={2}/><div className="v15-comment-edit-actions"><Button type="button" variant="secondary" onClick={()=>setEditing('')}>Cancel</Button><Button type="submit" busy={pending[cid]==='edit'} disabled={!editable || !draft.trim()}>Save</Button></div>{!editable?<small>The five-minute edit window has ended.</small>:null}</form>:<p>{comment.text}</p>}
      {comment._sending?<span className="v17-comment-sending" role="status"><LoaderCircle className="spin" size={11}/>{comment._sending==='edit'?'Saving…':'Sending…'}</span>:<div className="v15-comment-tools"><button disabled={working} aria-pressed={!!comment.liked} aria-label={comment.liked?'Unlike comment':'Like comment'} className={comment.liked?'active':''} onClick={()=>like(comment)}><Heart size={13} fill={comment.liked?'currentColor':'none'}/>{comment.liked?'Liked':'Like'}{preferences.showLikeCounts===false || !socialCount(comment.likes)?'':` · ${socialCount(comment.likes)}`}</button><button disabled={working} onClick={()=>beginReply(comment)}><CornerDownRight size={13}/>Reply</button>{owned && editable?<button disabled={working} onClick={()=>{setEditing(cid);setDraft(comment.text);}}><Pencil size={12}/>Edit</button>:null}{owned || comment.canDelete?<button disabled={working} onClick={()=>change(comment,'delete')}><Trash2 size={12}/>Delete</button>:null}</div>}
     </div>
    </div>;
   }):<div className="v15-comments-empty"><MessagePlaceholder/><strong>Start the conversation</strong><p>Add a question, an idea, or a little encouragement.</p></div>}
  </div>
  <div className="v17-comment-feedback"><Feedback error={error}/><span className="v17-live-status" role="status">{notice}</span>{failedDraft?<button className="v17-restore-draft" onClick={()=>{setText(failedDraft.text);setReply(failedDraft.reply);setFailedDraft(null);input.current?.focus();}}>Restore unsent comment</button>:null}</div>
  <form className="v15-comment-form" onSubmit={submit}>
   {reply?<div className="v17-reply-context"><span>Replying to <strong>{reply.name}</strong></span><IconButton type="button" label="Cancel reply" onClick={()=>setReply(null)}><X size={14}/></IconButton></div>:null}
   <Avatar size="small" name={data.profile.socialName || data.profile.name} src={data.profile.image || data.profile.photo}/><div className="v17-comment-input"><input ref={input} aria-label={`Your ${kind} comment`} autoComplete="off" required maxLength={300} value={text} onChange={event=>{setText(event.target.value);latest.current.text=event.target.value;}} placeholder={reply?'Add a reply…':'Add a comment…'}/></div><IconButton label={pending.new?'Sending comment':'Post comment'} type="submit" disabled={!!pending.new || !text.trim()}>{pending.new?<LoaderCircle className="spin" size={18}/>:<Send size={18}/>}</IconButton>
  </form>
 </section>;
}
function MessagePlaceholder(){return <span className="v17-comment-empty-mark" aria-hidden="true"><CornerDownRight size={22}/></span>;}
