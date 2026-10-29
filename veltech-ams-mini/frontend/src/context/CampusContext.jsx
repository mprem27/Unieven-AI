import {createFollowController,createRelationshipReads} from '../lib/social-follow';
import {calendarDateRange,resolveAcademicDay} from '../lib/academic-calendar';
import {applyRoomOverrides} from '../lib/timetable';
import {sameDepartment} from '../../../shared/publishing-directory.mjs';
import {loadWorkspace,createWorkspaceReader,startAcademicRefresh,startCampusRefresh,mergeWorkspace} from '../lib/workspace-loader';
import {setDownloadOwner,clearDeviceDownloads} from '../lib/device-downloads';
import {readRememberedWorkspace,rememberVerifiedWorkspace,saveWorkspaceSnapshot,saveWorkspaceResource,clearWorkspaceCache,markLocalLogout,hasLocalLogout,clearLocalLogout} from '../lib/workspace-cache';
import {createContext,useContext,useEffect,useLayoutEffect,useState,useCallback,useRef,useMemo} from 'react';
import {createDemo,DEMO_DATE} from '../data/demo';
import {useAppPreferences} from './AppPreferences';
import {request,setCsrf,setApiOwner,setApiReadOnly,reconcileLocalLogout} from '../lib/api';
import {normalizeAcademic,campusDate,campusTime,attendanceStatus,recordForClass,sortClasses} from '../lib/attendance';
import {academicIssueSummary,syncMutationFeedback} from '../lib/sync-feedback';
import {createAccountGate,mergeCampusProfile,createDemoRegistrationService,cancelDemoRegistration,needsAcademicWorkspace} from '../lib/client-state';

const CampusContext=createContext(null),STORAGE='veltech-ams-mini:demo:v16';

