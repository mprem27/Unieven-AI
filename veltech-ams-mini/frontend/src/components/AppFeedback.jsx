import {useEffect,useId,useRef,useState} from 'react';
import {MessageSquare,RefreshCw,Send} from 'lucide-react';
import {useCampus} from '../context/CampusContext';
import {request} from '../lib/api';
import {Button} from './UI';
import {FEEDBACK_CATEGORIES,FEEDBACK_STATUSES,feedbackId,feedbackItems,feedbackPayload} from './app-feedback';
import './app-feedback.css';

const emptyDraft=()=>({category:'idea',rating:'',subject:'',message:''});
const demoFeedback=new Map();
const dateLabel=value=>{const date=new Date(value);return Number.isNaN(date.valueOf())?'':date.toLocaleDateString('en-IN',{day:'numeric',month:'short',year:'numeric'});};
function FeedbackMessage({error,success}){return error?<p className="app-feedback-message is-error" role="alert">{error}</p>:success?<p className="app-feedback-message is-success" role="status">{success}</p>:null;}

export default function AppFeedback({mode='student',onUpdated}){
 const {data,mode:connection}=useCampus();
 const owner=`${connection}:${data.profile.id || ''}`;
 return <FeedbackWorkspace key={`${owner}:${mode}`} owner={owner} connected={connection==='connected'} manage={mode==='manage'} onUpdated={onUpdated}/>;
}

