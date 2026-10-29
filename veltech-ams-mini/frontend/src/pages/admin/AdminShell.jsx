import {lazy,Suspense,useEffect,useRef,useState} from 'react';
import {Routes,Route,Navigate,NavLink,Link,useLocation,useNavigate} from 'react-router-dom';
import {LayoutDashboard,Users,CalendarDays,ShieldCheck,GraduationCap,Mail,FileText,CalendarRange,ClipboardList,MessageSquare,History,Settings,Bell,Menu,X,LogOut,Grid2X2,BriefcaseBusiness,BookOpen,ChevronRight} from 'lucide-react';
import {useCampus} from '../../context/CampusContext';
import {useAppPreferences} from '../../context/AppPreferences';
import {hasAdminAction,isAdminOwner,canAccessAcademics,adminRoleLabel} from '../../../../shared/admin-access.mjs';
import {adminNavigationFor,adminPageTitle} from '../../lib/admin-workspace';
import {Avatar,IconButton} from '../../components/UI';
import RouteLoading from '../../components/RouteLoading';
import '../../admin-workspace.css';
const PublishingDirectory=lazy(()=>import('./PublishingDirectory'));
const CampusDocuments=lazy(()=>import('../CampusDocuments'));
const Schedules=lazy(()=>import('../Schedules'));
const AdminPlacements=lazy(()=>import('./AdminPlacements'));
const EventEditor=lazy(()=>import('../EventEditor'));
const AccountDetails=lazy(()=>import('./AdminAccountDetails'));
const ExamScheduleEditor=lazy(()=>import('../ExamScheduleEditor'));
const AdminHome=lazy(()=>import('./AdminHome')),Directory=lazy(()=>import('./AdminDirectory')),Moderation=lazy(()=>import('./AdminModeration')),Messages=lazy(()=>import('./AdminMessages')),AccessHistory=lazy(()=>import('./AdminAccessHistory')),Management=lazy(()=>import('../Management')),FacultyExams=lazy(()=>import('../FacultyExams')),Forms=lazy(()=>import('../Forms')),FormBuilder=lazy(()=>import('../Forms').then(m=>({default:m.FormBuilder}))),FormDetails=lazy(()=>import('../Forms').then(m=>({default:m.FormDetails}))),FormResponses=lazy(()=>import('../Forms').then(m=>({default:m.FormResponses}))),Calendar=lazy(()=>import('../../components/AcademicCalendarAdmin')),AcademicAdmin=lazy(()=>import('../AcademicAdmin')),AppFeedback=lazy(()=>import('../../components/AppFeedback')),SettingsPage=lazy(()=>import('../Settings')),Notifications=lazy(()=>import('../Notifications')),EventOperations=lazy(()=>import('../EventOperations'));
const icons={LayoutDashboard,Users,CalendarDays,ShieldCheck,GraduationCap,Mail,FileText,CalendarRange,ClipboardList,MessageSquare,History,Settings,BriefcaseBusiness,BookOpen};
const managementPermissions={events:'events',notices:'notices',audit:'audit',support:'support',reports:'moderation'};

