import {androidInstallation} from './app-release.js';
// Module memory preserves browser-verified evidence through SPA navigation. Never
// restore an installation/version claim from writable browser storage.
export function captureAndroidLaunch(launch={}){return Object.freeze(androidInstallation(launch));}
export const androidLaunch=captureAndroidLaunch(typeof document==='undefined'?{}:{referrer:document.referrer,search:location.search});
const key=(owner,release)=>`campus:update-later:${encodeURIComponent(owner)}:${encodeURIComponent(release)}`;
export function updateDeferred(storage,owner,release,now=Date.now()){try{const until=Number(storage.getItem(key(owner,release)));return Number.isFinite(until) && until>now;}catch{return false;}}
export function deferUpdate(storage,owner,release,now=Date.now()){try{storage.setItem(key(owner,release),String(now+86400000));}catch{}}
// Kept as a non-destructive compatibility hook. Active and waiting Workbox
// workers can share the same precache; neither cache names nor versions prove
// that a cache is safe to delete. Asset refresh must use the worker lifecycle.
export async function clearDisposableAppCaches(){return;}
function installedWorker(registration){
 const worker=registration.installing;
 if(!worker)return Promise.resolve();
 return new Promise((resolve,reject)=>{
  const finish=error=>{clearTimeout(timer);worker.removeEventListener('statechange',changed);error?reject(error):resolve();};
  const changed=()=>{if(worker.state==='installed' || worker.state==='activated')finish();else if(worker.state==='redundant')finish(new Error('The web update was replaced. Check again.'));};
  const timer=setTimeout(()=>finish(new Error('The web update is still downloading. Please try again.')),30000);
  worker.addEventListener('statechange',changed);changed();
 });
}
export async function refreshAppAssets({serviceWorker=globalThis.navigator?.serviceWorker,reload=()=>globalThis.location.reload(),worker=null}={}){
 if(globalThis.navigator?.onLine===false)throw new Error('Connect to the internet before refreshing app assets.');
 const registration=await serviceWorker?.getRegistration();
 if(registration){await registration.update();await installedWorker(registration);}
 const waiting=registration?.waiting || worker;
 if(!waiting){reload();return;}
 if(waiting.state==='redundant')throw new Error('The web update was replaced. Check again.');
 await new Promise((resolve,reject)=>{
  const changed=()=>{clearTimeout(timer);serviceWorker.removeEventListener('controllerchange',changed);reload();resolve();};
  const timer=setTimeout(()=>{serviceWorker.removeEventListener('controllerchange',changed);reject(new Error('Update activation is taking longer than expected. Please try again.'));},30000);
  serviceWorker.addEventListener('controllerchange',changed);
  try{waiting.postMessage({type:'SKIP_WAITING'});}catch(error){clearTimeout(timer);serviceWorker.removeEventListener('controllerchange',changed);reject(error);}
 });
}
