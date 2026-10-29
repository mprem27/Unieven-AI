import {useEffect,useLayoutEffect,useRef,useState,useSyncExternalStore} from 'react';
import {Link,useLocation,useNavigate} from 'react-router-dom';
import {Bell,FileText,CheckCheck,Trash2,Check,Settings2,CalendarDays,MessageCircle,BookOpen,ArrowUpRight,ArrowLeft,Inbox,MoreHorizontal} from 'lucide-react';
import {useCampus} from '../context/CampusContext';
import {request} from '../lib/api';
import {PageHeader,Button,IconButton,EmptyState,Avatar} from '../components/UI';
import {displayDate} from '../lib/attendance';
import {notificationCategory,notificationGroups,notificationIdentity,notificationLink} from '../lib/notifications';
import {createNotificationOverlay,notificationRead as read} from '../lib/notification-overlay';
import './notifications.css';
const filters=[['all','All updates'],['unread','Unread'],['academic','Academics'],['community','Community'],['events','Events'],['notices','Notices'],['app','App']];
const icons={academic:BookOpen,community:MessageCircle,events:CalendarDays,notices:FileText,app:Bell};
const desktop=()=>globalThis.matchMedia?.('(min-width: 901px)').matches===true;
export default function Notifications({openNotice}){
 const campus=useCampus(),owner=`${campus.mode}:${campus.data.profile.id || ''}`;
 return <NotificationInbox key={owner} campus={campus} owner={owner} openNotice={openNotice}/>;
}
function NotificationInbox({campus,owner,openNotice}){
 const {data,mode,updateDemo,offlineSnapshot}=campus,location=useLocation(),navigate=useNavigate();
 const [filter,setFilter]=useState('all'),[menu,setMenu]=useState(''),alive=useRef(true),latest=useRef(campus);latest.current=campus;
 const [overlay]=useState(()=>createNotificationOverlay({request,isCurrent:()=>alive.current && latest.current.isCurrentAccount(owner),onError:message=>latest.current.notify(message,'error')}));
 useLayoutEffect(()=>{alive.current=true;return()=>{alive.current=false;};},[]);
 useSyncExternalStore(overlay.subscribe,overlay.snapshot,overlay.snapshot);
 const items=overlay.apply(data.notifications || []),unread=items.filter(n=>!read(n)).length,pending=overlay.pending(),readonly=offlineSnapshot===true;
 const visible=items.filter(n=>filter==='all' || (filter==='unread'?!read(n):notificationCategory(n)===filter));
 const notices=data.notices || [],noticeId=new URLSearchParams(location.search).get('notice'),selectedNotice=notices.find(item=>String(item.id || item._id)===noticeId);
 useEffect(()=>{if(selectedNotice && desktop())openNotice(selectedNotice);else if(noticeId)globalThis.window?.scrollTo?.({top:0,behavior:'instant'});},[noticeId,selectedNotice,openNotice]);
 async function update(item,action){
  setMenu('');if(readonly)return;
  if(mode==='demo')updateDemo(d=>{const key=notificationIdentity(item);if(action==='delete')d.notifications=d.notifications.filter(n=>notificationIdentity(n)!==key);else d.notifications=d.notifications.map(n=>notificationIdentity(n)===key?{...n,read:true,isRead:true}:n);return d;});
  else await overlay.update(item,action);
 }
 async function allRead(){
  if(readonly)return;
  if(mode==='demo')updateDemo(d=>{d.notifications=d.notifications.map(n=>({...n,read:true,isRead:true}));return d;});
  else await overlay.allRead(data.notifications || []);
 }
 function open(event,item){
  if(!read(item) && !readonly)void update(item,'read');setMenu('');
  const id=item.noticeId || new URLSearchParams(notificationLink(item).split('?')[1]).get('notice'),notice=notices.find(n=>String(n.id || n._id)===String(id));
  if(notice){event.preventDefault();if(desktop())openNotice(notice);else navigate(`/notifications?notice=${encodeURIComponent(id)}`);}
 }
 return <div className={`notifications-page ${noticeId?'notification-detail-open':''}`}>
 <div className="notification-list-view"><PageHeader title="Notifications" description="Your campus updates, all in one place."><Link className="notification-settings-link" to="/settings/notifications" aria-label="Open notification settings"><Settings2 size={19}/><span>Alert settings</span></Link></PageHeader>
 <section className="notification-summary"><span className="notification-summary-icon"><Inbox size={23}/></span><div><strong>{unread?`${unread} unread update${unread===1?'':'s'}`:'You’re all caught up'}</strong><p>{unread?'Classes, conversations and campus updates.':'We’ll keep your next update right here.'}</p></div><Button variant="ghost" onClick={allRead} busy={pending} disabled={!unread || pending || readonly} aria-label="Mark all as read"><CheckCheck size={18}/><span>Read all</span></Button></section>
 <div className="notification-filters" role="group" aria-label="Filter notifications">{filters.map(([key,label])=><button key={key} onClick={()=>{setFilter(key);setMenu('');}} className={key===filter?'active':''} aria-pressed={key===filter}>{label}{key==='unread' && unread?<span>{unread}</span>:null}</button>)}</div>
 <div className="notifications-layout"><section className="panel notification-inbox" aria-label="Personal updates"><div className="notification-inbox-heading"><h2>For you</h2><span>{visible.length} update{visible.length===1?'':'s'}</span></div>{visible.length?notificationGroups(visible).map(group=><div key={group.label}><h3 className="notification-group-heading">{group.label}</h3>{group.items.map(n=>{
  const category=notificationCategory(n),Icon=icons[category],actor=n.actor || n.fromUser,key=notificationIdentity(n),busyItem=overlay.pending(n),expanded=menu===key;
  return <article className={`notification-row ${read(n)?'':'unread'}`} key={key}>{actor?.name?<Avatar name={actor.name} src={actor.image || actor.photo}/>:<span className={`notice-icon ${category}`}><Icon size={20}/></span>}<div className="notification-copy"><div className="notification-meta"><span>{filters.find(([id])=>id===category)?.[1]}</span>{!read(n)?<span className="notification-new">Unread</span>:null}</div><Link className="notification-target" to={notificationLink(n)} onClick={event=>open(event,n)}><h3>{n.title || (category==='academic'?'Academic update':'Campus update')}</h3><p>{n.message || n.body || 'Open this update to see the details.'}</p></Link>{n.createdAt?<time className="notification-time" dateTime={n.createdAt}>{displayDate(n.createdAt)}</time>:null}</div><div className="notification-actions"><IconButton label={`Actions for ${n.title || 'notification'}`} aria-expanded={expanded} aria-controls={`notification-actions-${encodeURIComponent(key)}`} disabled={busyItem || readonly} onClick={()=>setMenu(expanded?'':key)}><MoreHorizontal size={20}/></IconButton>{expanded?<><button className="notification-menu-dismiss" aria-label="Close notification actions" onClick={()=>setMenu('')}/><div className="notification-action-menu" id={`notification-actions-${encodeURIComponent(key)}`}><strong>Manage update</strong>{!read(n)?<button disabled={busyItem} onClick={()=>update(n,'read')}><Check size={17}/>Mark as read</button>:null}<button disabled={busyItem} className="notification-delete" onClick={()=>update(n,'delete')}><Trash2 size={17}/>Delete update</button></div></>:null}</div></article>;
 })}</div>):<EmptyState title={filter==='unread'?'You’re all caught up':'No updates here yet'} description={filter==='unread'?'New unread notifications will appear here.':'Updates in this category will appear when there is something for you.'}/>}</section>
 <aside className="panel notification-noticeboard"><div className="notification-inbox-heading"><h2>Campus noticeboard</h2><FileText size={18}/></div>{notices.length?notices.map(n=><Link className="notification-row notice-button" to={`/notifications?notice=${encodeURIComponent(n.id || n._id)}`} key={n.id || n._id} onClick={event=>{if(desktop()){event.preventDefault();openNotice(n);}}}><span className="notice-icon notices"><FileText size={19}/></span><div><h3>{n.title}</h3><p>{n.body}</p><time>{displayDate(n.createdAt)}</time></div><ArrowUpRight size={16}/></Link>):<EmptyState title="No campus notices" description="Authorized staff notices appear here."/>}</aside></div></div>
 {noticeId?<section className="notification-notice-detail"><Link to="/notifications" className="settings-back"><ArrowLeft size={18}/>Back to inbox</Link>{selectedNotice?<article className="panel"><span className="notice-detail-label"><FileText size={16}/>Campus notice</span><h1>{selectedNotice.title}</h1><time>{displayDate(selectedNotice.createdAt)}</time><p>{selectedNotice.body}</p>{selectedNotice.url?<a className="button secondary" href={selectedNotice.url} target="_blank" rel="noopener noreferrer">Open source<ArrowUpRight size={16}/></a>:null}</article>:<EmptyState title="Notice unavailable" description="This notice may no longer be available. Return to your inbox for current updates."/>}</section>:null}
 </div>;
}