export default function AdminShell(){
 const {data,signOut,notify,message,error}=useCampus(),{online}=useAppPreferences(),[open,setOpen]=useState(false),route=useNavigate(),location=useLocation(),menuButton=useRef(null),drawer=useRef(null);
 const can=key=>hasAdminAction(data.profile,key,'view'),groups=adminNavigationFor(data.profile),nav=groups.flatMap(group=>group.links),phoneLinks=nav.filter(link=>link.to!=='/settings').slice(0,3),title=adminPageTitle(location.pathname,groups);
 const denied=<div className="panel admin-card"><h1>Access not assigned</h1><p>Your administrator can update your access limits.</p></div>,allowed=(permission,node)=>can(permission)?node:denied;
 function closeMenu(){setOpen(false);menuButton.current?.focus();}
 useEffect(()=>{
  if(!open)return;
  const previous=document.body.style.overflow;
  document.body.style.overflow='hidden';drawer.current?.querySelector('.admin-mobile-close')?.focus();
  const onKey=e=>{
   if(e.key==='Escape'){setOpen(false);menuButton.current?.focus();}
   if(e.key==='Tab'){
    const controls=[...drawer.current.querySelectorAll('a[href],button:not([disabled])')],first=controls[0],last=controls.at(-1);
    if(e.shiftKey && document.activeElement===first){e.preventDefault();last?.focus();}
    else if(!e.shiftKey && document.activeElement===last){e.preventDefault();first?.focus();}
   }
  };
  window.addEventListener('keydown',onKey);return()=>{document.body.style.overflow=previous;window.removeEventListener('keydown',onKey);};
 },[open]);
 async function logout(){try{await signOut();route('/login',{replace:true});}catch(e){notify(e.message,'error');}}
 return <div className="admin-app" data-admin-role={data.profile.adminAccessRole || 'owner'}>
  <a className="skip-link" href="#admin-main" onClick={e=>{e.preventDefault();document.getElementById('admin-main')?.focus();}}>Skip to administration</a>
  {open?<button className="admin-scrim" onClick={closeMenu} aria-label="Close administrator navigation"/>:null}
  <aside ref={drawer} id="administrator-navigation" className={`admin-sidebar ${open?'is-open':''}`} role={open?'dialog':undefined} aria-modal={open?true:undefined} aria-label={open?'Administrator navigation':undefined}><Link className="admin-brand" to="/management" onClick={()=>setOpen(false)}><img src="/assets/original-logo.png" alt="veltech-ams-mini"/><span><strong>veltech mini</strong><small>Administration</small></span></Link><IconButton className="admin-mobile-close" label="Close admin navigation" onClick={closeMenu}><X size={21}/></IconButton>
   <nav className="admin-navigation-groups" aria-label="Administrator navigation">{groups.map(group=><section className="admin-nav-group" key={group.label}><h2>{group.label}</h2>{group.links.map(({to,label,icon,end})=>{const Icon=icons[icon];return <NavLink key={to} to={to} end={end} className={({isActive})=>isActive?'active':''} onClick={()=>setOpen(false)}><Icon size={19}/><span>{label}</span></NavLink>;})}</section>)}</nav>
   <div className="admin-sidebar-bottom"><div className="admin-sidebar-account"><Avatar name={data.profile.name} src={data.profile.image}/><span><strong>{data.profile.name}</strong><small>{adminRoleLabel(data.profile)}</small></span><IconButton label="Sign out of administration" onClick={logout}><LogOut size={18}/></IconButton></div></div>
  </aside>
  <div className="admin-workspace"><header className="admin-topbar"><button ref={menuButton} className="icon-button admin-menu-toggle" aria-label="Open administrator navigation" aria-expanded={open} aria-controls="administrator-navigation" onClick={()=>setOpen(true)}><Menu size={22}/></button><div className="admin-breadcrumb"><span>Administration</span><ChevronRight size={16}/><strong>{title}</strong></div><div className="admin-topbar-actions"><span className="admin-access-badge"><ShieldCheck size={14}/>{isAdminOwner(data.profile)?'Owner access':'Limited access'}</span><Link className="admin-bell" to="/notifications" aria-label="Administrator notifications"><Bell size={20}/>{data.notifications?.some(item=>!item.read)?<i/>:null}</Link><Avatar name={data.profile.name} src={data.profile.image} size="small"/></div></header>
   {!online?<div className="offline-banner">You are offline. Reconnect to update campus records.</div>:null}
   <main className="admin-main" id="admin-main" tabIndex={-1}>{error?<div className="global-error" role="alert">{error}</div>:null}<Suspense fallback={<RouteLoading/>}><Routes>
    <Route path="/management" element={<AdminHome/>}/><Route path="/home" element={<Navigate to="/management" replace/>}/>
    <Route path="/admin/publishing-choices" element={hasAdminAction(data.profile,'accounts','update')?<PublishingDirectory/>:denied}/><Route path="/campus-documents/manage" element={canAccessAcademics(data.profile)?<CampusDocuments/>:denied}/>
    <Route path="/admin/directory" element={can('accounts') || can('administrators')?<Directory/>:denied}/><Route path="/admin/directory/:id" element={can('accounts') || can('administrators')?<AccountDetails/>:denied}/>
    <Route path="/events/new" element={allowed('events',<EventEditor/>)}/><Route path="/events/:id/edit" element={allowed('events',<EventEditor/>)}/>
    <Route path="/admin/roles" element={allowed('administrators',<Management initialTab="users" embedded/>)}/>
    {['events','users','notices','audit','support','reports'].map(tab=><Route key={tab} path={'/admin/manage/'+tab} element={(tab==='users'?can('accounts') || can('administrators'):can(managementPermissions[tab]))?<Management initialTab={tab} embedded/>:denied}/>)}
    <Route path="/admin/manage/placements" element={allowed('placements',<AdminPlacements/>)}/><Route path="/admin/moderation" element={allowed('moderation',<Moderation/>)}/><Route path="/admin/messages" element={allowed('communications',<Messages/>)}/><Route path="/messages" element={<Navigate to="/admin/messages" replace/>}/><Route path="/admin/access-history" element={allowed('audit',<AccessHistory/>)}/><Route path="/event-operations" element={allowed('events',<EventOperations/>)}/>
    <Route path="/faculty-exams" element={allowed('examinations',<FacultyExams/>)}/><Route path="/faculty-exams/new" element={allowed('examinations',<ExamScheduleEditor/>)}/><Route path="/faculty-exams/:id" element={allowed('examinations',<ExamScheduleEditor/>)}/>
    <Route path="/schedules/manage" element={allowed('calendar',<Schedules manage/>)}/><Route path="/academic-calendar" element={allowed('calendar',<Calendar/>)}/><Route path="/academic-admin" element={canAccessAcademics(data.profile)?<AcademicAdmin/>:denied}/>
    <Route path="/forms" element={allowed('forms',<Forms/>)}/><Route path="/forms/new" element={allowed('forms',<FormBuilder/>)}/><Route path="/forms/:id/edit" element={allowed('forms',<FormBuilder/>)}/><Route path="/forms/:id" element={allowed('forms',<FormDetails/>)}/><Route path="/forms/:id/responses" element={allowed('forms',<FormResponses/>)}/><Route path="/app-feedback/manage" element={allowed('support',<AppFeedback mode="manage"/>)}/><Route path="/settings/*" element={<SettingsPage/>}/><Route path="/notifications" element={<Notifications openNotice={notice=>{if(can('notices'))route('/admin/manage/notices');else notify(notice.title);}}/>}/><Route path="*" element={<Navigate to="/management" replace/>}/>
   </Routes></Suspense><footer className="developer-credit">Developed by VEL STUDENTS</footer></main>
  </div>
  <nav className="admin-phone-nav" aria-label="Administrator phone navigation">{phoneLinks.map(({to,label,phoneLabel,icon,end})=>{const Icon=icons[icon];return <NavLink key={to} to={to} end={end}><Icon size={21}/><span>{phoneLabel || label}</span></NavLink>;})}<button onClick={()=>setOpen(true)} aria-expanded={open} aria-controls="administrator-navigation" className={open?'is-open':''}><Grid2X2 size={21}/><span>More</span></button></nav>
  {message?.text?<div className={`toast ${message.type}`} role="status"><ShieldCheck size={18}/><span>{message.text}</span><IconButton label="Dismiss notification" onClick={()=>notify('')}><X size={15}/></IconButton></div>:null}
 </div>;
}
