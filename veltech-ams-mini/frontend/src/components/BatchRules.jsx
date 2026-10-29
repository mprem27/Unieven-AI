import {useEffect,useRef,useState} from 'react';
import {request} from '../lib/api';
import {useCampus} from '../context/CampusContext';
import {legacyPercentagePolicy,officialRegulationUrl} from '../../../shared/percentage-rules.mjs';
import {Button,Field,Feedback} from './UI';
import './academic-rules.css';
const empty=()=>({id:'',batch:'',programme:'B.Tech',regulation:'',departmentScope:'',department:'',factor:'',offset:'0',sourceUrl:'',sourceClause:'',confirmed:false});
export default function BatchRules(){
 const {mode,data}=useCampus(),owner=String(data.profile?.id || ''),generation=useRef(0);
 const [state,setState]=useState({owner:'',rules:[]}),[draft,setDraft]=useState(empty),[error,setError]=useState(''),[success,setSuccess]=useState(''),[busy,setBusy]=useState(false);
 useEffect(()=>{
  const token=++generation.current,abort=new AbortController();setDraft(empty());setError('');setSuccess('');setBusy(false);setState({owner,rules:[]});
  if(mode==='connected')request('/academic-rules',{signal:abort.signal}).then(result=>{if(!abort.signal.aborted && generation.current===token)setState({owner,rules:Array.isArray(result.rules)?result.rules:[]});}).catch(e=>{if(!abort.signal.aborted && generation.current===token)setError(e.message);});
  return()=>{abort.abort();generation.current++;};
 },[mode,owner]);
 async function submit(event){
  event.preventDefault();const token=generation.current;setBusy(true);setError('');setSuccess('');
  try{
   if(!draft.departmentScope || !draft.offset.trim() || !draft.factor.trim())throw new Error('Choose the source department scope and enter both formula values.');
   const {id,...fields}=draft;
   await request('/academic-rules',{method:'POST',body:{...fields,...(id?{id}:{}),factor:Number(draft.factor),offset:Number(draft.offset)}});
   const result=await request('/academic-rules');
   if(generation.current===token){setState({owner,rules:result.rules || []});setDraft(empty());setSuccess('Academic rule saved.');}
  }catch(e){if(generation.current===token)setError(e.message);}finally{if(generation.current===token)setBusy(false);}
 }
 const field=(key,label,type='text')=><Field label={label}><input type={type} value={draft[key]} onChange={e=>setDraft(old=>({...old,[key]:e.target.value}))} required maxLength={key==='sourceUrl'?1500:250} step={type==='number'?'any':undefined}/></Field>;
 const rules=state.owner===owner?state.rules:[];
 return <section className="panel academic-rules-editor"><h2>Academic percentage rules</h2><p>Published AMS percentages take priority. Confirm a formula and its exact programme, batch, regulation and department scope from an official source. Overlapping or conflicting matches are shown as unavailable.</p><p className="academic-rules-note">Without a confirmed match, (CGPA − 0.5) × 10 is labelled a project estimate. Saving a link records your confirmation; it does not independently verify the document.</p><Feedback error={error} success={success}/>
  <form className="academic-rules-form" onSubmit={submit}>
   {field('batch','Batch · admission–completion year')}{field('programme','Programme')}{field('regulation','Exact regulation / circular')}
   <Field label="Department scope in the official source"><select required value={draft.departmentScope} onChange={e=>setDraft(old=>({...old,departmentScope:e.target.value,...(e.target.value==='all'?{department:''}:{})}))}><option value="">Choose scope</option><option value="department">One department</option><option value="all">All departments in this programme</option></select></Field>
   {draft.departmentScope==='department'?field('department','Exact department'):null}{field('factor','Multiplier','number')}{field('offset','CGPA offset','number')}
   <div className="academic-rules-form-wide">{field('sourceUrl','Official university source URL','url')}</div>
   <div className="academic-rules-form-wide"><Field label="Clause / page and applicability evidence"><textarea value={draft.sourceClause} onChange={e=>setDraft(old=>({...old,sourceClause:e.target.value}))} required maxLength={1000} rows={3}/></Field></div>
   <p className="academic-rules-form-wide academic-rules-equation">Percentage = (CGPA − {draft.offset || 'offset'}) × {draft.factor || 'multiplier'}</p>
   <label className="academic-rules-form-wide academic-rules-confirm"><input type="checkbox" checked={draft.confirmed} onChange={e=>setDraft(old=>({...old,confirmed:e.target.checked}))} required/>I checked this formula and its programme, batch, regulation and department applicability in the linked official document.</label>
   <div className="academic-rules-form-wide academic-rules-actions"><Button type="submit" busy={busy} disabled={mode!=='connected'}>{draft.id?'Save reviewed rule':'Save academic rule'}</Button>{draft.id?<Button type="button" variant="secondary" disabled={busy} onClick={()=>setDraft(empty())}>Cancel edit</Button>:null}</div>
  </form>
  <div className="academic-rules-admin-list">{rules.map(rule=>{
   const legacy=rule.legacy || legacyPercentagePolicy(rule),url=officialRegulationUrl(rule.sourceUrl),date=new Date(rule.verifiedAt);
   return <article key={rule.id}><div><strong>{rule.batch} · {rule.programme}</strong><p>{rule.regulation} · {legacy?'Legacy cohort rule · department scope not recorded':rule.departmentScope==='all'?'All departments':rule.department}</p><p>Percentage = (CGPA − {rule.offset}) × {rule.factor}</p>{url?<a href={url} target="_blank" rel="noopener noreferrer">{rule.sourceClause || 'Official source'}</a>:<small>Source URL needs review</small>}<small>Administrator confirmed {Number.isFinite(date.getTime())?date.toLocaleDateString('en-IN'):'date unavailable'}</small></div><Button type="button" variant="secondary" disabled={busy} onClick={()=>{setDraft({id:rule.id,batch:rule.batch,programme:rule.programme,regulation:rule.regulation,departmentScope:legacy?'':rule.departmentScope,department:rule.department || '',factor:String(rule.factor),offset:String(rule.offset),sourceUrl:rule.sourceUrl,sourceClause:rule.sourceClause,confirmed:false});setSuccess('');setError('');}}>{legacy?'Review scope':'Edit rule'}</Button></article>;
  })}</div>
 </section>;
}
