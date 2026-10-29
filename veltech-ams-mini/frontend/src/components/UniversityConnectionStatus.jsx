import {useEffect,useState} from 'react';
import {RefreshCw,ExternalLink} from 'lucide-react';
import {request} from '../lib/api';
import {SectionTitle,Button,Badge,Feedback} from './UI';
export default function UniversityConnectionStatus(){
 const [status,setStatus]=useState(null),[error,setError]=useState(''),[busy,setBusy]=useState(false);
 const load=async()=>{setBusy(true);setError('');try {setStatus(await request('/university/sources'));}catch(e){setError(e.message);}finally{setBusy(false);}};
 useEffect(()=>{void load();},[]);
 const labels={ams:['University portal (AMS)','Source of your private university records'],home:['Home of VelTech app','Separate student-developed app · its listing describes direct AMS access'],website:['University website','Public campus news'],student:['Student ERP','Official browser sign-in; verification may be required']};
 return <section className="panel settings-section"><SectionTitle title="University source websites"/><div className="source-status-list">{status?.sources.map(source=><div key={source.id}><div><h3>{labels[source.id]?.[0] || source.id}</h3><small>{labels[source.id]?.[1]}</small></div><Badge status={source.providerType==='reference'?'neutral':source.requiresCaptcha?'payment_pending':source.reachable?'present':'absent'}>{source.providerType==='reference'?'Reference app':source.requiresCaptcha?'Verification required':source.reachable?'Public page reachable':`Unavailable${source.httpStatus?` · ${source.httpStatus}`:''}`}</Badge><a href={source.url} target="_blank" rel="noopener noreferrer" aria-label={`Open ${labels[source.id]?.[0] || source.id}`}><ExternalLink size={17}/></a></div>)}</div><Feedback error={error}/><div className="source-status-footer"><small className="muted">{status?`Checked ${new Date(status.checkedAt).toLocaleString('en-IN',{timeZone:'Asia/Kolkata'})}`:'Checking official sources…'} · A reachable public page does not confirm your sign-in or a successful university sync.</small><Button variant="ghost" busy={busy} onClick={load}><RefreshCw size={15}/>Check sources</Button></div></section>;
}
