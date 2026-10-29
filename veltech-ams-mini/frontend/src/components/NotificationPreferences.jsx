import {useEffect,useRef,useState} from 'react';
import {Bell,Volume2,Save} from 'lucide-react';
import {useCampus} from '../context/CampusContext';
import {useAppPreferences} from '../context/AppPreferences';
import {request} from '../lib/api';
import {notificationChanges,notificationLink,readAlertPreferences,saveAlertPreferences,shouldPlayForegroundSound,isQuietHours,playForegroundSound} from '../lib/notifications';
import {Button,Field,Feedback,SectionTitle} from './UI';
import '../pages/notifications.css';

const preferenceEvent='campus:notification-alert-preferences';
const accountKey=(mode,profile)=>`${mode}:${profile.id || profile.email || 'preview'}`;
export default function NotificationPreferences(){
 const {mode,data,refresh}=useCampus(),{preferences,update}=useAppPreferences(),account=accountKey(mode,data.profile);
 const [alerts,setAlerts]=useState(()=>readAlertPreferences(account)),[absent,setAbsent]=useState(data.profile.absentAlertsEnabled===true),[busy,setBusy]=useState(false),[error,setError]=useState(''),[message,setMessage]=useState('');
 useEffect(()=>{setAlerts(readAlertPreferences(account));setAbsent(data.profile.absentAlertsEnabled===true);setError('');setMessage('');},[account,data.profile.absentAlertsEnabled]);
 const change=(key,value)=>setAlerts(previous=>({...previous,[key]:value}));
 async function save(){
  setBusy(true);setError('');setMessage('');
  try{
   const saved=saveAlertPreferences(account,alerts);setAlerts(saved);window.dispatchEvent(new CustomEvent(preferenceEvent,{detail:{account}}));
   if(mode==='connected' && absent!==(data.profile.absentAlertsEnabled===true)){await request('/academics/preferences',{method:'PATCH',body:{absentAlertsEnabled:absent}});await refresh();}
   let pushUpdated=false;
   if(mode==='connected' && 'serviceWorker' in navigator){
    const registration=await navigator.serviceWorker.getRegistration(),subscription=await registration?.pushManager?.getSubscription();
    if(subscription){await request('/academics/push/preferences',{method:'PATCH',body:{endpoint:subscription.endpoint,preferences:saved}});pushUpdated=true;}
   }
   setMessage(`Alert preferences saved on this device.${pushUpdated?' This device’s existing push subscription was updated.':''}`);
  }catch(e){setError(`${e.message} Sound preferences were saved on this device; retry to update account or push preferences.`);}finally{setBusy(false);}
 }
 async function browserAlerts(){
  setError('');setMessage('');
  if(preferences.browserAlerts){update({browserAlerts:false});setMessage('Browser alerts turned off.');return;}
  if(!('Notification' in window)){setError('System notifications are unavailable in this browser. Your inbox remains available.');return;}
  try{const permission=await Notification.requestPermission();update({browserAlerts:permission==='granted'});setMessage(permission==='granted'?'Browser alerts enabled while the app is open. Use Academic alerts to subscribe for background push.':'Browser alerts remain off. You can change notification permission in browser settings.');}catch(e){setError(e.message);}
 }
 return <section className="panel settings-section notification-preferences"><SectionTitle title="Notification preferences"/><p className="body-copy">Choose which alerts reach you and how they sound on this device.</p><div className="device-settings-grid"><Field label="Foreground sound"><select value={alerts.soundEnabled?'on':'off'} onChange={e=>change('soundEnabled',e.target.value==='on')}><option value="off">Off</option><option value="on">On while the app is open</option></select></Field><Field label="Silent mode"><select value={alerts.silent?'on':'off'} onChange={e=>change('silent',e.target.value==='on')}><option value="off">Off</option><option value="on">Mute alert sounds</option></select></Field><Field label="Quiet hours"><select value={alerts.quietHoursEnabled?'on':'off'} onChange={e=>change('quietHoursEnabled',e.target.value==='on')}><option value="off">Off</option><option value="on">Scheduled silent hours</option></select></Field><Field label="Time zone"><select value={alerts.timeZone} onChange={e=>change('timeZone',e.target.value)}>{[...new Set([alerts.timeZone,'Asia/Kolkata','UTC'])].map(zone=><option key={zone} value={zone}>{zone}</option>)}</select></Field></div>{alerts.quietHoursEnabled?<div className="device-settings-grid"><Field label="Start time"><input type="time" value={alerts.quietHoursStart} onChange={e=>change('quietHoursStart',e.target.value)}/></Field><Field label="End time"><input type="time" value={alerts.quietHoursEnd} onChange={e=>change('quietHoursEnd',e.target.value)}/></Field></div>:null}<Field label="New absence alerts"><select value={absent?'on':'off'} disabled={mode!=='connected'} onChange={e=>setAbsent(e.target.value==='on')}><option value="off">Off</option><option value="on">Notify me of new absences from AMS</option></select></Field><p className="muted">Absence alerts apply to newly saved records for the current day after you opt in. Existing attendance and historical syncs stay in Attendance.</p><div className="toolbar"><Button busy={busy} onClick={save}><Save size={16}/>Save alert preferences</Button><Button variant="secondary" onClick={async()=>{setError('');try{setMessage(await playForegroundSound()?'Test sound played. Silent mode and quiet hours still apply to new alerts.':'Audio is unavailable. Check your browser and device sound settings.');}catch{setError('Audio could not start. Check your browser and device sound settings.');}}}><Volume2 size={16}/>Test sound</Button></div><div className="device-setting-row"><Bell size={19}/><div><strong>Browser alerts</strong><small>Permission is requested only when you choose Enable browser alerts.</small></div><Button variant="secondary" onClick={browserAlerts}>{preferences.browserAlerts?'Turn off browser alerts':'Enable browser alerts'}</Button></div><p className="page-footnote">Foreground sound is off by default and needs a browser interaction. Background push needs a subscription and configured provider keys. Your browser and operating system control background sounds and may keep notifications silent. {mode==='demo'?'Preview preferences affect this device only; sign in to enable real absence alerts.':''}</p><Feedback error={error} success={message}/></section>;
}