// Share active policy reads with a full workspace refresh. Completed private
// responses stay in the account's React state, never in a cross-account cache.
export function createCalendarReader(read){
 let owner=null;const pending=new Map();
 const invalidate=expected=>{if(expected!==undefined && expected!==owner)return;for(const run of pending.values())run.abort.abort();pending.clear();owner=null;};
 return {invalidate,read(expected,path){
  if(expected!==owner){invalidate();owner=expected;}
  if(pending.has(path))return pending.get(path).promise;
  const abort=new AbortController(),run={abort,promise:null};
  run.promise=Promise.resolve(read(path,{signal:abort.signal})).finally(()=>{if(pending.get(path)===run)pending.delete(path);});
  pending.set(path,run);return run.promise;
 }};
}
export function startCalendarRefresh({reader,owner,isCurrent,onValue,date=campusDate,documentTarget=document,windowTarget=window,schedule=setInterval,unschedule=clearInterval}){
 let stopped=false,working=false,failures=0,next=0;
 const poll=async()=>{
  if(stopped || working || !isCurrent() || documentTarget.visibilityState==='hidden' || globalThis.navigator?.onLine===false || Date.now()<next)return;
  working=true;
  const calendarPath='/academic-calendar?'+new URLSearchParams(calendarDateRange(date()));
  try{const results=await Promise.allSettled([[calendarPath,'calendarPolicies'],['/timetable-rooms','roomOverrides']].map(async([path,key])=>{
   const value=await reader.read(owner,path);
   if(!stopped && isCurrent())onValue(key,value,path);
  }));failures=results.some(result=>result.status==='rejected')?failures+1:0;next=failures?Date.now()+Math.min(120000,25000*2**(failures-1)):0;}finally{working=false;}
 };
 const visible=()=>{void poll();},timer=schedule(visible,25000);
 documentTarget.addEventListener('visibilitychange',visible);windowTarget.addEventListener('focus',visible);windowTarget.addEventListener('online',visible);void poll();
 return()=>{stopped=true;unschedule(timer);documentTarget.removeEventListener('visibilitychange',visible);windowTarget.removeEventListener('focus',visible);windowTarget.removeEventListener('online',visible);reader.invalidate(owner);};
}
function readDemo() {try {const d=JSON.parse(localStorage.getItem(STORAGE));if(d?.version===1 && d.profile && Array.isArray(d.events) && Array.isArray(d.posts)){if(!d.academic?.results?.some(r=>r.grade)){const sample=createDemo().academic;d.academic={...d.academic,results:sample.results,credits:sample.credits,gradeScale:sample.gradeScale,creditSummary:sample.creditSummary};}return d;}} catch {}return createDemo();}
const blank=()=>({profile:{campusRole:'student'},subjects:[],classes:[],records:[],academic:{},calendarPolicies:[],roomOverrides:[],notificationReady:{academic:false,social:false},events:[],registrations:[],placements:[],posts:[],people:[],notices:[],notifications:[]});
export function CampusProvider({children}) {
 const {preferences}=useAppPreferences();
 const [clock,setClock]=useState(()=>new Date());
 useEffect(()=>{const tick=()=>{if(document.visibilityState!=='hidden')setClock(new Date());},timer=setInterval(tick,15000);document.addEventListener('visibilitychange',tick);return()=>{clearInterval(timer);document.removeEventListener('visibilitychange',tick);};},[]);
 const [sessionState,setSessionState]=useState('checking'),[sessionError,setSessionError]=useState('');
 const [welcomeStage,setWelcomeStage]=useState('');
 const [offlineSnapshot,setOfflineSnapshot]=useState(false),offlineRef=useRef(false),verifiedRef=useRef(false);
 const setOffline=useCallback(value=>{offlineRef.current=value;setApiReadOnly(value);setOfflineSnapshot(value);},[]);
 const finishWelcome=useCallback(()=>setWelcomeStage(''),[]);
 const [mode,setMode]=useState('demo'),[demo,setDemo]=useState(readDemo),[live,setLive]=useState(blank),[loading,setLoading]=useState(false),[message,setMessage]=useState(null),[error,setError]=useState('');
 const followControllers=useRef(new Map()),socialGeneration=useRef(0),relationshipReads=useRef(null);
 if(!relationshipReads.current)relationshipReads.current=createRelationshipReads();
 const captureRelationshipRead=useCallback(()=>relationshipReads.current.capture(),[]);
 const reconcileRelationshipRead=useCallback((rows,token,localRows)=>relationshipReads.current.reconcile(rows,token,localRows),[]);
 const isRelationshipReadCurrent=useCallback(token=>relationshipReads.current.current(token),[]);
 const liveRef=useRef(live);liveRef.current=live;
 const accountKey=useRef('demo:'+demo.profile.id);accountKey.current=`${mode}:${(mode==='demo'?demo.profile:live.profile).id || ''}`;
 const isCurrentAccount=useCallback(owner=>accountKey.current===owner,[]);
 const campusIdentity=useRef(null),snapshotStatus=useRef(null),academicRevision=useRef(0),workspaceFailures=useRef(new Map());
 const academicRefresh=useRef(null),[academicSessionGeneration,setAcademicSessionGeneration]=useState(0);
 const workspaceReader=useRef(null);
 if(!workspaceReader.current)workspaceReader.current=createWorkspaceReader(options=>request('/academics/overview',options));
 const calendarReader=useRef(null);
 if(!calendarReader.current)calendarReader.current=createCalendarReader(request);
 const clearFailure=path=>{workspaceFailures.current.delete(path);setError([...new Set(workspaceFailures.current.values())].join(' · '));};
 const gate=useRef(null),modeRef=useRef('demo'),demoRef=useRef(demo),authAbort=useRef(null),refreshAbort=useRef(null),restoration=useRef(null),demoRegistrations=useRef(null);
 if(!gate.current)gate.current=createAccountGate();
 const notify=useCallback((text,type='success')=>setMessage({text,type,id:Date.now()}),[]);
 useEffect(()=>{localStorage.setItem(STORAGE,JSON.stringify(demo));},[demo]);
 useEffect(()=>{if(!message)return;const timer=setTimeout(()=>setMessage(null),5500);return()=>clearTimeout(timer);},[message]);
 const clearAccount=useCallback((state='anonymous')=>{
  const previous=modeRef.current==='connected'?liveRef.current.profile.id:'';
  academicRefresh.current?.();academicRefresh.current=null;
  void clearWorkspaceCache().catch(()=>{});if(previous)void clearDeviceDownloads(String(previous)).catch(()=>{});
  socialGeneration.current++;followControllers.current.clear();relationshipReads.current.clear();campusIdentity.current=null;snapshotStatus.current=null;verifiedRef.current=false;setOffline(false);setDownloadOwner('unavailable');
  accountKey.current=`demo:${demoRef.current.profile.id || ''}`;academicRevision.current++;gate.current.invalidate();authAbort.current?.abort();refreshAbort.current?.abort();calendarReader.current.invalidate();setCsrf('');setApiOwner('');setLive(blank());setLoading(false);setWelcomeStage('');modeRef.current='demo';setMode('demo');setError('');setSessionError('');setSessionState(state);workspaceFailures.current.clear();
 },[setOffline]);
 const applyAcademic=(previous,value,user=campusIdentity.current || previous.profile)=>{
  const overview=normalizeAcademic(value);
  return mergeWorkspace(previous,{academicReady:true,notificationReady:{...previous.notificationReady,academic:value.errors?.notifications?(previous.notificationReady?.academic===true?true:'failed'):true},profile:mergeCampusProfile(user,overview.profile),subjects:overview.subjects || [],records:overview.records || [],timetable:overview.timetable || [],academic:overview.academic || {},syncStatus:overview.syncStatus || overview.academic?.syncStatus || previous.syncStatus,notifications:[...(value.errors?.notifications?(previous.notifications || []).filter(n=>n.source==='academic'):(overview.notifications || []).map(n=>({...n,source:'academic'}))),...(previous.notifications || []).filter(n=>n.source==='social')],lastSyncedAt:overview.lastSyncedAt,academicError:'',academicErrors:overview.errors || {}});
 };
 const refresh=useCallback(async(user)=>{
  if((modeRef.current!=='connected' || offlineRef.current || navigator.onLine===false) && !user)return;
  const run=gate.current.startRefresh(!!user);if(!run)return;
  refreshAbort.current?.abort();const abort=new AbortController();refreshAbort.current=abort;
  setLoading(!liveRef.current.academicReady && !liveRef.current.workspaceReady);setError('');workspaceFailures.current.clear();
  try {
   const auth=user?{user}:await request('/session',{signal:abort.signal});
   if(!gate.current.currentRefresh(run))return;
   if(auth.csrfToken)setCsrf(auth.csrfToken);
   if(accountKey.current!==`connected:${auth.user.id}`){
    await Promise.allSettled([clearWorkspaceCache(),clearDeviceDownloads(String(liveRef.current.profile.id || 'unavailable'))]);
    if(!gate.current.currentRefresh(run))return;
    socialGeneration.current++;followControllers.current.clear();relationshipReads.current.clear();gate.current.invalidate();academicRevision.current++;accountKey.current=`connected:${auth.user.id}`;setApiOwner(auth.user.id);verifiedRef.current=true;setLive({...blank(),profile:mergeCampusProfile(auth.user)});void rememberVerifiedWorkspace(String(auth.user.id),{...blank(),profile:mergeCampusProfile(auth.user)}).catch(()=>{});void refresh(auth.user);return;
   }
   campusIdentity.current=auth.user;
   const range=calendarDateRange(campusDate()),calendarPath='/academic-calendar?'+new URLSearchParams(range);
   const paths=[...(needsAcademicWorkspace(auth.user)?['/academics/overview']:[]),'/events','/registrations','/placements','/feed','/people','/notices','/notifications/inbox','/timetable-rooms',calendarPath];
   const keys={'/events':'events','/registrations':'registrations','/placements':'placements','/feed':'posts','/people':'people','/notices':'notices'};
   const failures=workspaceFailures.current;
   let overviewRevision,peopleRead;
   await loadWorkspace(paths,path=>{if(path==='/people')peopleRead=captureRelationshipRead();if(path==='/academics/overview'){overviewRevision=++academicRevision.current;return workspaceReader.current(accountKey.current,{signal:abort.signal});}if(path===calendarPath || path==='/timetable-rooms')return calendarReader.current.read(accountKey.current,path);return request(path,{signal:abort.signal});},{isCurrent:()=>gate.current.currentRefresh(run),onValue:(path,value)=>{
    if(path==='/academics/overview'){
     if(overviewRevision!==academicRevision.current)return;
     snapshotStatus.current=value.syncStatus || value.academic?.syncStatus || null;setLive(previous=>applyAcademic(previous,value,auth.user));
     const issue=academicIssueSummary(value.errors);if(issue)failures.set(path,issue);else failures.delete(path);
    }else if(path==='/notifications/inbox')setLive(previous=>mergeWorkspace(previous,{notificationReady:{...previous.notificationReady,social:true},notifications:[...(previous.notifications || []).filter(n=>n.source==='academic'),...(Array.isArray(value)?value:[]).map(n=>({...n,read:n.read ?? n.isRead,source:'social'}))]}));
    else if(path==='/timetable-rooms'){setLive(previous=>mergeWorkspace(previous,{roomOverrides:value.entries || []}));void saveWorkspaceResource(String(auth.user.id),path,value).catch(()=>{});}
    else if(path===calendarPath){setLive(previous=>mergeWorkspace(previous,{calendarPolicies:value.entries || []}));void saveWorkspaceResource(String(auth.user.id),path,value).catch(()=>{});}
    else if(keys[path])setLive(previous=>mergeWorkspace(previous,{[keys[path]]:path==='/people'?reconcileRelationshipRead(Array.isArray(value)?value:[],peopleRead,previous.people):Array.isArray(value)?value:[]}));
   },onFailure:(path,error)=>{if(path==='/academics/overview' && overviewRevision!==academicRevision.current)return;failures.set(path,error.message);if(path==='/academics/overview')setLive(previous=>({...previous,notificationReady:{...previous.notificationReady,academic:'failed'},academicError:error.message}));if(path==='/notifications/inbox')setLive(previous=>({...previous,notificationReady:{...previous.notificationReady,social:'failed'}}));}});
   if(gate.current.currentRefresh(run)){setError([...new Set(failures.values())].join(' · '));setLive(previous=>mergeWorkspace(previous,{workspaceReady:true}));}
  }catch(e){if(gate.current.currentRefresh(run)){setError(e.message);if(e.status===401){clearAccount();notify('Your college session has expired. Sign in again.','error');}}}
  finally{if(gate.current.currentRefresh(run))setLoading(false);}
 },[notify,clearAccount]);

 useEffect(()=>{
  if(mode!=='connected' || offlineSnapshot || !live.profile.id)return;
  const owner=`connected:${live.profile.id}`;
  return startCalendarRefresh({reader:calendarReader.current,owner,isCurrent:()=>isCurrentAccount(owner),onValue:(key,value,path)=>{
   clearFailure(path);setLive(previous=>isCurrentAccount(owner)?mergeWorkspace(previous,{[key]:value.entries || []}):previous);void saveWorkspaceResource(String(live.profile.id),path,value).catch(()=>{});
  }});
 },[mode,offlineSnapshot,live.profile.id,isCurrentAccount]);
 useEffect(()=>{
  if(mode!=='connected' || offlineSnapshot || !live.profile.id || !preferences.refreshSeconds)return;
  const abort=new AbortController(),owner=`connected:${live.profile.id}`,generation=socialGeneration.current;
  const current=()=>!abort.signal.aborted && generation===socialGeneration.current && isCurrentAccount(owner);
  const keys={'/events':'events','/registrations':'registrations','/placements':'placements','/notices':'notices'};
  const stop=startCampusRefresh({refreshSeconds:preferences.refreshSeconds,isCurrent:current,read:path=>request(path,{signal:abort.signal}),onValue:(path,value)=>setLive(previous=>current()?mergeWorkspace(previous,{[keys[path]]:Array.isArray(value)?value:[]}):previous)});
  return()=>{stop();abort.abort();};
 },[mode,offlineSnapshot,live.profile.id,academicSessionGeneration,preferences.refreshSeconds,isCurrentAccount]);
 useEffect(()=>{
  if(mode!=='connected' || offlineSnapshot || !live.profile.id || !needsAcademicWorkspace(live.profile))return;
  const abort=new AbortController(),owner=`connected:${live.profile.id}`,generation=socialGeneration.current;
  const current=()=>!abort.signal.aborted && generation===socialGeneration.current && isCurrentAccount(owner);
  const stop=startAcademicRefresh({getSnapshotStatus:()=>snapshotStatus.current,initialStatus:liveRef.current.syncStatus,isCurrent:current,refreshSeconds:preferences.refreshSeconds,
   requestRefresh:()=>request('/academics/ams/refresh',{method:'POST',body:{},signal:abort.signal}),
   onRefreshState:sourceRefresh=>setLive(previous=>current()?mergeWorkspace(previous,{sourceRefresh}):previous),
   readStatus:()=>request('/academics/sync-status',{signal:abort.signal}),
   readWorkspace:async()=>{const revision=++academicRevision.current;return {revision,value:await workspaceReader.current(owner,{signal:abort.signal})};},
   onStatus:status=>setLive(previous=>current()?mergeWorkspace(previous,{syncStatus:status}):previous),
   onWorkspace:({revision,value:overview},status)=>{
    if(revision!==academicRevision.current)return false;
    snapshotStatus.current=overview.syncStatus || overview.academic?.syncStatus || status;
    const issue=academicIssueSummary(overview.errors);if(issue)workspaceFailures.current.set('/academics/overview',issue);else clearFailure('/academics/overview');
    setLive(previous=>{
     const campus={...campusIdentity.current};
     for(const key of ['followingCount','followersCount'])if(typeof previous.profile[key]==='number')campus[key]=previous.profile[key];
     return current()?mergeWorkspace(applyAcademic(previous,overview,campus),{syncStatus:status}):previous;
    });
   }});
  academicRefresh.current=stop;
  return()=>{stop();abort.abort();if(academicRefresh.current===stop)academicRefresh.current=null;};
 },[mode,offlineSnapshot,live.profile.id,live.profile.accountRole,academicSessionGeneration,preferences.refreshSeconds,isCurrentAccount]);
 const refreshUniversity=useCallback(()=>{
  if(modeRef.current!=='connected' || offlineRef.current || !verifiedRef.current || !academicRefresh.current)return Promise.reject(new Error('Connect and verify your app session before syncing university records.'));
  return academicRefresh.current.refreshSource();
 },[]);

 useEffect(()=>{
  if(mode!=='connected' || offlineSnapshot || !live.profile.id)return;
  const abort=new AbortController(),owner=`connected:${live.profile.id}`;let timer,working=false,failures=0,next=0;
  const poll=async()=>{
   if(working || abort.signal.aborted || !isCurrentAccount(owner) || document.visibilityState==='hidden' || navigator.onLine===false || Date.now()<next)return;
   working=true;
   try{const rows=await request('/notifications/inbox',{signal:abort.signal});if(!abort.signal.aborted && isCurrentAccount(owner)){failures=0;next=0;clearFailure('/notifications/inbox');setLive(previous=>mergeWorkspace(previous,{notificationReady:{...previous.notificationReady,social:true},notifications:[...(previous.notifications || []).filter(n=>n.source==='academic'),...(Array.isArray(rows)?rows:[]).map(n=>({...n,read:n.read ?? n.isRead,source:'social'}))]}));}}catch{failures++;next=Date.now()+Math.min(120000,30000*2**(failures-1));}finally{working=false;}
  };
  const visible=()=>{if(document.visibilityState==='visible')void poll();};
  timer=setInterval(()=>void poll(),15000);document.addEventListener('visibilitychange',visible);
  return()=>{abort.abort();clearInterval(timer);document.removeEventListener('visibilitychange',visible);};
 },[mode,offlineSnapshot,live.profile.id,isCurrentAccount]);

 const beginAccount=(restoring=false)=>{academicRefresh.current?.();academicRefresh.current=null;socialGeneration.current++;followControllers.current.clear();relationshipReads.current.clear();authAbort.current?.abort();authAbort.current=new AbortController();refreshAbort.current?.abort();calendarReader.current.invalidate();if(!restoring)setLoading(true);setError('');setMessage(null);return {ticket:gate.current.beginAccount(),signal:authAbort.current.signal};};
 const connectAccount=async(path,options,success,supplied,restoring=false)=>{
  const {ticket,signal}=beginAccount(restoring);let adopted=false;
  if(restoring && modeRef.current!=='connected'){setSessionState('checking');setSessionError('');}
  try {
   const result=supplied || await request(path,{...options,signal});if(!gate.current.currentAccount(ticket))return false;
   const same=accountKey.current===`connected:${result.user.id}`,previous=liveRef.current;
   if(!same){await Promise.allSettled([clearWorkspaceCache(),...(previous.profile.id?[clearDeviceDownloads(String(previous.profile.id))]:[])]);if(!gate.current.currentAccount(ticket))return false;}
   if(!restoring)clearLocalLogout();
   campusIdentity.current=result.user;if(!same)snapshotStatus.current=null;
   const next={...(same?previous:blank()),profile:mergeCampusProfile(result.user,same?(previous.profile.officialProfile || previous.profile):{}),syncStatus:result.syncStatus || (same?previous.syncStatus:null)};
   demoRegistrations.current?.invalidate();academicRevision.current++;accountKey.current=`connected:${result.user.id}`;setApiOwner(result.user.id);setCsrf(result.csrfToken);verifiedRef.current=true;setOffline(false);modeRef.current='connected';setMode('connected');setLive(next);setSessionState('ready');setSessionError('');setWelcomeStage(restoring?'':'syncing');setAcademicSessionGeneration(value=>value+1);
   await rememberVerifiedWorkspace(String(result.user.id),next).catch(()=>{});if(!gate.current.currentAccount(ticket))return false;
   adopted=true;void refresh(result.user);if(!gate.current.currentAccount(ticket))return false;if(success)notify(success);return true;
  }catch(e){if(!gate.current.currentAccount(ticket) || signal.aborted)return false;if(restoring){if(e.status===401)clearAccount();else if(modeRef.current==='connected'){verifiedRef.current=false;setOffline(true);setSessionState('ready');setLoading(false);setWelcomeStage('');}else {setSessionError('Check your connection and try again. Your college account may still be signed in.');setSessionState('error');}}throw e;}
  finally {if(gate.current.currentAccount(ticket)){gate.current.finishAccount(ticket);if(!adopted){setLoading(false);setWelcomeStage('');}}}
 };
 const signIn=(identity,password,area='')=>connectAccount(['faculty','admin'].includes(area)?'/login/'+area:'/login',{method:'POST',body:{identity,password}},'Signed in to your campus workspace');
 const resume=auth=>{
  if(auth)return connectAccount('/session',{},null,auth);
  if(hasLocalLogout()){clearAccount();if(navigator.onLine!==false)void reconcileLocalLogout();return Promise.resolve(false);}
  if(navigator.onLine===false)return Promise.resolve(false);
  if(restoration.current)return restoration.current;
  const work=connectAccount('/session',{},null,null,true);
  restoration.current=work;const clear=()=>{if(restoration.current===work)restoration.current=null;};work.then(clear,clear);return work;
 };
 useEffect(()=>{
  const revoked=event=>{if(!event.detail?.owner || accountKey.current===`connected:${event.detail.owner}`)clearAccount();};
  const reconcile=event=>{if(accountKey.current===`connected:${event.detail?.owner}`){clearAccount();if(!hasLocalLogout())void resume().catch(()=>{});}};
  window.addEventListener('campus:session-revoked',revoked);window.addEventListener('campus:account-changed',reconcile);
  return()=>{window.removeEventListener('campus:session-revoked',revoked);window.removeEventListener('campus:account-changed',reconcile);};
 },[clearAccount]);
 useEffect(()=>{
  let cancelled=false;const ticket=gate.current.beginAccount();
  const restore=async()=>{
   if(hasLocalLogout()){clearAccount();if(navigator.onLine!==false)void reconcileLocalLogout();return;}
   const saved=await readRememberedWorkspace();if(cancelled || !gate.current.currentAccount(ticket))return;
   gate.current.finishAccount(ticket);
   if(saved){
    accountKey.current=`connected:${saved.owner}`;setApiOwner(saved.owner);setCsrf('');verifiedRef.current=false;setOffline(true);modeRef.current='connected';setMode('connected');setLive({...blank(),...saved.data,workspaceReady:true});setSessionState('ready');
   }
   if(navigator.onLine===false){if(!saved)clearAccount();return;}
   void resume().catch(()=>{});
  };void restore();
  return()=>{cancelled=true;gate.current.invalidate();authAbort.current?.abort();refreshAbort.current?.abort();calendarReader.current.invalidate();restoration.current=null;};
 },[]);
 useEffect(()=>{
  const online=()=>{if(document.visibilityState==='hidden' || navigator.onLine===false)return;if(hasLocalLogout()){void reconcileLocalLogout();return;}if(offlineRef.current || modeRef.current!=='connected')void resume().catch(()=>{});};
  const offline=()=>{if(modeRef.current==='connected'){setOffline(true);setLoading(false);}};
  window.addEventListener('online',online);window.addEventListener('focus',online);window.addEventListener('offline',offline);document.addEventListener('visibilitychange',online);
  return()=>{window.removeEventListener('online',online);window.removeEventListener('focus',online);window.removeEventListener('offline',offline);document.removeEventListener('visibilitychange',online);};
 },[setOffline]);
 useEffect(()=>{
  if(mode!=='connected' || offlineSnapshot || !verifiedRef.current || !live.profile.id)return;
  const owner=String(live.profile.id),timer=setTimeout(()=>{if(isCurrentAccount(`connected:${owner}`))void saveWorkspaceSnapshot(owner,live).catch(()=>{});},150);
  return()=>clearTimeout(timer);
 },[mode,offlineSnapshot,live.profile,live.subjects,live.records,live.timetable,live.academic,live.calendarPolicies,live.roomOverrides,live.lastSyncedAt,isCurrentAccount]);
 const switchDemo=()=>{clearAccount('demo');notify('Demo workspace · all student data is fictional');};
 const signOut=async()=>{
  const previous=modeRef.current==='connected'?String(liveRef.current.profile.id || ''):'';
  const clearing=markLocalLogout();clearAccount();
  await Promise.allSettled([clearing,...(previous?[clearDeviceDownloads(previous)]:[])]);
  if('serviceWorker' in navigator)void navigator.serviceWorker.getRegistration().then(async registration=>{const subscription=await registration?.pushManager?.getSubscription();await subscription?.unsubscribe();}).catch(()=>{});
  notify('Signed out of your college workspace');if(navigator.onLine!==false)void reconcileLocalLogout();
 };
 const updateDemo=useCallback(fn=>{const next=fn(structuredClone(demoRef.current));demoRef.current=next;setDemo(next);return next;},[]);
 if(!demoRegistrations.current)demoRegistrations.current=createDemoRegistrationService({getState:()=>demoRef.current,update:updateDemo,makeTicket:async event=>{
  const QRCode=await import('qrcode'),token='demo-'+crypto.randomUUID(),id='ticket-'+crypto.randomUUID();
  const qrCode=await QRCode.toDataURL(JSON.stringify({demo:true,registrationId:id,eventId:event.id,qrToken:token}));
  return {id,event,qrToken:token,qrCode,status:'registered',createdAt:new Date().toISOString()};
 }});
 const data=mode==='demo'?demo:live;
 useLayoutEffect(()=>{setDownloadOwner(mode==='connected'?String(live.profile.id || 'unavailable'):'demo');},[mode,live.profile.id]);
 const today=mode==='demo'?DEMO_DATE:campusDate(clock);
 const demoDays=['Monday','Tuesday','Wednesday','Thursday','Friday'];
 const rawTimetable=useMemo(()=>mode==='demo'?demoDays.flatMap((day,index)=>demo.classes.map((c,i)=>({...c,id:day+c.id,day,date:undefined,status:undefined,subjectName:index%2 && i===0?'Software Engineering':c.subjectName}))):live.timetable || [],[mode,demo.classes,live.timetable]);
 const canonicalTimetable=useMemo(()=>mode==='demo'?rawTimetable.map(row=>{const found=(demo.academic?.courses || []).filter(course=>course.name===row.subjectName);return {...row,source:'demo',subjectCode:row.subjectCode || (found.length===1?found[0].code:'')};}):rawTimetable,[mode,rawTimetable,demo.academic?.courses]);
 const sourceDepartment=mode==='demo'?data.profile.department:data.profile.officialProfile?.department || data.profile.department || data.profile.campusDepartment || '';
 const baseTimetable=useMemo(()=>{const rooms=(data.roomOverrides || []).map(row=>sameDepartment(row.department,sourceDepartment)?{...row,department:sourceDepartment}:row);return applyRoomOverrides(canonicalTimetable,rooms,sourceDepartment);},[canonicalTimetable,data.roomOverrides,sourceDepartment]);
 const calendarPolicies=useMemo(()=>mode==='demo'?(demo.calendarPolicies || []).filter(p=>p.scope==='college' || p.scope==='department' && p.department===demo.profile.department || p.scope==='students' && p.studentIds?.includes(demo.profile.id)):live.calendarPolicies || [],[mode,demo.calendarPolicies,demo.profile.department,demo.profile.id,live.calendarPolicies]);
 const dayInfo=useMemo(()=>resolveAcademicDay({date:today,classes:baseTimetable,policies:calendarPolicies}),[today,baseTimetable,calendarPolicies]);
 const time=campusTime(clock);
 const classes=useMemo(()=>sortClasses(dayInfo.classes.map(c=>{
  const record=recordForClass(c,data.records || [],dayInfo.classes,today),entry={...c,date:today,status:record?.status};
  return {...entry,status:attendanceStatus(entry,today,time)};
 })),[dayInfo,data.records,today,time]);
 // Progress remains visible without changing the persisted academic snapshot.
 const visibleAcademic=useMemo(()=>mode==='connected' && live.syncStatus?{...live.academic,syncStatus:live.syncStatus}:data.academic,[mode,live.academic,live.syncStatus,data.academic]);
 const visibleData=useMemo(()=>({...data,academic:visibleAcademic,timetable:baseTimetable,calendarPolicies,dayInfo,classes}),[data,visibleAcademic,baseTimetable,calendarPolicies,dayInfo,classes]);

 async function mutate(path,body,method='POST',success='Updated') {const value=await request(path,{method,body});await refresh();const feedback=syncMutationFeedback(value,success);notify(feedback.text,feedback.type);return value;}
 async function register(event,details={}) {
  if(mode==='connected')return mutate(`/events/${event.id}/register`,details,'POST',event.pricePaise?'Payment order created. Your ticket awaits verified payment.':'You’re registered. Your ticket is ready.');
  const ticket=await demoRegistrations.current.register(event.id);notify('Demo registration saved. Your sample ticket is ready.');return ticket;
 }
 async function cancel(ticket) {
  if(mode==='connected')return mutate(`/registrations/${ticket.id}/cancel`,{},'POST','Registration cancelled');
  updateDemo(d=>{cancelDemoRegistration(d,ticket.id);return d;});notify('Demo registration cancelled');
 }
 async function postAction(post,action,body) {
  if(mode==='connected')return mutate(`/feed/${post.id}/${action}`,body,action==='comments'?'POST':'PUT',action==='comments'?'Comment posted':'Updated');
  updateDemo(d=>{const p=d.posts.find(p=>p.id===post.id);if(action==='like'){p.likes+=body.liked?1:-1;p.liked=body.liked;}if(action==='save')p.saved=body.saved;if(action==='comments')p.comments.push({id:crypto.randomUUID(),author:{name:d.profile.socialName || d.profile.name},text:body.text});return d;});
 }
 async function compose(body) {
  if(mode==='connected')return mutate('/feed',body,'POST','Post shared with campus');
  updateDemo(d=>{d.posts.unshift({id:crypto.randomUUID(),author:{id:d.profile.id,name:d.profile.socialName || d.profile.name,image:d.profile.socialImage || d.profile.photo,socialDepartment:d.profile.socialDepartment},...body,createdAt:new Date().toISOString(),likes:0,liked:false,saved:false,comments:[]});return d;});notify('Your demo post is shared');
 }
 async function editPost(post,text) {
  if(mode==='connected')return mutate(`/feed/${post.id}`,{text},'PATCH','Post updated');
  updateDemo(d=>{const found=d.posts.find(p=>p.id===post.id);if(found?.author.id!==d.profile.id)throw new Error('Only the author can edit this post');found.text=text.trim();return d;});notify('Demo post updated');
 }
 async function deletePost(post) {
  if(mode==='connected')return mutate(`/feed/${post.id}`,{},'DELETE','Post removed');
  updateDemo(d=>{const found=d.posts.find(p=>p.id===post.id);if(found?.author.id!==d.profile.id)throw new Error('Only the author can remove this post');d.posts=d.posts.filter(p=>p.id!==post.id);return d;});notify('Demo post removed');
 }
 async function saveEvent(event) {
  if(mode==='connected')return mutate(`/events/${event.id}/save`,{saved:!event.saved},'PUT',event.saved?'Event bookmark removed':'Event bookmarked');
  updateDemo(d=>{const found=d.events.find(e=>e.id===event.id);found.saved=!found.saved;return d;});notify('Demo event bookmarks updated');
 }
 function follow(person) {
  if(mode!=='connected'){updateDemo(d=>{const p=d.people.find(p=>p.id===person.id);if(p)p.following=!p.following;return d;});return Promise.resolve();}
  const owner=accountKey.current,generation=socialGeneration.current,id=String(person.id || person._id),key=`${owner}:${id}`;
  if(!followControllers.current.has(key)){
   let current={...person};
   const controller=createFollowController({pending:value=>{if(isCurrentAccount(owner) && generation===socialGeneration.current)relationshipReads.current.pending(id,value);},read:()=>({...current,...liveRef.current.people.find(p=>String(p.id || p._id)===id)}),isCurrent:()=>isCurrentAccount(owner) && generation===socialGeneration.current,
    patch:patch=>{relationshipReads.current.patch(id,patch);const before=current;current={...current,...patch};setLive(previous=>{
     if(!isCurrentAccount(owner) || generation!==socialGeneration.current)return previous;
     const found=previous.people.some(p=>String(p.id || p._id)===id);
     const previousPerson=previous.people.find(p=>String(p.id || p._id)===id) || before,delta=Number(!!patch.following)-Number(!!previousPerson.following);
     const withCounts=p=>({...p,...patch,...(typeof p.followersCount==='number'?{followersCount:Math.max(0,p.followersCount+delta)}:{})});
     return {...previous,profile:typeof previous.profile.followingCount==='number'?{...previous.profile,followingCount:Math.max(0,previous.profile.followingCount+delta)}:previous.profile,people:found?previous.people.map(p=>String(p.id || p._id)===id?withCounts(p):p):[...previous.people,withCounts(before)]};
    });},send:method=>request(`/connections/${encodeURIComponent(id)}`,{method,body:{}})});
   followControllers.current.set(key,controller);
  }
  return followControllers.current.get(key).act();
 }
 async function placementAction(job,action,body) {
  if(mode==='connected')return mutate(`/placements/${job.id}/${action}`,body,'PUT','Opportunity updated');
  updateDemo(d=>{const p=d.placements.find(p=>p.id===job.id);if(action==='save')p.saved=body.saved;else p.application=body.status;return d;});notify(action==='application'?'Demo application tracking updated':'Saved opportunities updated');
 }
 const value={isRelationshipReadCurrent,captureRelationshipRead,reconcileRelationshipRead,clock,time,mode,sessionState,sessionError,welcomeStage,finishWelcome,offlineSnapshot,isCurrentAccount,data:visibleData,today,loading,error,message,notify,refresh,refreshUniversity,automaticUniversityRefresh:preferences.refreshSeconds>0,signIn,resume,signOut,switchDemo,updateDemo,register,cancel,postAction,compose,editPost,deletePost,saveEvent,follow,placementAction,mutate,resetDemo:()=>{demoRegistrations.current.invalidate();demoRef.current=createDemo();setDemo(demoRef.current);notify('Demo data reset');}};
 return <CampusContext.Provider value={value}>{children}</CampusContext.Provider>;
}
export function useCampus() {return useContext(CampusContext);}
