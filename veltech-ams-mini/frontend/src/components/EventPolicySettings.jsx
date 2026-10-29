import {useState} from 'react';
import {useLiveResource} from '../hooks/useLiveResource';
import {request} from '../lib/api';
import {useCampus} from '../context/CampusContext';
import {hasAdminAction} from '../../../shared/admin-access.mjs';
import {Button,Field,Feedback} from './UI';
export default function EventPolicySettings(){
 const {data}=useCampus(),resource=useLiveResource('/event-policy'),[months,setMonths]=useState(''),[error,setError]=useState(''),[busy,setBusy]=useState(false),[saved,setSaved]=useState(false);
 if(!hasAdminAction(data.profile,'events','view'))return null;
 async function save(e){e.preventDefault();setBusy(true);setError('');try{await request('/event-policy',{method:'PUT',body:{eventExpiryMonths:Number(months || resource.value?.eventExpiryMonths || 6)}});await resource.reload();setSaved(true);}catch(e){setError(e.message);}finally{setBusy(false);}}
 return <section className="panel settings-section"><h2>Event history & expiry</h2><p>Expiry removes listings and closes registration. Event records, tickets and payment history stay saved.</p><form onSubmit={save}><Field label="Default months after an event" type="number" min={1} max={120} value={months || resource.value?.eventExpiryMonths || 6} onChange={e=>{setMonths(e.target.value);setSaved(false);}}/><Button type="submit" busy={busy} disabled={!hasAdminAction(data.profile,'events','update')}>Save event policy</Button></form><Feedback error={error || resource.error} success={saved?'New events will use this default. Existing expiry dates stay as assigned.':''}/></section>;
}
