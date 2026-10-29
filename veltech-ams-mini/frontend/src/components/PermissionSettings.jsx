import {useEffect,useRef,useState} from 'react';
import {Camera,MapPin,Bell,ShieldCheck,RefreshCw} from 'lucide-react';
import {Button,SectionTitle,Feedback,Badge} from './UI';

export default function PermissionSettings(){
 const [status,setStatus]=useState({camera:'Not checked',geolocation:'Not checked',notifications:'Not checked'}),[busy,setBusy]=useState(''),[message,setMessage]=useState(''),[error,setError]=useState('');
 const mounted=useRef(true);
 useEffect(()=>{mounted.current=true;void inspect();return()=>{mounted.current=false;};},[]);
 async function inspect(){
  const next={camera:navigator.mediaDevices?.getUserMedia?'Ask when needed':'Unavailable',geolocation:navigator.geolocation?'Ask when needed':'Unavailable',notifications:'Notification' in window?Notification.permission:'Unavailable'};
  await Promise.all(['camera','geolocation'].map(async name=>{try{const p=await navigator.permissions?.query({name});if(p)next[name]=p.state;}catch{}}));
  if(mounted.current)setStatus(next);
 }
 async function act(kind){setBusy(kind);setError('');setMessage('');try{
  if(!window.isSecureContext)throw new Error('Device permissions need HTTPS or localhost. Open the installed app or a secure address.');
  if(kind==='notifications'){
   if(!('Notification' in window))throw new Error('System notifications are unavailable in this browser.');
   const permission=await Notification.requestPermission();setMessage(permission==='granted'?'Notification permission allowed. Enable academic push under App preferences to subscribe this device.':'Notifications remain off. You can change permission in browser site settings.');
  }else if(kind==='camera'){
   if(!navigator.mediaDevices?.getUserMedia)throw new Error('Camera access is unavailable. Manual event codes remain available.');
   const stream=await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:'environment'}},audio:false});
   stream.getTracks().forEach(t=>t.stop());setMessage('Camera access checked and camera stopped. Event scanning opens it only when you choose Scan.');
  }else{
   if(!navigator.geolocation)throw new Error('Location is unavailable in this browser. Contact the organizer for attendance review.');
   await new Promise((resolve,reject)=>navigator.geolocation.getCurrentPosition(resolve,reject,{enableHighAccuracy:true,timeout:15000,maximumAge:0}));
   setMessage('Location access checked. This test does not save your location. Event forms ask again for a fresh position when required.');
  }
 }catch(e){setError(e.message || 'Permission was not granted. Change it in browser site settings.');}finally{if(mounted.current){setBusy('');void inspect();}}}
 return <section className="panel settings-section"><SectionTitle title="Device permissions"/><p className="body-copy">Choose when to allow your browser to use device features. Requests happen only after you press a button. Browser site settings control revocation.</p>{[['notifications','System notifications','Alerts for campus updates; content stays private.',Bell],['camera','Camera & scanning','Scan an organizer code; no background camera access.',Camera],['geolocation','Event location','One fresh position for forms with an attendance range.',MapPin]].map(([key,title,description,Icon])=><div className="device-setting-row" key={key}><Icon size={21}/><div><strong>{title}</strong><small>{description}</small><Badge status={status[key]==='granted'?'present':'neutral'}>{status[key]}</Badge></div><Button variant="secondary" busy={busy===key} disabled={!!busy} onClick={()=>act(key)}>Check access</Button></div>)}<div className="inline-note"><ShieldCheck size={19}/><span>Location is supporting evidence and may be inaccurate or spoofed. The server checks time, accuracy, event range and your account; faculty may review proof.</span></div><Button variant="secondary" onClick={()=>void inspect()}><RefreshCw size={15}/>Refresh permission status</Button><Feedback error={error} success={message}/></section>;
}
