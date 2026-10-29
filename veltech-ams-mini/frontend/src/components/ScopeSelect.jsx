import {useEffect,useId,useRef,useState} from 'react';
import {useCampus} from '../context/CampusContext';
import {request} from '../lib/api';
import {scopeChoices,scopeSelection} from '../lib/publishing-directory';
import {configurePublishingAliases,configurePublishingClubs} from '../../../shared/publishing-directory.mjs';
import '../scope-select.css';
let catalogOwner='',catalogPromise=null,catalogValue=null;
export function clearPublishingOptions(){catalogPromise=null;catalogValue=null;}
function loadOptions(owner){
 if(catalogOwner!==owner){catalogOwner=owner;clearPublishingOptions();}
 if(catalogValue)return Promise.resolve(catalogValue);
 if(!catalogPromise)catalogPromise=request('/publishing-options').then(result=>{if(catalogOwner===owner){catalogValue=result;configurePublishingAliases(result.departments);configurePublishingClubs(result.clubs);}return result;}).finally(()=>{if(catalogOwner===owner)catalogPromise=null;});
 return catalogPromise;
}
export default function ScopeSelect({kind='department',value='',onChange,department,label,required=false,disabled=false,allowBlank=true}){
 const {mode,data}=useCampus(),id=useId(),input=useRef(null),original=useRef(value),[text,setText]=useState(value || ''),[options,setOptions]=useState({departments:[],clubs:[]}),[loadError,setLoadError]=useState(''),[focused,setFocused]=useState(false);
 const profile=data?.profile || {},owner=String(profile.id || profile._id || '');
 useEffect(()=>{setText(value || '');original.current=value || '';},[value]);
 useEffect(()=>{
  let active=true;setLoadError('');
  if(mode==='demo'){setOptions({departments:profile.department?[{value:profile.department,label:profile.department,aliases:[]}]:[],clubs:profile.club?[{value:profile.club,label:profile.club,department:profile.department}]:[]});return()=>{active=false;};}
  loadOptions(owner).then(rows=>{if(active)setOptions(rows);}).catch(()=>{if(active)setLoadError('Publishing choices could not load. Retry when connected.');});
  return()=>{active=false;};
 },[mode,owner,profile.department,profile.club]);
 const result=scopeSelection(text,options,{kind,department,existingValue:original.current,required,allowBlank}),choices=scopeChoices(options,{kind,department});
 useEffect(()=>{input.current?.setCustomValidity(disabled?'':result.valid?'':result.message);},[disabled,result.valid,result.message]);
 function choose(next){setText(next);onChange(next);setFocused(false);input.current?.setCustomValidity('');}
 function change(next){setText(next);const match=scopeSelection(next,options,{kind,department,required,allowBlank});if(match.valid)onChange(match.value);}
 return <div className="field scope-select"><label htmlFor={id}>{label || (kind==='club'?'Club':'Department')}{required?' *':''}</label><input ref={input} id={id} type="text" list={`${id}-choices`} value={text} required={required || !allowBlank} disabled={disabled} maxLength={120} autoComplete="off" onFocus={()=>setFocused(true)} onBlur={()=>setFocused(false)} onChange={event=>change(event.target.value)} aria-invalid={!result.valid && !!text} aria-describedby={`${id}-hint`} placeholder={allowBlank && !required?'Search choices · blank for college':`Search known ${kind}s`}/><datalist id={`${id}-choices`}>{choices.map(row=><option key={`${row.department || ''}:${row.value}`} value={row.value}>{row.label}</option>)}</datalist><small id={`${id}-hint`} className={!result.valid && text?'scope-error':'muted'}>{loadError || (!result.valid && text?result.message:result.legacy?'Saved label retained. Choose a known option to change it.':kind==='club'?'Clubs belong to the selected department.':'Known aliases resolve to one department.')}</small>{!result.valid && result.suggestions.length && (focused || text)?<div className="scope-suggestions" aria-label={`${kind} suggestions`}>{result.suggestions.map(row=><button key={`${row.department || ''}:${row.value}`} type="button" onMouseDown={event=>event.preventDefault()} onClick={()=>choose(row.value)}>{row.label}</button>)}</div>:null}</div>;
}
