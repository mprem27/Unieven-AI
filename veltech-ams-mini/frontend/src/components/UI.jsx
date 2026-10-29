import {cloneElement,useEffect,useId,useRef,useState} from 'react';
import {ArrowRight,ChevronRight,CheckCircle2,AlertCircle,Link2,X,LoaderCircle,Calendar,MapPin} from 'lucide-react';
import {displayDate} from '../lib/attendance';
export function IconButton({label,children,...props}) {return <button className="icon-button" aria-label={label} title={label} {...props}>{children}</button>;}
export function Button({children,variant='primary',className='',busy=false,...props}) {return <button className={`button ${variant} ${className}`} {...props} disabled={busy || props.disabled}>{busy?<LoaderCircle size={16} className="spin"/>:null}{children}</button>;}
export function Avatar({name='',src,size='medium'}) {
 const [broken,setBroken]=useState(false);useEffect(()=>setBroken(false),[src]);
 return <span className={`avatar ${size}`}>{src && !broken?<img src={src} alt={`${name} profile`} onError={()=>setBroken(true)}/>:<span aria-label={`${name || 'Student'} initials`}>{name.split(' ').filter(Boolean).slice(0,2).map(x=>x[0]).join('').toUpperCase() || 'U'}</span>}</span>;
}
export function SectionTitle({title,action,onAction}) {return <div className="section-title"><h2>{title}</h2>{action?<button className="text-button" onClick={onAction}>{action}<ArrowRight size={16}/></button>:null}</div>;}
export function EmptyState({title='Nothing here yet',description,action,onAction}) {return <div className="empty-state"><span className="empty-symbol"><Link2 size={25}/></span><h3>{title}</h3><p>{description}</p>{action?<Button variant="secondary" onClick={onAction}>{action}</Button>:null}</div>;}
export function Badge({status,children}) {return <span className={`badge ${status || 'neutral'}`}>{children || ({present:'Present',absent:'Absent','in-progress':'In progress',upcoming:'Upcoming',unknown:'Not marked','on-duty':'On duty',registered:'Registered',attended:'Checked in',payment_pending:'Awaiting payment',cancelled:'Cancelled'}[status] || status)}</span>;}
export function Dialog({title,children,onClose,wide=false}) {
 const ref=useRef(),closeRef=useRef(onClose),id=useId();
 closeRef.current=onClose;
 useEffect(()=>{
  const previous=document.activeElement,oldOverflow=document.body.style.overflow;document.body.style.overflow='hidden';
  const node=ref.current;node.querySelector('button,input,select,textarea')?.focus();
  const handle=e=>{if(e.key==='Escape'){closeRef.current();return;}if(e.key==='Tab'){const fields=[...node.querySelectorAll('button,input,select,textarea,a[href]')].filter(x=>!x.disabled && x.offsetParent!==null);const first=fields[0],last=fields.at(-1);if(e.shiftKey && document.activeElement===first){e.preventDefault();last?.focus();}else if(!e.shiftKey && document.activeElement===last){e.preventDefault();first?.focus();}}};
  node.addEventListener('keydown',handle);return()=>{node.removeEventListener('keydown',handle);document.body.style.overflow=oldOverflow;previous?.focus();};
 },[]);
 return <div className="dialog-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget)onClose();}}><section ref={ref} role="dialog" aria-modal="true" aria-labelledby={id} className={`dialog ${wide?'wide':''}`}><div className="dialog-heading"><h2 id={id}>{title}</h2><IconButton label="Close dialog" onClick={onClose}><X size={20}/></IconButton></div>{children}</section></div>;
}
export function Field({label,children,...props}) {
 const generatedId=useId(),id=props.id || children?.props?.id || generatedId;
 return <div className="field"><label htmlFor={id}>{label}</label>{children?cloneElement(children,{id}):<input {...props} id={id}/>}</div>;
}
export function Feedback({error,success}) {return error?<div className="feedback error"><AlertCircle size={16}/>{error}</div>:success?<div className="feedback success"><CheckCircle2 size={16}/>{success}</div>:null;}
export function PageHeader({title,description,children,className=''}) {return <div className={`page-heading ${className}`}><div><h1>{title}</h1>{description?<p>{description}</p>:null}</div><div className="heading-actions">{children}</div></div>;}
export function EventCard({event,onOpen,compact=false}) {return <button className={`event-card ${compact?'compact':''}`} onClick={()=>onOpen(event)}><img src={event.image || '/assets/veltech-campus.jpg'} style={{objectFit:event.posterFit || 'cover',objectPosition:`center ${event.posterPosition ?? 50}%`}} alt={`${event.title} event poster`}/><div className="event-card-copy"><div className="event-title-line"><h3>{event.title}</h3><ChevronRight size={18}/></div><p><Calendar size={14}/>{displayDate(event.date,{year:undefined})}<span className="card-location"><MapPin size={14}/>{event.location}</span></p>{!compact?<div className="event-card-footer"><span>{event.organizerName || event.category}</span><strong>{event.pricePaise?`₹${event.pricePaise/100}`:'Free entry'}</strong></div>:null}</div></button>;}
