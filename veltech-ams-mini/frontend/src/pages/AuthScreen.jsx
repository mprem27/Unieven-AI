import {useState} from 'react';
import {GraduationCap,ShieldCheck,ArrowLeft,Mail,KeyRound} from 'lucide-react';
import {Button,Field,Feedback} from '../components/UI';
import {useCampus} from '../context/CampusContext';
import {request,setCsrf} from '../lib/api';
import '../identity.css';

export default function AuthScreen({onClose=()=>{},onSuccess,compact=false,initialTab='login',loginArea='',standaloneRecovery=false}) {
 const campus=useCampus();
 const [tab,setTab]=useState(initialTab==='reset'?'reset':'login'),[step,setStep]=useState('details'),[challenge,setChallenge]=useState('');
 const [form,setForm]=useState({identity:'',email:'',password:'',confirm:'',code:''});
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[success,setSuccess]=useState('');
 const update=(key,value)=>setForm(current=>({...current,[key]:value}));
 const changeTab=value=>{setTab(value);setStep('details');setChallenge('');setError('');setSuccess('');setForm(current=>({...current,password:'',confirm:'',code:''}));};
 async function submit(event){
  event.preventDefault();setBusy(true);setError('');setSuccess('');
  try {
   if(tab==='login') {if(await campus.signIn(form.identity,form.password,loginArea)){setForm(current=>({...current,password:''}));onClose();onSuccess?.();}return;}
   if(step==='details'){
    const result=await request('/identity/reset/request',{method:'POST',body:{email:form.email}});
    setChallenge(result.challengeId);setStep('code');setForm(current=>({...current,password:'',confirm:'',code:''}));setSuccess(result.message);return;
   }
   if(step==='code'){
    const result=await request('/identity/reset/verify',{method:'POST',body:{challengeId:challenge,code:form.code}});
    setForm(current=>({...current,code:''}));setStep('password');setSuccess(result.message);return;
   }
   if(form.password!==form.confirm)throw new Error('The new passwords do not match.');
   const result=await request('/identity/reset/complete',{method:'POST',body:{password:form.password}});
   setCsrf('');campus.switchDemo?.();changeTab('login');setSuccess(result.message);
  } catch(error){setError(error.message || 'Please retry.');}
  finally {setBusy(false);}
 }
 const content=<section className="identity-form-panel">
  <div className="identity-form-brand"><img src="/assets/original-logo.png" alt="veltech-ams-mini logo"/><span>veltech-ams-mini<small>Your campus, connected.</small></span></div>
  <div className="identity-heading"><span className="identity-step-icon">{step==='code'?<Mail size={23}/>:tab==='reset'?<KeyRound size={23}/>:<GraduationCap size={24}/>}</span><h1>{step==='code'?'Check your recovery email':step==='password'?'Choose an application password':tab==='login'?(loginArea==='admin'?'Administrator sign in':loginArea==='faculty'?'Faculty sign in':'Application sign-in'):'Recover application access'}</h1><p>{step==='code'?'Enter the six-digit code within five minutes. Keep this browser open.':tab==='login'?(loginArea?'Use the account issued by your college administrator.':'Use a provisioned account or your recovered application password.'):'Use your college VTU email or a recovery email you verified in Settings. This changes your application password; your AMS password stays the same.'}</p></div>
  <form onSubmit={submit} className="identity-form">
   {step==='details' && tab==='login'?<><Field label="Recovery email or provisioned email / username" autoComplete="username" value={form.identity} maxLength={200} required onChange={event=>update('identity',event.target.value)}/><Field label="Application password" type="password" autoComplete="current-password" value={form.password} maxLength={100} required onChange={event=>update('password',event.target.value)}/></>:null}
   {step==='details' && tab==='reset'?<Field label="College or verified recovery email" type="email" autoComplete="email" value={form.email} maxLength={254} required onChange={event=>update('email',event.target.value)}/>:null}
   {step==='code'?<Field label="Six-digit email code" className="identity-code" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} value={form.code} required autoFocus onChange={event=>update('code',event.target.value.replace(/\D/g,''))}/>:null}
   {step==='password'?<><Field label="New application password · at least 10 characters" type="password" autoComplete="new-password" value={form.password} minLength={10} maxLength={72} required onChange={event=>update('password',event.target.value)}/><Field label="Confirm new application password" type="password" autoComplete="new-password" value={form.confirm} minLength={10} maxLength={72} required onChange={event=>update('confirm',event.target.value)}/></>:null}
   <Feedback error={error} success={success}/><Button type="submit" busy={busy}>{tab==='login'?'Sign in':step==='details'?'Send verification code':step==='code'?'Verify email':'Save application password'}</Button>
  </form>
  {!(standaloneRecovery && tab==='reset' && step==='details')?<div className="identity-assistance">{tab==='login'?<button className="text-button" onClick={()=>changeTab('reset')} disabled={busy}>Recover application password</button>:<button className="text-button" onClick={()=>changeTab(step==='details'?'login':'reset')} disabled={busy}><ArrowLeft size={15}/>{step==='details'?'Back to sign in':'Start again'}</button>}</div>:null}
  <p className="identity-security"><ShieldCheck size={16}/>Accounts are created through AMS sign-in or administrator provisioning. Application password resets sign out your devices.</p>
 </section>;
 if(compact)return <div className="identity-compact">{content}</div>;
 return <main className="identity-page"><aside className="identity-art"><div className="identity-orbit"/><img src="/assets/original-logo.png" alt=""/><span className="identity-eyebrow">ONE CONNECTED CAMPUS</span><h2>Study. Discover.<br/>Belong.</h2><p>Classes and attendance, memorable events, and a community that moves you forward.</p><div className="identity-art-footer"><ShieldCheck size={20}/><span>Your student records stay in your own account.</span></div></aside>{content}</main>;
}
