import {createContext,useContext,useEffect,useState} from 'react';
import {defaultPreferences,normalizePreferences} from '../lib/preferences';
const Context=createContext(null),KEY='unievecampus:preferences:v1';
export function AppPreferencesProvider({children}) {
 const [preferences,setPreferences]=useState(()=>{try {return normalizePreferences(JSON.parse(localStorage.getItem(KEY)) || {});}catch{return {...defaultPreferences};}});
 const [installPrompt,setInstallPrompt]=useState(null),[installed,setInstalled]=useState(()=>matchMedia('(display-mode: standalone)').matches || navigator.standalone===true),[online,setOnline]=useState(navigator.onLine);
 useEffect(()=>{
  localStorage.setItem(KEY,JSON.stringify(preferences));
  const dark=matchMedia('(prefers-color-scheme: dark)');const apply=()=>{document.documentElement.dataset.theme=preferences.theme==='system'?(dark.matches?'dark':'light'):preferences.theme;document.documentElement.dataset.textSize=preferences.textSize;document.documentElement.dataset.motion=preferences.motion;document.documentElement.dataset.backgroundAnimation=preferences.backgroundAnimation?'on':'off';};
  apply();dark.addEventListener('change',apply);return()=>dark.removeEventListener('change',apply);
 },[preferences]);
 useEffect(()=>{
  const prompt=e=>{e.preventDefault();setInstallPrompt(e);},didInstall=()=>{setInstalled(true);setInstallPrompt(null);},up=()=>setOnline(true),down=()=>setOnline(false);
  window.addEventListener('beforeinstallprompt',prompt);window.addEventListener('appinstalled',didInstall);window.addEventListener('online',up);window.addEventListener('offline',down);
  return()=>{window.removeEventListener('beforeinstallprompt',prompt);window.removeEventListener('appinstalled',didInstall);window.removeEventListener('online',up);window.removeEventListener('offline',down);};
 },[]);
 const update=patch=>setPreferences(old=>normalizePreferences({...old,...patch}));
 const install=async()=>{if(!installPrompt)return false;await installPrompt.prompt();const result=await installPrompt.userChoice;if(result.outcome==='accepted')setInstalled(true);setInstallPrompt(null);return result.outcome==='accepted';};
 return <Context.Provider value={{preferences,update,installed,online,canInstall:!!installPrompt,install}}>{children}</Context.Provider>;
}
export const useAppPreferences=()=>useContext(Context);
