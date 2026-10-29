import {useEffect,useState} from 'react';
import {useAppPreferences} from '../context/AppPreferences';
import HybridLogo from './HybridLogo';
const key='veltech:launch:v233-clarity';
function alreadyOpened(){try{return sessionStorage.getItem(key)==='seen';}catch{return false;}}
export default function AppLaunch({children}){
 const {preferences}=useAppPreferences(),[pending,setPending]=useState(()=>!alreadyOpened()),[leaving,setLeaving]=useState(false);
 const reduced=preferences.motion==='reduced' || globalThis.matchMedia?.('(prefers-reduced-motion:reduce)').matches;
 const visible=pending && preferences.openingAnimation;
 useEffect(()=>{
  if(!pending)return;
  if(!preferences.openingAnimation){setPending(false);return;}
  try{sessionStorage.setItem(key,'seen');}catch{}
  const fade=reduced?null:setTimeout(()=>setLeaving(true),900);
  const timer=setTimeout(()=>setPending(false),reduced?180:1100);
  return()=>{clearTimeout(timer);if(fade!==null)clearTimeout(fade);};
 },[pending,preferences.openingAnimation,reduced]);
 return <><div className="app-launch-content" inert={visible} aria-hidden={visible || undefined}>{children}</div>{visible?<div className="app-launch" role="status" aria-label="Opening Veltech mini" data-motion={reduced?'reduced':'full'} data-transition={leaving?'leaving':'arriving'}><div className="app-launch-mark" aria-hidden="true">{reduced?<img className="app-launch-static" src="/assets/original-logo.png" alt=""/>:<HybridLogo/>}</div><strong>veltech mini</strong></div>:null}</>;
}
