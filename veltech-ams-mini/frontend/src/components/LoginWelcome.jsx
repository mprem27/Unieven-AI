import {useEffect,useId,useRef,useState} from 'react';
import {ArrowRight,BookOpen,CalendarDays,Clock3,GraduationCap,Orbit,RefreshCw,Sparkles} from 'lucide-react';
import {useNavigate} from 'react-router-dom';
import {useCampus} from '../context/CampusContext';
import {useAppPreferences} from '../context/AppPreferences';
import {Avatar} from './UI';
import HybridLogo from './HybridLogo';
import {welcomeSyncProgress} from '../lib/sync-feedback';
import {workspaceStartPage} from '../../../shared/admin-access.mjs';

const symbols=[GraduationCap,BookOpen,CalendarDays,Orbit,Sparkles,BookOpen];

function WelcomeScreen({profile,syncStatus,loading,onComplete,onOpen,preferences}){
 const title=useId(),screen=useRef(null);
 const [reduced,setReduced]=useState(()=>preferences.motion==='reduced' || matchMedia('(prefers-reduced-motion:reduce)').matches);
 const animated=preferences.openingAnimation && !reduced;
 const [logoReady,setLogoReady]=useState(!animated),[canContinue,setCanContinue]=useState(false),[waiting,setWaiting]=useState(false);
 const identified=!!profile?.id && logoReady;
 const name=profile?.officialProfile?.name || profile?.name || '';
 const photo=profile?.officialProfile?.photo || profile?.photo || profile?.image;
 const detail=[profile?.officialProfile?.studentId || profile?.studentId,profile?.officialProfile?.department || profile?.department].filter(Boolean).join(' · ');
 const progress=welcomeSyncProgress(syncStatus),staff=['faculty','admin'].includes(profile?.accountRole);
 const finished=progress.finished || (!syncStatus?.state && !loading);
 const label=progress.failed?'Sync could not finish':progress.partial?'Sync finished · some sections unavailable':loading || progress.active?(staff?'Preparing your workspace':'Syncing your college details'):'Your workspace is ready';

 useEffect(()=>{
  const media=matchMedia('(prefers-reduced-motion:reduce)'),change=()=>setReduced(preferences.motion==='reduced' || media.matches);
  change();media.addEventListener('change',change);return()=>media.removeEventListener('change',change);
 },[preferences.motion]);
 useEffect(()=>{const timer=setTimeout(()=>setLogoReady(true),animated?1100:0);return()=>clearTimeout(timer);},[animated]);
 useEffect(()=>{
  const reveal=setTimeout(()=>setCanContinue(true),3500);
  return()=>clearTimeout(reveal);
 },[]);
 useEffect(()=>{
  if(waiting)return;
  const limit=setTimeout(onComplete,8000);return()=>clearTimeout(limit);
 },[waiting,onComplete]);
 useEffect(()=>{
  if(!identified || loading || !(finished || !waiting && progress.enoughReady))return;
  const timer=setTimeout(onComplete,finished?(animated?650:0):2500);return()=>clearTimeout(timer);
 },[identified,loading,finished,waiting,progress.enoughReady,name,photo,onComplete,animated]);
 useEffect(()=>{
  const previous=document.activeElement,overflow=document.body.style.overflow;
  document.body.style.overflow='hidden';screen.current?.focus({preventScroll:true});
  const trap=event=>{
   if(event.key!=='Tab')return;
   const buttons=[...screen.current.querySelectorAll('button:not(:disabled)')],first=buttons[0],last=buttons.at(-1);
   if(!first){event.preventDefault();screen.current.focus();return;}
   if(event.shiftKey && (document.activeElement===first || document.activeElement===screen.current)){event.preventDefault();last.focus();}
   else if(!event.shiftKey && (document.activeElement===last || document.activeElement===screen.current)){event.preventDefault();first.focus();}
  };
  const node=screen.current;node?.addEventListener('keydown',trap);
  return()=>{document.body.style.overflow=overflow;node?.removeEventListener('keydown',trap);if(previous?.isConnected)previous.focus({preventScroll:true});else document.getElementById('main')?.focus({preventScroll:true});};
 },[]);

 return <section ref={screen} className={`login-welcome ${identified?'has-identity':'has-logo'}`} data-stage="syncing" data-animated={animated?'true':'false'} data-background={preferences.backgroundAnimation?'on':'off'} role="dialog" aria-modal="true" aria-labelledby={title} tabIndex={-1}>
  <div className="welcome-atmosphere" aria-hidden="true"><i/><i/><i/><div className="welcome-grid"/>{symbols.map((Icon,index)=><span key={index} className={`welcome-symbol symbol-${index}`}><Icon size={index%2?30:42} strokeWidth={1}/></span>)}</div>
  <div className="welcome-topline" aria-hidden="true"><span/>VEL TECH · YOUR CAMPUS, CONNECTED</div>
  <div className="welcome-content">
   <div className="welcome-mark" aria-hidden="true"><div className="welcome-halo"/><div className="welcome-orbit"/><div className="welcome-orbit outer"/><div className="welcome-logo logo-assembly">{animated?<HybridLogo/>:<img src="/assets/original-logo.png" alt=""/>}</div>{identified?<div className="welcome-portrait"><Avatar name={name} src={photo}/></div>:null}<span className="welcome-spark spark-one"/><span className="welcome-spark spark-two"/></div>
   <div className="welcome-identity" key={identified?'person':'brand'}><p className="welcome-eyebrow">{identified?'WELCOME BACK':'ONE CAMPUS. TOGETHER.'}</p><h1 id={title}>{identified?(name || 'Your college workspace'):'veltech'}{!identified?<span>ams mini</span>:null}</h1><p className="welcome-detail">{identified?(detail || 'Your college day, all together.'):'Your college day, all together.'}</p></div>
   <div className="welcome-sync" role="status" aria-live="polite"><div className="welcome-sync-label"><RefreshCw size={15}/><span>{label}</span><span className="welcome-dots" aria-hidden="true"><i/><i/><i/></span></div><div className="welcome-progress" aria-hidden="true"><span/></div></div>
   {identified && progress.total>0?<p className="welcome-module-count">{progress.available} of {progress.total} sections updated</p>:null}
   {identified?<><div className="welcome-actions"><button type="button" disabled={!progress.enoughReady && !finished && !canContinue} onClick={onOpen}>{staff?'Open workspace':'Open Home'}<ArrowRight size={16}/></button>{!finished?<button type="button" aria-pressed={waiting} onClick={()=>setWaiting(true)}><Clock3 size={15}/>{waiting?'Waiting for sync…':'Wait for all sections'}</button>:null}</div><p className="welcome-wait-note">{waiting?'Your workspace opens when this sync finishes.':progress.enoughReady?'Your main records are ready. Remaining sections can sync in Home.':'Your records are arriving. You can keep waiting here.'}</p></>:null}
  </div>
  <footer className="welcome-credit">Developed by VEL STUDENTS</footer>
 </section>;
}

export default function LoginWelcome(){
 const {welcomeStage,finishWelcome,sessionState,mode,data,loading}=useCampus();
 const {preferences}=useAppPreferences();
 const navigate=useNavigate();
 if(welcomeStage!=='syncing' || mode!=='connected' || sessionState!=='ready')return null;
 const profile=data.profile,student=profile?.accountRole==='student';
 const openWorkspace=()=>{finishWelcome();navigate(`/${workspaceStartPage(profile)}`,{replace:true});};
 return <WelcomeScreen profile={profile} syncStatus={data.syncStatus || data.academic?.syncStatus} loading={student?!data.academicReady && loading:loading} onComplete={finishWelcome} onOpen={openWorkspace} preferences={preferences}/>;
}