// Mount once inside both providers. Initial loads and account changes set a baseline.
export function NotificationAlertBridge(){
 const {mode,data}=useCampus(),{preferences}=useAppPreferences(),account=accountKey(mode,data.profile),history=useRef(null),sourceBaseline=useRef(null),activeAccount=useRef(account);
 activeAccount.current=account;
 useEffect(()=>{
  if(mode!=='connected' || !data.notificationReady?.academic || !data.notificationReady?.social){history.current=null;sourceBaseline.current=null;return;}
  const sources=sourceBaseline.current?.account===account?sourceBaseline.current:{account,academic:false,social:false};
  sourceBaseline.current={account,academic:sources.academic || data.notificationReady.academic===true,social:sources.social || data.notificationReady.social===true};
  const previous=history.current,change=notificationChanges(previous,account,data.notifications);history.current=change.state;
  if(!change.newUnread.length)return;
  const fresh=data.notifications.filter(item=>sources[item.source==='social'?'social':'academic'] && change.newUnread.includes(item.id || item._id) && !(item.read ?? item.isRead) && !previous?.ids.has(`${item.source || 'academic'}:${item.id || item._id}`));
  if(!fresh.length)return;
  const alerts=readAlertPreferences(account),visible=document.visibilityState==='visible';
  if(shouldPlayForegroundSound(alerts,{visible}))void playForegroundSound().catch(()=>{});
  if(!preferences.browserAlerts || !('Notification' in window) || Notification.permission!=='granted')return;
  const show=async()=>{try{
   const item=fresh[0],options={body:'Open your campus inbox to read the update.',icon:'/icons/app-192.png',tag:`campus:${item.source || 'academic'}:${item.id || item._id}`,silent:visible || !alerts.soundEnabled || alerts.silent || isQuietHours(alerts),data:{url:'/#'+notificationLink(item)}},registration=await navigator.serviceWorker?.getRegistration();
   if(activeAccount.current!==account)return;
   if(registration)await registration.showNotification('New campus notification',options);
   else{const notification=new Notification('New campus notification',options);notification.onclick=()=>{if(activeAccount.current!==account)return;window.location.hash=notificationLink(item);window.focus();notification.close();};}
  }catch{}};void show();
 },[mode,account,data.notifications,data.notificationReady?.academic,data.notificationReady?.social,preferences.browserAlerts]);
 return null;
}
