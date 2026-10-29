import {useEffect,useMemo,useRef,useState} from 'react';
import {academicSummary} from '../lib/academic-summary';
import {readCalculation,saveCalculation} from '../lib/result-calculation';
import {request} from '../lib/api';
const EMPTY=[];
const EMPTY_PROFILE={};

export default function useAcademicSummary({results=EMPTY,credits=EMPTY,gradeScale=EMPTY,creditSummary=EMPTY,studentProfile=EMPTY_PROFILE,mode='connected',accountKey=''}={}){
 const online=globalThis.navigator?.onLine!==false;
 const [policyRevision,setPolicyRevision]=useState(0);
 const calculationOwner=`${mode}:${accountKey || 'preview'}`,currentOwner=useRef(calculationOwner);
 currentOwner.current=calculationOwner;
 const [settings,setSettings]=useState(()=>({owner:calculationOwner,value:readCalculation(calculationOwner)}));
 const [policyState,setPolicyState]=useState({owner:calculationOwner,rules:EMPTY,status:mode==='connected'?'loading':'available'});
 // Owner-dependent state is read synchronously. An account change cannot expose
 // a prior student's preference or policy while the effect is being replaced.
 const calculation=settings.owner===calculationOwner?settings.value:readCalculation(calculationOwner);
 const batchRules=policyState.owner===calculationOwner?policyState.rules:EMPTY;
 const policyStatus=mode!=='connected'?'available':policyState.owner===calculationOwner?policyState.status:'loading';
 useEffect(()=>{
  if(mode!=='connected'){setPolicyState({owner:calculationOwner,rules:EMPTY,status:'available'});return;}
  if(!online){setPolicyState({owner:calculationOwner,rules:EMPTY,status:'unavailable'});return;}
  const abort=new AbortController(),owner=calculationOwner;
  setPolicyState({owner,rules:EMPTY,status:'loading'});
  request('/academic-rules',{signal:abort.signal}).then(value=>{if(!abort.signal.aborted && currentOwner.current===owner)setPolicyState({owner,rules:Array.isArray(value?.rules)?value.rules:EMPTY,status:Array.isArray(value?.rules)?'available':'unavailable'});}).catch(()=>{if(!abort.signal.aborted && currentOwner.current===owner)setPolicyState({owner,rules:EMPTY,status:'unavailable'});});
  return()=>abort.abort();
 },[mode,calculationOwner,online,policyRevision]);
 function setCalculation(value){
  const saved=saveCalculation(calculationOwner,value);
  setSettings({owner:calculationOwner,value:saved});
  return saved;
 }
 const summary=useMemo(()=>academicSummary({results,credits,gradeScale,creditSummary,mode,studentProfile,rules:batchRules,policyStatus,calculation}),[results,credits,gradeScale,creditSummary,mode,studentProfile,batchRules,policyStatus,calculation]);
 return {...summary,calculation,setCalculation,calculationOwner,batchRules,policyStatus,retryPolicies:()=>setPolicyRevision(value=>value+1),canRetryPolicies:online && policyStatus==='unavailable'};
}
