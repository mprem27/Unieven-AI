import axios from 'axios';
import {clearWorkspaceCache,hasPendingServerLogout,finishLocalLogout} from './workspace-cache.js';
import {clearDeviceDownloads} from './device-downloads.js';
let csrf='',account='',accountGeneration=0,readOnly=false,logoutReconciliation=null;
const activeReads=new Map();
export function setCsrf(token){csrf=token || '';}
export function setApiReadOnly(value){readOnly=!!value;}
export function setApiOwner(owner){const next=String(owner || '');if(next!==account){account=next;accountGeneration++;}}
function dispatch(type,owner){if(typeof window!=='undefined')window.dispatchEvent(new CustomEvent(type,{detail:{owner}}));}
export function reconcileLocalLogout(){
 if(logoutReconciliation)return logoutReconciliation;
 if(!hasPendingServerLogout() || globalThis.navigator?.onLine===false)return Promise.resolve(false);
 setApiOwner('');setCsrf('');setApiReadOnly(false);
 const work=(async()=>{
  try{
   const session=await request('/session');setCsrf(session.csrfToken);
   await request('/logout',{method:'POST',body:{},timeout:5000});finishLocalLogout();return true;
  }catch(error){if(error.status===401){finishLocalLogout();return true;}return false;}
  finally{setCsrf('');}
 })();
 logoutReconciliation=work;const clear=()=>{if(logoutReconciliation===work)logoutReconciliation=null;};work.then(clear,clear);return work;
}
// Coalesce only equivalent ordinary JSON reads. Each caller owns its abort;
// one unmount cannot cancel another mounted consumer's private request.
export function request(path,options={}){
 const {signal,...transport}=options;
 const share=(!options.method || options.method.toUpperCase()==='GET') && !options.body && !options.headers && Object.keys(transport).every(key=>['method','timeout'].includes(key));
 if(!share)return performRequest(path,options);
 if(signal?.aborted)return Promise.reject(new axios.CanceledError('Request canceled.'));
 const key=JSON.stringify([accountGeneration,path,transport.timeout || null]);
 let run=activeReads.get(key);
 if(!run || run.abort.signal.aborted){
  const abort=new AbortController();run={abort,consumers:0,promise:performRequest(path,{...transport,signal:abort.signal})};activeReads.set(key,run);
  const clear=()=>{if(activeReads.get(key)===run)activeReads.delete(key);};run.promise.then(clear,clear);
 }
 run.consumers++;
 return new Promise((resolve,reject)=>{
  let finished=false;
  const finish=(callback,value)=>{if(finished)return;finished=true;signal?.removeEventListener('abort',cancel);run.consumers--;callback(value);};
  const cancel=()=>{finish(reject,new axios.CanceledError('Request canceled.'));if(!run.consumers){if(activeReads.get(key)===run)activeReads.delete(key);run.abort.abort();}};
  signal?.addEventListener('abort',cancel,{once:true});
  run.promise.then(value=>finish(resolve,value),error=>finish(reject,error));
 });
}
async function performRequest(path,{body,method='GET',headers,...options}={}){
 if(method.toUpperCase()==='POST' && /^\/(?:login(?:\/|$)|portal\/(?:sign-in|challenge)$)/.test(path) && hasPendingServerLogout()){
  if(!await reconcileLocalLogout())throw new Error('Connect to finish signing out of the previous session, then sign in again.');
 }
 const expectedOwner=account,generation=accountGeneration;
 if(!['GET','HEAD'].includes(method.toUpperCase()) && (readOnly || globalThis.navigator?.onLine===false))throw new Error('Your saved workspace is read-only. Connect and verify your session before making changes.');
 const timeout=path==='/session'?5000:['/portal/sign-in','/portal/login'].includes(path)?135000:path==='/academics/overview'?20000:path==='/academics/sync-status'?8000:method.toUpperCase()==='GET'?12000:60000;
 if(generation!==accountGeneration)throw new axios.CanceledError('The campus account changed.');
 try{
  const {data}=await axios.request({baseURL:'/api/campus',url:path,method,data:body,withCredentials:true,timeout,...options,headers:{...(csrf?{'X-CSRF-Token':csrf}:{}),...(expectedOwner?{'X-Campus-Account':expectedOwner}:{}),...headers}});
  if(generation!==accountGeneration)throw new axios.CanceledError('The campus account changed.');
  if(typeof data==='string' && /^\s*</.test(data))throw new Error('The campus API is unavailable. Start the API server and retry.');
  return data;
 }catch(error){
  if(generation!==accountGeneration)throw new axios.CanceledError('The campus account changed.');
  if(axios.isCancel(error))throw error;
  const response=error.response,timedOut=['ECONNABORTED','ETIMEDOUT'].includes(error.code);
  const changed=response?.data?.code==='ACCOUNT_CHANGED',revoked=response?.status===401 && !/^\/(?:login|portal\/sign-in|register|password)(?:\/|$)/.test(path) && (expectedOwner || path==='/session');
  if(changed || revoked){
   await Promise.allSettled([clearWorkspaceCache(),...(expectedOwner?[clearDeviceDownloads(expectedOwner)]:[])]);
   if(generation!==accountGeneration)throw new axios.CanceledError('The campus account changed.');
   dispatch(changed?'campus:account-changed':'campus:session-revoked',expectedOwner);
  }
  const message=response?.data?.message || response?.data?.detail;
  const failure=new Error(timedOut?'The server is taking longer than expected. Please try again.':typeof message==='string'?message:(response?'The request could not be completed.':error.code==='ERR_NETWORK'?'Could not reach the server. Check your connection and try again.':error.message || 'The API is unavailable.'));
  failure.status=response?.status;failure.code=timedOut?'REQUEST_TIMEOUT':error.code;
  const retry=Number(response?.headers?.['retry-after']);
  if([429,503].includes(failure.status) && Number.isInteger(retry) && retry>0 && retry<=300)failure.retryAfter=retry;
  throw failure;
 }
}
