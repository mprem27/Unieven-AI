import {useEffect,useState} from 'react';
import {RefreshCw} from 'lucide-react';
import {useCampus} from '../context/CampusContext';
import {refreshAppAssets,deferUpdate,updateDeferred} from '../lib/update-policy';
export default function AppUpdateNotice(){
 const {mode,data}=useCampus(),owner=mode==='connected'?String(data?.profile?.id || ''):'browser';
 const [update,setUpdate]=useState(null),[busy,setBusy]=useState(false),[error,setError]=useState('');
 useEffect(()=>{
  let active=true;
  const ready=worker=>{
   // The URL may now serve a newer build than the installed waiting worker.
   // Defer all pending web updates for this owner rather than inventing identity.
   const id='pending-web-update';
   if(worker && active && !updateDeferred(localStorage,owner,id))setUpdate({worker,id});
  };
  setUpdate(null);const listener=e=>void ready(e.detail);
  window.addEventListener('campus-update-available',listener);
  navigator.serviceWorker?.getRegistration().then(r=>void ready(r?.waiting)).catch(()=>{});
  return()=>{active=false;window.removeEventListener('campus-update-available',listener);};
 },[owner]);
 async function apply(){
  if(busy)return;setBusy(true);setError('');
  try{
   await refreshAppAssets({worker:update.worker});
  }catch{setBusy(false);setError('Could not apply the update. Try again when connected.');}
 }
 if(!update)return null;
 return <aside className="app-update-notice" role="status"><span>An updated web version is ready.</span><button disabled={busy} onClick={()=>void apply()}><RefreshCw size={15}/>{busy?'Applying…':'Reload update'}</button><button disabled={busy} onClick={()=>{deferUpdate(localStorage,owner,update.id);setUpdate(null);}}>Later · 24 hours</button>{error?<span>{error}</span>:null}</aside>;
}
