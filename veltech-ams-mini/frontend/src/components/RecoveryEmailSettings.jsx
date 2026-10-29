import {useEffect,useRef,useState} from 'react';
import {useCampus} from '../context/CampusContext';
import {request} from '../lib/api';
import {Button,Field,Feedback} from './UI';

export default function RecoveryEmailSettings(){
 const {mode,data,refresh}=useCampus(),accountId=data.profile.id;
 const [saved,setSaved]=useState(''),[email,setEmail]=useState(''),[code,setCode]=useState(''),[challenge,setChallenge]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState(''),[success,setSuccess]=useState('');
 const pending=useRef(null),generation=useRef(0);
 useEffect(()=>{
  const ticket=++generation.current;pending.current?.abort();const abort=new AbortController();pending.current=abort;
  setSaved('');setEmail('');setCode('');setChallenge('');setBusy(false);setError('');setSuccess('');
  if(mode==='connected')void request('/identity/recovery',{signal:abort.signal}).then(result=>{if(generation.current===ticket&&!abort.signal.aborted){setSaved(result.recoveryEmail || '');setEmail(result.recoveryEmail || '');}}).catch(e=>{if(!abort.signal.aborted&&generation.current===ticket)setError(e.message);});
  return()=>{abort.abort();generation.current++;};
 },[mode,accountId]);
 async function submit(event){
  event.preventDefault();const ticket=generation.current;pending.current?.abort();const abort=new AbortController();pending.current=abort;setBusy(true);setError('');setSuccess('');
  try{
   const result=await request(`/identity/recovery/${challenge?'verify':'request'}`,{method:'POST',body:challenge?{challengeId:challenge,code}:{email},signal:abort.signal});
   if(abort.signal.aborted||generation.current!==ticket)return;
   if(challenge){setSaved(result.recoveryEmail);setEmail(result.recoveryEmail);setChallenge('');setCode('');setSuccess(result.message);void refresh();}
   else {setChallenge(result.challengeId);setCode('');setSuccess('Enter the code sent to your new recovery email. Your current recovery email stays active until verification.');}
  }catch(e){if(!abort.signal.aborted&&generation.current===ticket)setError(e.message);}
  finally{if(!abort.signal.aborted&&generation.current===ticket)setBusy(false);}
 }
 return <section className="card recovery-email-settings"><h3>Recovery email</h3><p className="muted">Recover your application password with a verified email. Your official AMS email and AMS password stay unchanged.</p>{mode!=='connected'?<p>Sign in to add a recovery email.</p>:<><p><strong>{saved || 'No verified recovery email yet'}</strong></p><form onSubmit={submit}><Field label="Recovery email" type="email" autoComplete="email" maxLength={254} required value={email} disabled={busy||!!challenge} onChange={event=>setEmail(event.target.value)}/>{challenge?<Field label="Six-digit verification code" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} required value={code} disabled={busy} onChange={event=>setCode(event.target.value.replace(/\D/g,''))}/>:null}<Feedback error={error} success={success}/><Button type="submit" busy={busy} disabled={!challenge&&email.trim().toLowerCase()===saved}>{challenge?'Verify recovery email':'Send verification code'}</Button>{challenge?<button type="button" className="text-button" disabled={busy} onClick={()=>{setChallenge('');setCode('');setError('');setSuccess('');}}>Use another email</button>:null}</form></>}</section>;
}
