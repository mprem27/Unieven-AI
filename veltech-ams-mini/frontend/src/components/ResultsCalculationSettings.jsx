import {useEffect,useState} from 'react';
import {Calculator,Save} from 'lucide-react';
import {calculationSchemes} from '../lib/result-calculation';
import {Button,Field} from './UI';

export default function ResultsCalculationSettings({value,onSave}){
 const [draft,setDraft]=useState(value),[message,setMessage]=useState(''),[error,setError]=useState('');
 useEffect(()=>setDraft(value),[value]);
 function submit(event){event.preventDefault();setError('');setMessage('');try{onSave(draft);setMessage('Calculation updated.');}catch(e){setError(e.message);}}
 return <details className="results-calculation-settings"><summary><Calculator size={16}/><span>Calculation rules</span><small>10-point grade estimate</small></summary><form onSubmit={submit}><p>Published AMS values take priority. Otherwise, estimates use the scale below and all available course credits. Choose the scale that applies to your regulation.</p><div className="results-calculation-fields"><Field label="Grade-point calculation"><select value={draft.scheme} onChange={event=>{setDraft(old=>({...old,scheme:event.target.value}));setMessage('');}}>{Object.entries(calculationSchemes).map(([id,scheme])=><option key={id} value={id}>{scheme.label}</option>)}</select></Field></div><div className="results-scale-values">{Object.entries(calculationSchemes[draft.scheme].grades).map(([grade,points])=><span key={grade}><b>{grade}</b>{points}</span>)}</div><p className="muted">Fallback project estimate: (CGPA − 0.5) × 10. Published percentages and matching university or administrator-confirmed rules take priority. The separate calculator supports your own calculations.</p><Button type="submit" variant="secondary"><Save size={14}/>Update calculation</Button>{message?<p role="status">{message}</p>:null}{error?<p role="alert">{error}</p>:null}</form></details>;
}
