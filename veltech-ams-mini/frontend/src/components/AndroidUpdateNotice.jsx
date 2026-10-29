import {useEffect,useState} from 'react';
import {useCampus} from '../context/CampusContext';
import {request} from '../lib/api';
import {validateAndroidRelease} from '../lib/app-release';
import {androidLaunch,deferUpdate,updateDeferred} from '../lib/update-policy';
import AndroidUpdates from './AndroidUpdates';
import {Dialog} from './UI';
export default function AndroidUpdateNotice(){
 const {mode,data,offlineSnapshot}=useCampus();
 const owner=mode==='connected' && !offlineSnapshot ? String(data?.profile?.id || data?.profile?.vtuNumber || data?.profile?.registerNumber || ''):'';
 const [notice,setNotice]=useState(null),[open,setOpen]=useState(false);
 useEffect(()=>{
  setNotice(null);setOpen(false);
  if(!owner || !androidLaunch.installed)return;
  let disposed=false,inFlight=false,nextCheck=0;
  const check=async()=>{
   if(disposed || inFlight || Date.now()<nextCheck || document.visibilityState==='hidden' || navigator.onLine===false)return;
   inFlight=true;nextCheck=Date.now()+15*60*1000;
   try{const release=validateAndroidRelease(await request('/app-release'));
    if(!disposed && release.available && (!androidLaunch.versionCode || release.versionCode>androidLaunch.versionCode) && !updateDeferred(localStorage,owner,String(release.versionCode)))setNotice(release);
    else if(!disposed){setNotice(null);setOpen(false);}
   }catch{
    // A transient failure must not consume the full successful-check cooldown.
    // Retry only on a later foreground/online event, at most once per minute.
    nextCheck=Date.now()+60*1000;
   }
   finally{inFlight=false;}
  };
  void check();window.addEventListener('online',check);document.addEventListener('visibilitychange',check);
  return()=>{disposed=true;window.removeEventListener('online',check);document.removeEventListener('visibilitychange',check);};
 },[owner]);
 if(!notice)return null;
 return <><aside className="app-update-notice" role="status"><span>{androidLaunch.versionCode?`Android ${notice.versionName} is available.`:`Android ${notice.versionName} is available. Your installed version is unknown.`}</span><button onClick={()=>setOpen(true)}>View update</button><button onClick={()=>{deferUpdate(localStorage,owner,String(notice.versionCode));setNotice(null);}}>Later · 24 hours</button></aside>{open?<Dialog title="Android update" onClose={()=>setOpen(false)}><AndroidUpdates/></Dialog>:null}</>;
}
