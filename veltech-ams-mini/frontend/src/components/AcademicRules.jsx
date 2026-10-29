import {useEffect,useState} from 'react';
import {BookOpen,ExternalLink,Info} from 'lucide-react';
import {academicRuleContext,officialGradeScale,officialRegulations} from '../../../shared/percentage-rules.mjs';
import {officialStudentProfile} from '../lib/social-profile';
import {request} from '../lib/api';
import './academic-rules.css';
const formula=rule=>rule.offset?`(CGPA − ${rule.offset}) × ${rule.factor}`:`CGPA × ${rule.factor}`;
export default function AcademicRules({profile={},mode='connected'}){
 const online=globalThis.navigator?.onLine!==false;
 const [revision,setRevision]=useState(0);
 const owner=String(profile.id || ''),official=officialStudentProfile(profile,mode);
 const [policyState,setPolicyState]=useState({owner:'',rules:[],status:'idle'});
 useEffect(()=>{
  if(mode!=='connected' || !owner)return;
  if(!online){setPolicyState({owner,rules:[],status:'unavailable'});return;}
  const abort=new AbortController();setPolicyState({owner,rules:[],status:'loading'});
  request('/academic-rules',{signal:abort.signal}).then(result=>{if(!abort.signal.aborted)setPolicyState({owner,rules:Array.isArray(result?.rules)?result.rules:[],status:Array.isArray(result?.rules)?'loaded':'unavailable'});}).catch(()=>{if(!abort.signal.aborted)setPolicyState({owner,rules:[],status:'unavailable'});});
  return()=>abort.abort();
 },[owner,mode,online,revision]);
 const policies=policyState.owner===owner && mode==='connected'?policyState.rules:[],ready=mode!=='connected' || policyState.owner===owner && policyState.status==='loaded',checking=policyState.status!=='unavailable',reference=academicRuleContext(official,{policies}),context=ready?reference:{...reference,rule:null,source:'unavailable',status:checking?'policy-pending':'policy-unavailable',reason:checking?'Checking administrator-confirmed rules before applying a conversion.':'Administrator-confirmed rules could not be checked. Connect to verify the applicable conversion.'},scale=officialGradeScale(official),blocked=['ambiguous','invalid','policy-pending','policy-unavailable'].includes(context.status);
 return <section className="academic-rules-page">
  <header className="academic-rules-heading"><span className="academic-rules-icon"><BookOpen size={22}/></span><div><h2>Your academic rules</h2><p>Published AMS values take priority. Your official programme and regulation determine which documented rules apply.</p></div></header>
  {mode==='demo'?<p className="academic-rules-preview">Sample profile · this preview does not verify a real student's regulation.</p>:null}
  <dl className="academic-rules-profile">{[['Programme',official.degree || official.programme],['Department',official.department || official.branch],['Batch',official.batch],['Regulation',official.regulation]].map(([label,value])=><div key={label}><dt>{label}</dt><dd>{value || 'Not available from AMS'}</dd></div>)}</dl>
  <article className={`academic-rules-status ${blocked?'academic-rules-conflict':''}`}>
   {!ready?<p className="academic-rules-note">Project estimates and documented conversions are withheld until administrator rules can be checked.</p>:null}
   {!ready && (!official.regulation || reference.status==='unverified')?<p className="academic-rules-note">{reference.reason}</p>:null}
   <h3>{context.status==='policy-pending'?'Checking your academic rules':context.status==='policy-unavailable'?'Connect to check your rules':blocked?'Rule review needed':context.rule?'Matching source found':context.regulation?'Regulation found · conversion unverified':'Check your regulation'}</h3><p>{context.reason}</p>
   {context.rule?<><p className="academic-rules-equation">Equivalent percentage = {formula(context.rule)}</p><p>{context.source==='legacy-rule'?'Administrator-confirmed legacy cohort rule. Department scope was not recorded.':context.source==='batch-rule'?'Administrator-confirmed rule for this exact academic scope.':'Documented university regulation.'}</p><a href={context.rule.sourceUrl} target="_blank" rel="noopener noreferrer">{context.rule.regulation} · {context.rule.sourceClause}<ExternalLink size={14}/></a></>:!blocked?<div className="academic-rules-estimate"><strong>Project estimate</strong><p>When no confirmed conversion applies, the app can show (CGPA − 0.5) × 10. This is a project estimate; its applicability is not university-verified.</p></div>:null}
   {policyState.owner===owner && policyState.status==='loading'?<p role="status">Checking administrator-confirmed rules…</p>:null}
   {policyState.owner===owner && policyState.status==='unavailable'?<p className="academic-rules-note">Administrator-confirmed rules could not be checked. The public documents below remain available; reconnect to check additional policies.</p>:null}{mode==='connected' && policyState.status==='unavailable' && online?<button type="button" onClick={()=>setRevision(value=>value+1)}>Retry rules</button>:null}
  </article>
  {scale.length?<section className="academic-rules-scale"><h3>Reference grade points · {context.regulation.regulation}</h3><p>Published course points take priority. This reference does not resolve repeat attempts, missing credits or non-credit courses.</p><div className="academic-rules-grades">{scale.map(row=><span key={row.grade}><strong>{row.grade}</strong><span>{row.points} points</span></span>)}</div><a href={context.regulation.sourceUrl} target="_blank" rel="noopener noreferrer">{context.regulation.gradeClause}<ExternalLink size={14}/></a></section>:null}
  <section className="academic-rules-library"><h3>University source documents</h3><p>Effective years describe each document. A batch year alone does not establish your regulation.</p><div className="academic-rules-documents">{officialRegulations.map(rule=><details key={rule.id} open={context.regulation?.id===rule.id}>
   <summary><span><strong>{rule.regulation}</strong><small>{rule.programme} · {rule.factor===null?'Conversion unverified':formula(rule)}</small></span></summary><div className="academic-rules-document-body"><p>{rule.scope}</p><p>{rule.applicabilityQuote}</p><small>{rule.applicabilityClause}</small><blockquote>{rule.sourceQuote}</blockquote><a href={rule.sourceUrl} target="_blank" rel="noopener noreferrer">{rule.sourceClause}<ExternalLink size={14}/></a></div>
  </details>)}</div><a href="https://www.veltech.edu.in/academic-regulations/" target="_blank" rel="noopener noreferrer">All published university regulations<ExternalLink size={14}/></a></section>
  <p className="academic-rules-note"><Info size={16}/>Source review: 29 October 2026. Ask your department or the Controller of Examinations when the reported regulation or its applicability is unclear.</p>
 </section>;
}
