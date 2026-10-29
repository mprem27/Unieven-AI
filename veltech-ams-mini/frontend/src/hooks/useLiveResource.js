import {useCallback,useEffect,useRef,useState} from 'react';
import {request} from '../lib/api';
import {createResourceReader,mergeWorkspace} from '../lib/workspace-loader';
import {readWorkspaceResource,saveWorkspaceResource} from '../lib/workspace-cache';
import {useCampus} from '../context/CampusContext';
const read=createResourceReader(request);
export function useLiveResource(path,enabled=true){
 const {mode,data,offlineSnapshot=false}=useCampus(),owner=String(data.profile.id || ''),key=JSON.stringify([mode,owner,path]);
 const current=useRef(key);current.current=key;
 const pending=useRef(null),backoff=useRef({key,failures:0,next:0});
 const [state,setState]=useState({key,value:null,error:'',loading:false,refreshing:false,stale:false});
 const reload=useCallback((background=false)=>{
  if(!enabled || !path || mode!=='connected' || !owner)return Promise.resolve(null);
  if(pending.current?.key===key)return pending.current.promise;
  if(backoff.current.key!==key)backoff.current={key,failures:0,next:0};
  if(background && (document.visibilityState==='hidden' || Date.now()<backoff.current.next))return Promise.resolve(null);
  const isCurrent=()=>current.current===key && pending.current?.promise===promise;
  setState(previous=>({key,value:previous.key===key?previous.value:null,error:previous.key===key?previous.error:'',loading:!(previous.key===key && previous.value!==null),refreshing:previous.key===key && previous.value!==null,stale:offlineSnapshot || navigator.onLine===false}));
  const promise=(async()=>{
   const saved=await readWorkspaceResource(owner,path);
   if(!isCurrent())return null;
   if(saved!==null)setState(previous=>previous.key===key && previous.value!==null?previous:{key,value:saved,error:'',loading:false,refreshing:false,stale:true});
   if(offlineSnapshot || navigator.onLine===false){setState(previous=>previous.key===key?{...previous,loading:false,refreshing:false,stale:true}:previous);return saved;}
   try{
    const result=await read(owner,path);if(!isCurrent())return null;
    backoff.current={key,failures:0,next:0};setState(previous=>mergeWorkspace(previous,{key,value:result,error:'',loading:false,refreshing:false,stale:false}));
    void saveWorkspaceResource(owner,path,result).catch(()=>{});return result;
   }catch(error){
    if(isCurrent()){
     const failures=backoff.current.failures+1;backoff.current={key,failures,next:Date.now()+Math.min(120000,20000*2**(failures-1))};
     setState(previous=>({...previous,error:error.message,loading:false,refreshing:false,stale:previous.value!==null}));
    }return null;
   }
  })();
  pending.current={key,promise};const clear=()=>{if(pending.current?.promise===promise)pending.current=null;};promise.then(clear,clear);return promise;
 },[path,enabled,mode,owner,key,offlineSnapshot]);
 useEffect(()=>{
  void reload(true);if(!enabled || !path || mode!=='connected' || offlineSnapshot)return;
  const poll=()=>{if(document.visibilityState!=='hidden' && navigator.onLine!==false)void reload(true);};
  const resume=()=>{if(document.visibilityState!=='hidden' && navigator.onLine!==false)void reload(true);};
  const timer=setInterval(poll,20000);document.addEventListener('visibilitychange',resume);window.addEventListener('focus',resume);window.addEventListener('online',resume);
  return()=>{clearInterval(timer);document.removeEventListener('visibilitychange',resume);window.removeEventListener('focus',resume);window.removeEventListener('online',resume);};
 },[reload,enabled,path,mode,offlineSnapshot]);
 useEffect(()=>()=>{current.current='unmounted';pending.current=null;},[]);
 const visible=state.key===key?state:{value:null,error:'',loading:enabled && mode==='connected',refreshing:false,stale:false};
 return {...visible,reload:()=>reload(false)};
}
