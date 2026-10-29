// Apply independent sections as they arrive; an old account never receives them.
export async function loadWorkspace(paths,read,{isCurrent,onValue,onFailure=()=>{}}){
 return Promise.allSettled(paths.map(async path=>{
  try{const value=await read(path);if(isCurrent())onValue(path,value);return value;}
  catch(error){if(isCurrent())onFailure(path,error);throw error;}
 }));
}

// Share an active owner read only within the same cancellation lifetime.
// The API transport coalesces independent signals without coupling their aborts.
export function createWorkspaceReader(read){
 let pending=null;
 return (owner,options={})=>{
  if(pending?.owner===owner && pending.signal===options.signal && !pending.signal?.aborted)return pending.promise;
  const promise=Promise.resolve().then(()=>read(options));
  const run={owner,signal:options.signal,promise};pending=run;
  const clear=()=>{if(pending===run)pending=null;};promise.then(clear,clear);
  return promise;
 };
}

// Share active owner-qualified reads across mounted consumers, never results.
export function createResourceReader(read){
 const pending=new Map();
 return (owner,path)=>{
  const key=JSON.stringify([owner,path]);if(pending.has(key))return pending.get(key);
  const promise=Promise.resolve().then(()=>read(path));pending.set(key,promise);
  const clear=()=>{if(pending.get(key)===promise)pending.delete(key);};promise.then(clear,clear);return promise;
 };
}

// AMS advances lastSuccessAt only after committing module data. Progress,
// retries and retained-source errors must not invalidate the full snapshot.
export function academicContentKey(status={}){
 return JSON.stringify((status?.modules || []).filter(row=>row.lastSuccessAt).map(row=>[row.id,row.lastSuccessAt,row.recordCount]).sort((a,b)=>String(a[0]).localeCompare(String(b[0]))));
}
export function mergeWorkspace(previous,patch){
 let next=previous;
 for(const [key,value] of Object.entries(patch)){
  if(previous[key]===value || typeof value==='object' && JSON.stringify(previous[key])===JSON.stringify(value))continue;
  if(next===previous)next={...previous};next[key]=value;
 }
 return next;
}
// Independent campus publications keep updating without reloading identity,
// academic snapshots or social relationship state.
export function startCampusRefresh({refreshSeconds,isCurrent,read,onValue,documentTarget=globalThis.document,windowTarget=globalThis.window,schedule=setTimeout,unschedule=clearTimeout,now=Date.now}){
 if(!refreshSeconds)return()=>{};
 const interval=Math.max(30000,refreshSeconds*1000),paths=['/events','/registrations','/placements','/notices'];
 let stopped=false,working=false,timer,failures=0,next=now()+interval;
 const current=()=>!stopped && isCurrent();
 const later=delay=>{if(current()){unschedule(timer);timer=schedule(poll,delay);}};
 const poll=async()=>{
  if(!current() || working)return;
  if(documentTarget.visibilityState==='hidden' || globalThis.navigator?.onLine===false || now()<next){later(Math.max(30000,next-now()));return;}
  working=true;
  try{
   const results=await Promise.allSettled(paths.map(async path=>{const value=await read(path);if(current())onValue(path,value);}));
   failures=results.some(result=>result.status==='rejected')?failures+1:0;
   next=now()+(failures?Math.min(120000,interval*2**Math.min(failures,4)):interval);
  }finally{working=false;}
  later(Math.max(1000,next-now()));
 };
 const resume=()=>{if(documentTarget.visibilityState!=='hidden' && globalThis.navigator?.onLine!==false && now()>=next)void poll();};
 later(interval);documentTarget.addEventListener('visibilitychange',resume);windowTarget.addEventListener('focus',resume);windowTarget.addEventListener('online',resume);
 return()=>{stopped=true;unschedule(timer);documentTarget.removeEventListener('visibilitychange',resume);windowTarget.removeEventListener('focus',resume);windowTarget.removeEventListener('online',resume);};
}