function FeedbackWorkspace({owner,connected,manage,onUpdated}){
 const id=useId(),active=useRef(true),revision=useRef(0),submission=useRef(null);
 const [items,setItems]=useState(()=>connected?[]:(demoFeedback.get(owner) || [])),[draft,setDraft]=useState(emptyDraft),[status,setStatus]=useState('all'),[loading,setLoading]=useState(connected),[loadError,setLoadError]=useState(''),[formError,setFormError]=useState(''),[success,setSuccess]=useState(''),[busy,setBusy]=useState(false),[reload,setReload]=useState(0);
 useEffect(()=>{active.current=true;return()=>{active.current=false;};},[]);
 useEffect(()=>{
  if(!connected)return;
  const abort=new AbortController(),version=++revision.current;
  setLoading(true);setLoadError('');
  const path=manage?`/app-feedback/manage${status==='all'?'':`?status=${encodeURIComponent(status)}`}`:'/app-feedback';
  request(path,{signal:abort.signal}).then(value=>{if(!abort.signal.aborted && revision.current===version)setItems(feedbackItems(value));}).catch(error=>{if(!abort.signal.aborted && revision.current===version)setLoadError(error.message);}).finally(()=>{if(!abort.signal.aborted && revision.current===version)setLoading(false);});
  return()=>abort.abort();
 },[connected,manage,status,reload]);
 const updateDraft=(key,value)=>{setDraft(previous=>({...previous,[key]:value}));setSuccess('');};
 const saveItems=next=>{setItems(previous=>{const result=typeof next==='function'?next(previous):next;if(!connected)demoFeedback.set(owner,result);return result;});};
 const submit=async event=>{
  event.preventDefault();setFormError('');setSuccess('');
  let body;try{body=feedbackPayload(draft);const key=JSON.stringify(body);if(submission.current?.key!==key)submission.current={key,id:crypto.randomUUID()};body={...body,clientRequestId:submission.current.id};}catch(error){setFormError(error.message);return;}
  setBusy(true);
  try{
   const response=connected?await request('/app-feedback',{method:'POST',body}):{feedback:{...body,id:`demo-feedback-${crypto.randomUUID()}`,status:'new',createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()}};
   if(!active.current)return;
   const item=response.feedback || response;
   if(!feedbackId(item))throw new Error('Your submission could not be confirmed. Please retry.');
   revision.current++;setLoading(false);
   saveItems(previous=>[item,...previous.filter(old=>feedbackId(old)!==feedbackId(item))]);submission.current=null;setDraft(emptyDraft());setSuccess(connected?'Feedback sent. Follow its progress below.':'Feedback saved in this preview.');
   onUpdated?.(item);
  }catch(error){if(active.current)setFormError(error.message);}
  finally{if(active.current)setBusy(false);}
 };
 const onSaved=item=>{saveItems(previous=>previous.map(old=>feedbackId(old)===feedbackId(item)?item:old));onUpdated?.(item);};
 const availableItems=manage?items.filter(item=>!item.archivedAt):items;
 const visibleItems=manage && status!=='all'?availableItems.filter(item=>item.status===status):availableItems;
 return <section className={`app-feedback ${manage?'app-feedback-manage':''}`} aria-labelledby={`${id}-title`}>
  <header className="app-feedback-heading"><div><span className="app-feedback-eyebrow"><MessageSquare size={15}/>APP FEEDBACK</span><h2 id={`${id}-title`}>{manage?'Listen. Improve. Follow through.':'Help shape your campus app.'}</h2><p>{manage?'Review student suggestions and share a clear response.':'Tell us what could work better. Track your suggestions and read replies here.'}</p></div></header>
  {!manage?<form className="panel app-feedback-form" onSubmit={submit} aria-label="Send app feedback">
   <div className="app-feedback-fields"><label htmlFor={`${id}-category`}>Category<select id={`${id}-category`} value={draft.category} onChange={event=>updateDraft('category',event.target.value)}>{Object.entries(FEEDBACK_CATEGORIES).map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label><label htmlFor={`${id}-rating`}>App rating <span>(optional)</span><select id={`${id}-rating`} value={draft.rating} onChange={event=>updateDraft('rating',event.target.value)}><option value="">Choose a rating</option>{[1,2,3,4,5].map(value=><option key={value} value={value}>{value} / 5{value===1?' · Needs work':value===5?' · Excellent':''}</option>)}</select></label></div>
   <label htmlFor={`${id}-subject`}>Subject<input id={`${id}-subject`} required maxLength={120} value={draft.subject} onChange={event=>updateDraft('subject',event.target.value)} placeholder="What would you like us to improve?"/></label>
   <label htmlFor={`${id}-message`}>Your feedback<textarea id={`${id}-message`} required maxLength={3000} rows={5} value={draft.message} onChange={event=>updateDraft('message',event.target.value)} placeholder="Describe the issue or idea and how it would help." aria-describedby={`${id}-privacy ${id}-count`}/></label>
   <div className="app-feedback-form-note"><p id={`${id}-privacy`}>Linked to your account for follow-up. Leave out passwords and private student information.</p><span id={`${id}-count`}>{draft.message.length.toLocaleString('en-IN')} / 3,000</span></div>
   <FeedbackMessage error={formError} success={success}/><Button type="submit" busy={busy}><Send size={15}/>{busy?'Sending…':'Send feedback'}</Button>
  </form>:null}
  <div className="app-feedback-list-heading"><div><h3>{manage?'Feedback inbox':'Your feedback'}</h3><p>{manage?'Updates and replies are visible to the student who sent the feedback.':'Your submissions and the latest response from the app team.'}</p></div><div className="app-feedback-list-tools">{manage?<label htmlFor={`${id}-status`}>Status<select id={`${id}-status`} value={status} onChange={event=>setStatus(event.target.value)}><option value="all">All statuses</option>{Object.entries(FEEDBACK_STATUSES).map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label>:null}{connected?<Button variant="secondary" busy={loading} onClick={()=>setReload(value=>value+1)}><RefreshCw size={14}/>Refresh</Button>:null}</div></div>
  <FeedbackMessage error={loadError}/>{loading?<p className="app-feedback-loading" role="status">Loading feedback…</p>:null}
  {!loading && !loadError && !visibleItems.length?<div className="panel app-feedback-empty"><MessageSquare size={23}/><h4>{manage?'No feedback in this view':'Your ideas can make a difference.'}</h4><p>{manage?'Choose another status or return when new feedback arrives.':'Send your first suggestion above. You can follow its progress here.'}</p></div>:null}
  <div className="app-feedback-list">{visibleItems.map(item=><FeedbackCard key={feedbackId(item)} item={item} manage={manage} connected={connected} onSaved={onSaved}/>)}</div>
 </section>;
}

function FeedbackCard({item,manage,connected,onSaved}){
 const id=useId(),active=useRef(true),[status,setStatus]=useState(item.status || 'new'),[reply,setReply]=useState(item.reply || ''),[busy,setBusy]=useState(false),[error,setError]=useState(''),[success,setSuccess]=useState('');
 useEffect(()=>{active.current=true;return()=>{active.current=false;};},[]);
 useEffect(()=>{setStatus(item.status || 'new');setReply(item.reply || '');},[item.status,item.reply]);
 const archive=async()=>{setBusy(true);setError('');try{const result=connected?await request(`/app-feedback/${encodeURIComponent(feedbackId(item))}`,{method:'DELETE',body:{}}):{feedback:{...item,status:'closed',archivedAt:new Date().toISOString()}};if(active.current)onSaved(result.feedback);}catch(error){if(active.current)setError(error.message);}finally{if(active.current)setBusy(false);}};
 const save=async event=>{
  event.preventDefault();setError('');setSuccess('');setBusy(true);
  try{
   const body={status,reply:reply.trim()};
   if(body.reply.length>2000)throw new Error('Keep your response within 2,000 characters.');
   const response=connected?await request(`/app-feedback/${encodeURIComponent(feedbackId(item))}`,{method:'PATCH',body}):{feedback:{...item,...body,updatedAt:new Date().toISOString()}};
   if(!active.current)return;
   const updated=response.feedback || response;
   if(!feedbackId(updated))throw new Error('The update could not be confirmed. Please retry.');
   onSaved(updated);setSuccess('Feedback updated.');
  }catch(error){if(active.current)setError(error.message);}
  finally{if(active.current)setBusy(false);}
 };
 return <article className="panel app-feedback-card"><header><div><span className="app-feedback-category">{FEEDBACK_CATEGORIES[item.category] || 'App feedback'}{item.rating?` · ${item.rating}/5`:''}</span><h4>{item.subject}</h4><time dateTime={item.createdAt}>{dateLabel(item.createdAt)}</time></div><span className={`app-feedback-status status-${Object.hasOwn(FEEDBACK_STATUSES,item.status)?item.status:'new'}`}>{FEEDBACK_STATUSES[item.status] || 'Received'}</span></header><p className="app-feedback-body">{item.message}</p>
  {item.reply?<div className="app-feedback-reply"><strong>App team response</strong><p>{item.reply}</p><small>Updated {dateLabel(item.updatedAt)}</small></div>:!manage?<p className="app-feedback-awaiting">We’ll show the app team’s response here.</p>:null}
  {manage?<form className="app-feedback-review" onSubmit={save}><label htmlFor={`${id}-review-status`}>Status<select id={`${id}-review-status`} value={status} onChange={event=>{setStatus(event.target.value);setSuccess('');}}>{Object.entries(FEEDBACK_STATUSES).map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label><label htmlFor={`${id}-reply`}>Response to student<textarea id={`${id}-reply`} rows={3} maxLength={2000} value={reply} onChange={event=>{setReply(event.target.value);setSuccess('');}} placeholder="Share an update or explain the next step."/></label><FeedbackMessage error={error} success={success}/><div className="dialog-actions"><Button type="submit" variant="secondary" busy={busy}>Save response</Button><Button type="button" variant="ghost" disabled={busy} onClick={archive}>Archive issue</Button></div></form>:null}
 </article>;
}
