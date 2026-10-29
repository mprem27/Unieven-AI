import {useEffect,useState} from 'react';
import {Link,useNavigate} from 'react-router-dom';
import {ArrowLeft,Camera,Link2,LockKeyhole,Plus,Save,ShieldCheck,Trash2} from 'lucide-react';
import {useCampus} from '../context/CampusContext';
import {request} from '../lib/api';
import {applyDemoSocialProfile,socialProfileBody,socialProfileDraft} from '../lib/social-profile';
import {Avatar,Button,Feedback,Field,PageHeader} from './UI';
import {uploadSocialFile,validateFile} from './SocialComposer';
import '../profile-v14.css';

export default function SocialProfileEditor({onClose,onSaved}={}) {
 const {mode,data,updateDemo,refresh,notify}=useCampus(),navigate=useNavigate();
 const [draft,setDraft]=useState(()=>socialProfileDraft(data.profile,mode==='demo')),[file,setFile]=useState(null),[preview,setPreview]=useState(''),[busy,setBusy]=useState(false),[loading,setLoading]=useState(mode==='connected'),[loaded,setLoaded]=useState(mode==='demo'),[error,setError]=useState(''),[availability,setAvailability]=useState('');
 const back=`/members/${encodeURIComponent(data.profile.username || data.profile.id || 'me')}`;
 useEffect(()=>{
  if(mode!=='connected')return;
  const abort=new AbortController();setLoading(true);setLoaded(false);
  request('/members/me',{signal:abort.signal}).then(result=>{if(!abort.signal.aborted){setDraft(socialProfileDraft(result.user || result));setLoaded(true);}}).catch(err=>{if(!abort.signal.aborted)setError(err.message);}).finally(()=>{if(!abort.signal.aborted)setLoading(false);});
  return()=>abort.abort();
 },[mode,data.profile.id]);
 useEffect(()=>{if(!file){setPreview('');return;}const url=URL.createObjectURL(file);setPreview(url);return()=>URL.revokeObjectURL(url);},[file]);
 const change=(key,value)=>setDraft(current=>({...current,[key]:value}));
 const checkUsername=async()=>{if(mode!=='connected'||!draft.username.trim())return;try {const result=await request(`/members/check-username?username=${encodeURIComponent(draft.username.trim())}`);setAvailability(result.available?'Username available':'That username is already taken');}catch{setAvailability('Your username will be checked when you save.');}};
 const setLink=(index,key,value)=>setDraft(current=>({...current,socialLinks:current.socialLinks.map((link,i)=>i===index?{...link,[key]:value}:link)}));
 const save=async event=>{
  event.preventDefault();if(busy||loading||!loaded)return;setBusy(true);setError('');
  try {
   const body=socialProfileBody(draft),upload=file?await uploadSocialFile(file,mode):null;if(upload)body.image=upload.url;
   if(mode==='connected'){await request('/members/me',{method:'PATCH',body});await refresh();}
   else updateDemo(state=>applyDemoSocialProfile(state,body));
   notify('Your social profile is updated');onSaved?.();if(onClose)onClose();else navigate(`/members/${encodeURIComponent(body.username)}`);
  }catch(err){setError(err.message);}finally{setBusy(false);}
 };
 return <div className="profile-v14 social-editor-page">{!onClose?<PageHeader title="Edit social profile" description="Make room for your work, interests and the person behind them."><Link className="social-inline-link" to={back}><ArrowLeft size={16}/>Your profile</Link></PageHeader>:null}
  <div className="social-editor-layout"><form className="panel social-editor-form" onSubmit={save}>
   <div className="social-editor-photo"><Avatar name={draft.name} src={preview || draft.image} size="xl"/><div><h2>Your campus presence</h2><p className="muted">A photo people will recognize.</p><label className="button secondary social-editor-upload"><Camera size={16}/>{file?'Change selected photo':'Change photo'}<input aria-label="Social profile photo" type="file" accept="image/jpeg,image/png,image/webp,image/gif" disabled={busy||loading||!loaded} onChange={event=>{const selected=event.target.files?.[0];if(!selected)return;try {if(validateFile(selected)!=='image')throw new Error('Choose an image for your profile.');setFile(selected);setError('');}catch(err){setError(err.message);event.target.value='';}}}/></label><small>{file?.name || 'JPEG, PNG, WebP or GIF · up to 8 MB'}</small>{draft.image||file?<button className="text-button" type="button" disabled={busy||loading||!loaded} onClick={()=>{setFile(null);change('image','');}}>Remove photo</button>:null}</div></div>
   <fieldset disabled={busy||loading||!loaded}><legend className="sr-only">Social profile details</legend><div className="form-grid"><Field label="Display name" required maxLength={100} autoComplete="nickname" value={draft.name} onChange={event=>change('name',event.target.value)}/><Field label="Username" required minLength={3} maxLength={30} pattern="[A-Za-z0-9_.]+" title="Letters, numbers, underscores and dots" autoComplete="username" value={draft.username} onBlur={checkUsername} onChange={event=>{change('username',event.target.value);setAvailability('');}}/></div>
   {availability?<p className="social-editor-help" role="status">{availability}</p>:null}
   <Field label="Bio"><textarea rows={4} maxLength={300} value={draft.bio} onChange={event=>change('bio',event.target.value)} placeholder="What interests you? What are you making?"/></Field><p className="social-editor-help social-editor-counter">{draft.bio.length}/300</p>
   <Field label="Social department / field of interest" maxLength={100} value={draft.socialDepartment} placeholder="e.g. Product design · Robotics · Computer science" onChange={event=>change('socialDepartment',event.target.value)}/><p className="social-editor-help">A self-described field for your social profile. Your college department stays in your official record.</p>
   <div className="social-editor-subheading"><div><h3><Link2 size={17}/>Links</h3><p className="social-editor-help">Your portfolio, projects and other profiles.</p></div><Button type="button" variant="secondary" disabled={draft.socialLinks.length>=5} onClick={()=>change('socialLinks',[...draft.socialLinks,{label:'',url:''}])}><Plus size={15}/>Add link</Button></div>
   {draft.socialLinks.map((link,index)=><div className="social-editor-link-row" key={index}><Field label={`Link ${index+1} label`} maxLength={40} value={link.label} placeholder="Portfolio" onChange={event=>setLink(index,'label',event.target.value)}/><Field label={`Link ${index+1} URL`} type="url" maxLength={2048} value={link.url} placeholder="https://" onChange={event=>setLink(index,'url',event.target.value)}/><button className="icon-button" type="button" aria-label={`Remove link ${index+1}`} onClick={()=>change('socialLinks',draft.socialLinks.filter((_,i)=>i!==index))}><Trash2 size={17}/></button></div>)}
   <label className="social-editor-privacy"><input type="checkbox" checked={draft.isPrivate} onChange={event=>change('isPrivate',event.target.checked)}/><LockKeyhole size={20}/><span><strong>Private account</strong><small>Approve follow requests before others can see your posts, reels and stories.</small></span></label></fieldset>
   <Feedback error={error}/>{loading?<p className="muted" role="status">Loading your saved social profile…</p>:null}<div className="social-editor-actions"><Button variant="secondary" type="button" disabled={busy} onClick={()=>onClose?onClose():navigate(back)}>Cancel</Button><Button busy={busy} disabled={loading||!loaded} type="submit"><Save size={16}/>Save changes</Button></div>
  </form><aside className="social-editor-aside"><span className="profile-eyebrow">A little more you</span><h2>Let your work and interests speak.</h2><p>Your display name, username, bio, photo, social department and links appear on your campus profile.</p><div><ShieldCheck size={21}/><p>Your official student information is supplied by AMS and stays separate.</p></div><Link className="social-inline-link" to="/profile">View student information<ArrowLeft size={15}/></Link></aside></div>
 </div>;
}