// This controller owns both manual and automatic source admission. The server
// remains authoritative for owner binding, cooldown, client expiry and job slots.
export function startAcademicRefresh({getSnapshotStatus,initialStatus=getSnapshotStatus(),readStatus,readWorkspace,requestRefresh,refreshSeconds,isCurrent,onStatus,onWorkspace,onRefreshState=()=>{},documentTarget=document,windowTarget=window,schedule=setTimeout,unschedule=clearTimeout,now=Date.now}){
 const interval=refreshSeconds>0?Math.max(120000,refreshSeconds*1000):Infinity;
 let stopped=false,working=false,timer,failures=0,next=0,appliedKey=academicContentKey(getSnapshotStatus());
 let latest=initialStatus,sourcePending=null,sourceNext=now()+interval,sourceRetry=0,sourceFailures=0,sourceError=null,blocked=false,expires=Infinity;
 let admissionRevision=0,pollAgain=false,progressExpected=initialStatus?.state==='syncing';
 const current=()=>!stopped && isCurrent();
 const visible=()=>documentTarget.visibilityState!=='hidden' && globalThis.navigator?.onLine!==false;
 const accept=(status,retainCapability=false)=>{
  if(status?.sourceSession){
   const capability=status.sourceSession;
   expires=capability.refreshAvailable?now()+Math.max(0,Number(capability.expiresInSeconds) || 0)*1000:0;
   sourceRetry=Math.max(sourceRetry,now()+Math.max(0,Number(capability.retryAfterSeconds) || 0)*1000);
  }
  const capability=status?.sourceSession?{...status.sourceSession,expiresAt:expires}:retainCapability?latest?.sourceSession:undefined;
  latest={...status,...(capability?{sourceSession:capability}:{})};onStatus(latest);
 };
 const later=delay=>{if(current()){unschedule(timer);timer=schedule(poll,delay);}};
 const refreshSource=()=>{
  if(sourcePending)return sourcePending;
  if(!current() || !visible())return Promise.reject(new Error('Connect and open your workspace before syncing university records.'));
  if(blocked)return Promise.reject(sourceError || new Error('Sign in to the university source again to sync.'));
  if(now()<sourceRetry)return Promise.reject(sourceError || Object.assign(new Error('AMS was checked recently. Please wait before syncing again.'),{status:429,retryAfter:Math.ceil((sourceRetry-now())/1000)}));
  if(!requestRefresh)return Promise.reject(new Error('University sync is unavailable.'));
  // Promise construction is deferred so overlapping UI/timer triggers share it.
  const run=Promise.resolve().then(async()=>{
   if(!current() || !visible())return;
   onRefreshState({state:'requesting',message:'Requesting new university records.'});
   try{
    const result=await requestRefresh();if(!current())return result;
    admissionRevision++;progressExpected=result.queued===true || result.syncStatus?.state==='syncing';
    sourceFailures=0;sourceError=null;sourceRetry=0;sourceNext=now()+interval;
    if(result.syncStatus)accept(result.syncStatus,true);
    onRefreshState({state:'queued',message:'University sync started. Saved records update as sections finish.'});later(750);return result;
   }catch(error){
    if(!current())throw error;
    sourceError=error;sourceFailures++;
    if([401,403,409].includes(error.status)){
     admissionRevision++;blocked=true;expires=0;progressExpected=false;
     accept({...latest,state:latest?.state==='syncing'?'failed':latest?.state,message:'Sign in to the university source again to sync.',sourceSession:{state:'reconnect_required',refreshAvailable:false,expiresInSeconds:0,retryAfterSeconds:0}});
     onRefreshState({state:'reconnect_required',message:'Sign in to the university source again to sync.'});
    }else{
     const retry=Math.min(300000,Math.max(30000*2**Math.min(sourceFailures-1,4),Math.max(0,Number(error.retryAfter) || 0)*1000));
     sourceRetry=now()+retry;sourceNext=sourceRetry;
     onRefreshState({state:'waiting',message:'University sync is waiting. Previous records and sync times are retained.',retryAt:sourceRetry});later(Math.min(30000,retry));
    }
    throw error;
   }
  });
  sourcePending=run;const clear=()=>{if(sourcePending===run)sourcePending=null;};run.then(clear,clear);return run;
 };
 const poll=async()=>{
  if(!current())return;
  if(working){pollAgain=true;return;}
  if(!visible() || now()<next){later(Math.max(30000,next-now()));return;}
  working=true;let syncing=progressExpected;const revision=admissionRevision;
  try{
   const status=await readStatus();if(!current())return;
   if(revision!==admissionRevision){pollAgain=!blocked;return;}
   accept(status);syncing=status.state==='syncing';progressExpected=syncing;
   const key=academicContentKey(status),snapshotKey=academicContentKey(getSnapshotStatus());
   // A separately requested full refresh may already have applied this version.
   if(key!==appliedKey && key!==snapshotKey){
    const overview=await readWorkspace();if(!current())return;
    if(revision!==admissionRevision){pollAgain=!blocked;return;}
    if(onWorkspace(overview,latest)!==false)appliedKey=key;
   }else appliedKey=key;
   failures=0;next=0;
   if(!syncing && !blocked && latest?.sourceSession?.refreshAvailable && now()<expires && now()>=sourceNext && now()>=sourceRetry && interval!==Infinity){
    try{await refreshSource();syncing=progressExpected;}catch{/* Admission state and backoff are published by refreshSource. */}
   }
  }catch(error){
   if(revision!==admissionRevision){pollAgain=!blocked;return;}
   failures++;next=now()+Math.min(120000,10000*2**Math.min(failures-1,4));
   if([401,403].includes(error.status)){blocked=true;onRefreshState({state:'reconnect_required',message:'Verify your app session before syncing.'});}
  }finally{working=false;if(pollAgain){pollAgain=false;later(750);}}
  // Once the authoritative capability is unavailable, only an explicit sync,
  // visibility/focus event or a newly verified account resumes checking.
  syncing=progressExpected;
  if(blocked || !syncing && (refreshSeconds===0 || latest?.sourceSession?.refreshAvailable===false))return;
  later(failures?Math.max(1000,next-now()):syncing?2000:30000);
 };
 const resume=()=>{if(current() && !blocked && (refreshSeconds!==0 || latest?.state==='syncing') && visible() && now()>=next){unschedule(timer);void poll();}};
 if(refreshSeconds!==0 || initialStatus?.state==='syncing')later(initialStatus?.state==='syncing'?750:30000);
 documentTarget.addEventListener('visibilitychange',resume);windowTarget.addEventListener('focus',resume);windowTarget.addEventListener('online',resume);
 const stop=()=>{stopped=true;unschedule(timer);documentTarget.removeEventListener('visibilitychange',resume);windowTarget.removeEventListener('focus',resume);windowTarget.removeEventListener('online',resume);};
 stop.refreshSource=refreshSource;return stop;
}
