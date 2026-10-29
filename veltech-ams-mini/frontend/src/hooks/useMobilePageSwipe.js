import {useEffect} from 'react';
import {canStartPageSwipe,swipeDestination} from '../lib/mobile-page-swipe';
export function useMobilePageSwipe({path,enabled,navigate}){
 useEffect(()=>{
  if(!enabled)return;
  let start=null;
  const begin=event=>{
   start=null;
   const point=event.touches?.[0];
   if(event.touches?.length!==1 || !point || document.querySelector('[role="dialog"],[role="menu"],.login-welcome,.sidebar.open') || !event.target.closest?.('.main-content') || !canStartPageSwipe(event.target,{x:point.clientX,width:innerWidth}))return;
   start={x:point.clientX,y:point.clientY,at:event.timeStamp};
  };
  const cancel=()=>{start=null;};
  const finish=event=>{
   const point=event.changedTouches?.[0],from=start;start=null;
   if(!point || event.touches?.length || window.getSelection?.()?.toString())return;
   const destination=swipeDestination(path,from,{x:point.clientX,y:point.clientY,at:event.timeStamp});
   if(destination){navigate(destination);window.scrollTo({top:0,behavior:'instant'});}
  };
  document.addEventListener('touchstart',begin,{passive:true});document.addEventListener('touchend',finish,{passive:true});document.addEventListener('touchcancel',cancel,{passive:true});
  return()=>{document.removeEventListener('touchstart',begin);document.removeEventListener('touchend',finish);document.removeEventListener('touchcancel',cancel);};
 },[path,enabled,navigate]);
}
