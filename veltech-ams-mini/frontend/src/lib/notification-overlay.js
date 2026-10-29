import {notificationIdentity,notificationId} from './notifications.js';
export const notificationRead=item=>(item.read ?? item.isRead)===true;
const source=item=>item.source==='social'?'social':'academic';

// A component-owned journal shields confirmed changes from older polling snapshots.
// Each request owns its patch, so a failed batch cannot undo another source.
export function createNotificationOverlay({request,isCurrent,onError=()=>{}}){
 const patches=new Map(),listeners=new Set();let disposed=false,version=0;
 const current=()=>!disposed && isCurrent();
 const emit=()=>{version++;for(const listener of listeners)listener();};
 const apply=items=>items.flatMap(item=>{const patch=patches.get(notificationIdentity(item));return patch?.action==='delete'?[]:[patch?.action==='read'?{...item,read:true,isRead:true}:item];});
 async function perform(items,action,path,method){
  if(!current() || !items.length)return;
  const token=Symbol(),previous=new Map();
  for(const item of items){const key=notificationIdentity(item);previous.set(key,patches.get(key));patches.set(key,{action,token,pending:true});}emit();
  try{await request(path,{method,body:{}});if(!current())return;for(const key of previous.keys())if(patches.get(key)?.token===token)patches.set(key,{action,pending:false});emit();}
  catch(error){if(!current())return;for(const [key,patch]of previous)if(patches.get(key)?.token===token){if(patch)patches.set(key,patch);else patches.delete(key);}emit();onError(error.message || 'Could not update this notification.');}
 }
 return {
  apply,subscribe(listener){listeners.add(listener);return()=>listeners.delete(listener);},snapshot:()=>version,
  pending:item=>item?patches.get(notificationIdentity(item))?.pending===true:[...patches.values()].some(p=>p.pending),
  update(item,action){if(!notificationId(item) || patches.get(notificationIdentity(item))?.pending)return Promise.resolve();return perform([item],action,`${source(item)==='social'?'/notifications':'/academics/notifications'}/${encodeURIComponent(notificationId(item))}${action==='read'?'/read':''}`,action==='read'?'PATCH':'DELETE');},
  allRead(items){const unread=apply(items).filter(item=>!notificationRead(item) && !patches.get(notificationIdentity(item))?.pending);return Promise.all(['academic','social'].map(kind=>perform(unread.filter(item=>source(item)===kind),'read',kind==='social'?'/notifications/read-all':'/academics/notifications/read','PATCH')));},
  dispose(){disposed=true;listeners.clear();},
 };
}
