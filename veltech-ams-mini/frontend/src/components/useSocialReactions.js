import {useEffect,useMemo,useRef,useState} from 'react';
import {useCampus} from '../context/CampusContext';
import {request} from '../lib/api';
import {createReactionController} from '../lib/social-interactions';
import {entityId} from './SocialComposer';

export default function useSocialReactions({item,kind,onChange}) {
 const {mode,data,isCurrentAccount,notify}=useCampus(),[pending,setPending]=useState({}),[error,setError]=useState(''),owner=`${mode}:${entityId(data.profile)}`,scope=`${owner}:${kind}:${entityId(item)}`,latest=useRef(null),mounted=useRef(true);
 latest.current={item,onChange,scope,mode,isCurrentAccount};
 // A filtered card or closed viewer can disappear before its request settles.
 // Keep its parent reconciliation alive, scoped to the originating account.
 const controller=useMemo(()=>createReactionController({
  read:()=>latest.current.item,
  patch:patch=>{latest.current.item={...latest.current.item,...patch};latest.current.onChange(current=>({...current,...patch}));},
  scope:()=>latest.current.scope===scope && latest.current.isCurrentAccount(owner)?scope:null,
  send:(action,body)=>latest.current.mode==='connected'?request(`/${kind==='post'?'feed':'reels'}/${encodeURIComponent(entityId(latest.current.item))}/${action}`,{method:'PUT',body}):Promise.resolve(body),
  pending:value=>{if(mounted.current)setPending(value);}
 }),[scope]);
 useEffect(()=>{mounted.current=true;setPending({});setError('');return()=>{mounted.current=false;};},[controller]);
 return {pending,error,act:(action,desired)=>{setError('');return controller.act(action,desired).catch(failure=>{if(mounted.current)setError(failure.message);else notify(failure.message,'error');});}};
}
