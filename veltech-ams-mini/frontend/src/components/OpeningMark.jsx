import {useEffect,useState} from 'react';
import {useAppPreferences} from '../context/AppPreferences';
export default function OpeningMark(){
 const {preferences}=useAppPreferences();
 const [visible,setVisible]=useState(()=>{try{return !sessionStorage.getItem('veltech:opening:v15') && matchMedia('(max-width:750px)').matches;}catch{return false;}});
 useEffect(()=>{if(!visible || !preferences.openingAnimation)return;try{sessionStorage.setItem('veltech:opening:v15','seen');}catch{}const timer=setTimeout(()=>setVisible(false),matchMedia('(prefers-reduced-motion:reduce)').matches?200:850);return()=>clearTimeout(timer);},[visible,preferences.openingAnimation]);
 if(!visible || !preferences.openingAnimation)return null;
 return <div className="opening-mark" aria-hidden="true"><div className="opening-logo-orbit"><span/><img src="/assets/original-logo.png" alt=""/></div><strong>veltech-ams-mini</strong><small>Developed by VEL STUDENTS</small></div>;
}
