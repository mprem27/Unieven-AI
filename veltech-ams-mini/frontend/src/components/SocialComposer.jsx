import {useEffect,useRef,useState} from 'react';
import {ImagePlus,Film,Send,Type,Upload,Check} from 'lucide-react';
import {useCampus} from '../context/CampusContext';
import {request} from '../lib/api';
import {Avatar,Button,Field,Feedback} from './UI';
import {OVERLAY_FONTS,OVERLAY_STYLES,MEDIA_FILTERS,OVERLAY_DEFAULTS,normalizedOverlay,overlayPlacements,optionLabel,filterStyle,mediaStyle} from '../lib/social-overlay';
import '../media-social.css';
import '../composer-v16.css';

export const entityId=value=>String(value?.id || value?._id || value || '');
export const listItems=value=>Array.isArray(value)?value:(value?.items || value?.reels || value?.stories || []);
export {mediaStyle,filterStyle};
export const overlayDefaults=OVERLAY_DEFAULTS;
export function OverlayText({entry={}}) {
 const text=entry.overlayText ?? entry.text;
 const appearance=normalizedOverlay(entry);
 return typeof text==='string' && text.trim()?<span dir="auto" className={`social-media-overlay social-text-${appearance.textStyle} social-font-${appearance.textFont}`} style={mediaStyle(entry)}>{text.trim()}</span>:null;
}
export function safeLink(value) {try {const url=new URL(value);return ['https:','http:'].includes(url.protocol)?url.href:'';}catch{return '';}}
export function validateFile(file,{videoOnly=false}={}) {
 if(!file)throw new Error('Choose a file from your device.');
 const images=['image/jpeg','image/png','image/webp','image/gif'],videos=['video/mp4','video/webm'];
 if(!(videoOnly?videos:[...images,...videos]).includes(file.type))throw new Error(videoOnly?'Choose an MP4 or WebM video.':'Choose a JPEG, PNG, WebP, GIF, MP4 or WebM file.');
 if(file.size>(file.type.startsWith('video/')?25:8)*1024*1024)throw new Error(file.type.startsWith('video/')?'Videos must be 25 MB or smaller.':'Images must be 8 MB or smaller.');
 return file.type.startsWith('video/')?'video':'image';
}
export async function uploadSocialFile(file,mode) {
 const kind=validateFile(file);
 if(mode==='demo')return {url:URL.createObjectURL(file),kind,demo:true};
 const form=new FormData();form.append('file',file);return request('/media/upload',{method:'POST',body:form});
}
export function OverlayOptions({draft,setDraft,maxTextLength=250,disabled=false}) {
 const appearance=normalizedOverlay(draft);
 const change=patch=>setDraft(current=>({...current,...patch}));
 return <fieldset className="v16-overlay-editor" disabled={disabled}>
  <legend className="sr-only">Media appearance</legend>
  <div className="v16-filter-heading"><strong>Find your look</strong><span>Applies to your photo or video</span></div>
  <div className="v16-filter-options" role="group" aria-label="Media filters">
   {MEDIA_FILTERS.map(filter=><button key={filter} type="button" aria-pressed={appearance.filter===filter} aria-label={`${optionLabel(filter)} filter`} onClick={()=>change({filter})}>
    <span className="v16-filter-swatch" style={{filter:filterStyle(filter)}} aria-hidden="true"><span/></span><span>{optionLabel(filter)}</span>
   </button>)}
  </div>
  <details className="social-overlay-options" open>
   <summary><Type size={17}/>Text & layout<span className="v16-overlay-summary">Make it yours</span></summary>
   <div className="v16-overlay-content">
    <Field label="Overlay text"><textarea rows={2} maxLength={maxTextLength} value={draft.text || ''} placeholder="Add a few words…" onChange={e=>change({text:e.target.value})}/></Field>
    <div className="v16-overlay-meta"><span>{(draft.text || '').length} / {maxTextLength}</span><button type="button" className="text-button" onClick={()=>change({...OVERLAY_DEFAULTS,text:draft.text || '',filter:appearance.filter})}>Reset text look</button></div>
    <div className="form-grid">
     <Field label="Font"><select value={appearance.textFont} onChange={e=>change({textFont:e.target.value})}>{OVERLAY_FONTS.map(font=><option key={font} value={font}>{optionLabel(font)}</option>)}</select></Field>
     <Field label="Text style"><select value={appearance.textStyle} onChange={e=>change({textStyle:e.target.value})}>{OVERLAY_STYLES.map(style=><option key={style} value={style}>{optionLabel(style)}</option>)}</select></Field>
     <Field label="Text color" type="color" value={/^#[a-f\d]{6}$/i.test(appearance.textColor)?appearance.textColor:'#ffffff'} onChange={e=>change({textColor:e.target.value})}/>
     <Field label={`Text size · ${appearance.textSize}`}><input type="range" min="16" max="100" value={appearance.textSize} aria-valuetext={`${appearance.textSize} at standard media width`} onChange={e=>change({textSize:Number(e.target.value)})}/></Field>
    </div>
    <fieldset className="v16-placement-controls"><legend>Text placement</legend><div className="v16-placement-grid" role="group" aria-label="Text placement presets">{overlayPlacements.map((placement,index)=><button type="button" key={placement.label} title={placement.label} aria-label={placement.label} aria-pressed={Math.abs(appearance.textX-placement.textX)<.005 && Math.abs(appearance.textY-placement.textY)<.005} onClick={()=>change({textX:placement.textX,textY:placement.textY})}><span aria-hidden="true" style={{justifySelf:['start','center','end'][index%3],alignSelf:['start','center','end'][Math.floor(index/3)]}}>Aa</span></button>)}</div><div className="v16-position-sliders">
     <Field label={`Horizontal · ${Math.round(appearance.textX*100)}%`}><input type="range" aria-label="Horizontal text position" min="0" max="1" step="0.01" value={appearance.textX} aria-valuetext={`${Math.round(appearance.textX*100)} percent from left`} onChange={e=>change({textX:Number(e.target.value)})}/></Field>
     <Field label={`Vertical · ${Math.round(appearance.textY*100)}%`}><input type="range" aria-label="Vertical text position" min="0" max="1" step="0.01" value={appearance.textY} aria-valuetext={`${Math.round(appearance.textY*100)} percent from top`} onChange={e=>change({textY:Number(e.target.value)})}/></Field>
    </div></fieldset>
   </div>
  </details>
 </fieldset>;
}

export default function SocialComposer({onClose,onPublished,initialType='post',event,types=['post','reel']}) {
 const {data,mode,compose,updateDemo,notify}=useCampus();
 const fileInput=useRef(null);
 const [mediaRatio,setMediaRatio]=useState(null);
 const [type,setType]=useState(initialType),[file,setFile]=useState(null),[preview,setPreview]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const [draft,setDraft]=useState({...overlayDefaults,caption:'',category:'campus',visibility:'account',tags:'',mentions:'',link:'',location:''});
 useEffect(()=>{if(!file){setPreview('');return;}const url=URL.createObjectURL(file);setPreview(url);return()=>URL.revokeObjectURL(url);},[file]);
 const choose=e=>{const next=e.target.files?.[0];if(!next)return;try {validateFile(next,{videoOnly:type==='reel'});setFile(next);setMediaRatio(null);setError('');}catch(err){setError(err.message);e.target.value='';}};
 const publish=async e=>{e.preventDefault();setError('');setBusy(true);try {
  if(type==='reel' && !file)throw new Error('A reel needs an MP4 or WebM video.');
  if(type==='post' && !draft.caption.trim())throw new Error('Write a caption for your post.');
  if(draft.link && !safeLink(draft.link))throw new Error('Use a complete HTTP or HTTPS link.');
  if(file)validateFile(file,{videoOnly:type==='reel'});
  const uploaded=file?await uploadSocialFile(file,mode):null;
  const payload={...draft,text:type==='post'?draft.caption.trim():draft.text,overlayText:draft.text,caption:draft.caption.trim(),tags:[],hashtags:draft.tags.split(/[,\s]+/).map(x=>x.replace(/^#/, '')).filter(Boolean).slice(0,15),mentions:draft.mentions.split(/[,\s]+/).map(x=>x.replace(/^@/, '')).filter(Boolean).slice(0,15),link:safeLink(draft.link),eventId:event?entityId(event):undefined,...(uploaded?{mediaId:uploaded.id,[uploaded.kind==='video'?'video':'image']:uploaded.url}:{}),...(type==='reel'?{videoId:uploaded?.id}: {})};
  if(type==='post')await compose(payload);
  else if(mode==='connected')await request('/reels',{method:'POST',body:payload});
  else {updateDemo(d=>{d.reels ||= [];d.reels.unshift({...payload,id:crypto.randomUUID(),author:{id:d.profile.id,name:d.profile.name,username:d.profile.username,image:d.profile.image || d.profile.photo},createdAt:new Date().toISOString(),likes:0,liked:false,saved:false,comments:[],views:0,canEdit:true});return d;});notify('Demo reel added · its device file lasts for this browser session');}
  if(mode==='connected' && type==='reel')notify('Reel published');onPublished?.();onClose?.();
 }catch(err){setError(err.message);}finally{setBusy(false);}};
 return <section className="panel social-compose-page v16-composer" aria-label={event?`Create for ${event.title}`:'Create a post or reel'}>
  <form onSubmit={publish} className="social-composer" aria-busy={busy}>
   <div className="post-author"><Avatar name={data.profile.socialName || data.profile.name} src={data.profile.socialImage || data.profile.image || data.profile.photo}/><div><h3>{data.profile.socialName || data.profile.name}</h3><small>{mode==='demo'?'Fictional demo · device files are temporary':'Your campus, your voice'}</small></div><span className="v16-composer-label">CREATE</span></div>
   <fieldset disabled={busy} className="v16-composer-fields"><legend className="sr-only">Compose your content</legend>
    <div className="tabs v16-compose-types" role="group" aria-label="Content type">{types.map(x=><button type="button" key={x} aria-pressed={type===x} className={type===x?'active':''} onClick={()=>{setType(x);setMediaRatio(null);if(x==='reel' && file && !file.type.startsWith('video/')){setFile(null);if(fileInput.current)fileInput.current.value='';}}}>{x==='reel'?<Film size={17}/>:<ImagePlus size={17}/>} {x==='reel'?'Reel':'Post'}</button>)}</div>
    <div className="social-composer-grid">
     <div className="v16-compose-copy">
      <Field label={type==='reel'?'Reel caption (optional)':'Your post'}><textarea required={type==='post'} rows={5} maxLength={2200} placeholder="Share a project, a thought, or a moment worth keeping…" value={draft.caption} onChange={e=>setDraft({...draft,caption:e.target.value})}/></Field>
      <label className={`social-upload ${file?'v16-upload-ready':''}`}><span className="v16-upload-icon">{file?<Check size={24}/>:<Upload size={24}/>}</span><strong>{file?file.name:type==='reel'?'Choose your video':'Add a photo or video'}</strong><span>{type==='reel'?'MP4 / WebM · up to 25 MB':'Images up to 8 MB · MP4 / WebM up to 25 MB'}</span><input ref={fileInput} aria-label={type==='reel'?'Reel video file':'Post photo or video file'} type="file" accept={type==='reel'?'video/mp4,video/webm':'image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm'} onChange={choose}/></label>
      {file?<button className="text-button v16-remove-file" type="button" onClick={()=>{setFile(null);setMediaRatio(null);if(fileInput.current)fileInput.current.value='';}}>Remove attachment</button>:null}
      <div className="form-grid v16-publish-details">
       <Field label="Audience"><select value={draft.visibility} onChange={e=>setDraft({...draft,visibility:e.target.value})}><option value="account">Campus · respects private account</option><option value="followers">Accepted followers</option><option value="private">Only me</option></select></Field>
       {type==='post'?<Field label="Category"><select value={draft.category} onChange={e=>setDraft({...draft,category:e.target.value})}>{['campus','project','achievement','opportunity'].map(x=><option key={x}>{x}</option>)}</select></Field>:null}
       <Field label="Hashtags" placeholder="design, campus, build" value={draft.tags} onChange={e=>setDraft({...draft,tags:e.target.value})}/>
       <Field label="Mention usernames" placeholder="aarav.reddy" value={draft.mentions} onChange={e=>setDraft({...draft,mentions:e.target.value})}/>
       <Field label="Location (optional)" placeholder="Innovation lab" maxLength={120} value={draft.location} onChange={e=>setDraft({...draft,location:e.target.value})}/>
       <Field label="Link (optional)" type="url" placeholder="https://…" maxLength={500} value={draft.link} onChange={e=>setDraft({...draft,link:e.target.value})}/>
      </div>
     </div>
     <div className="v16-compose-visual">
      <div className="v16-preview-heading"><strong>Live preview</strong><span>{type==='reel'?'9:16 reel':'Your campus post'}</span></div>
      <div className={`social-media-preview v16-media-preview ${type==='reel'?'v16-reel-preview':'v16-post-preview'}`} data-compose-type={type} data-has-media={!!preview} style={type==='post' && mediaRatio?{aspectRatio:mediaRatio}:undefined}>
       {preview?(file.type.startsWith('video/')?<video src={preview} controls playsInline preload="metadata" onLoadedMetadata={e=>setMediaRatio(e.currentTarget.videoWidth/e.currentTarget.videoHeight || null)} style={{filter:filterStyle(draft.filter)}}/>:<img src={preview} alt="Your attachment preview" onLoad={e=>setMediaRatio(e.currentTarget.naturalWidth/e.currentTarget.naturalHeight || null)} style={{filter:filterStyle(draft.filter)}}/>):<span className="social-preview-label"><ImagePlus size={28}/><strong>{type==='reel'?'Your next campus moment':'A little room for your ideas'}</strong><span>{type==='reel'?'Choose a video to see your look':'Add media to preview filters and text'}</span></span>}
       {preview?<OverlayText entry={draft}/>:null}
      </div>
      <p className="v16-preview-note">{type==='reel'?'Your original video sound is kept. ':''}Filters and text are saved with your {type}.{!preview && type==='post'?' A text-only post uses your caption.':''}</p>
      <OverlayOptions draft={draft} setDraft={setDraft} maxTextLength={300} disabled={busy}/>
     </div>
    </div>
   </fieldset>
   {event?<p className="inline-note">This {type} links to {event.title}. Registration opens on the event page.</p>:null}
   <div role="alert" aria-live="assertive"><Feedback error={error}/></div>
   <div className="dialog-actions v16-publish-actions"><span className="muted">{draft.caption.length.toLocaleString()} / 2,200</span><Button busy={busy} type="submit"><Send size={16}/>Publish {type}</Button></div>
  </form>
 </section>;
}
