import {socialCount} from './community.js';

// Each action owns only its fields, so a slow like never overwrites a save or comment.
export function createReactionController({read,patch,send,scope,pending=()=>{}}) {
 let generation=0,working={};
 const emit=()=>pending({...working});
 return {
  async act(action,desired) {
   if(working[action])return;
   const item=read();if(!item)return;
   const key=action==='like'?'liked':'saved',value=desired ?? !item[key];
   if(!!item[key]===value)return;
   const owner=scope();if(owner==null)return;
   const version=generation,previous={[key]:!!item[key]},optimistic={[key]:value};
   if(action==='like'){previous.likes=socialCount(item.likes);optimistic.likes=Math.max(0,previous.likes+(value?1:-1));}
   const current=()=>generation===version && scope()===owner;
   working[action]=true;emit();patch(optimistic);
   try {
    const result=await send(action,{[key]:value});
    if(!current())return;
    const source=result?.comment || result?.post || result?.reel || result || {},confirmed={[key]:typeof source[key]==='boolean'?source[key]:value};
    if(action==='like' && typeof source.likes==='number' && Number.isFinite(source.likes))confirmed.likes=Math.max(0,source.likes);
    patch(confirmed);
   }catch(error){if(!current())return;patch(previous);throw error;}
   finally {if(current()){working[action]=false;emit();}}
  },
  invalidate(){generation++;working={};}
 };
}

const idOf=item=>String(item?.id ?? item?._id ?? item ?? '');
export function commentThreads(comments=[]) {
 const ids=new Set(comments.map(idOf)),children=new Map(),roots=[],seen=new Set(),rows=[];
 for(const comment of comments){const parent=idOf(comment.parentComment);if(parent && parent!==idOf(comment) && ids.has(parent)){if(!children.has(parent))children.set(parent,[]);children.get(parent).push(comment);}else roots.push(comment);}
 const visit=(comment,depth)=>{const id=idOf(comment);if(seen.has(id))return;seen.add(id);rows.push({comment,depth});for(const reply of children.get(id) || [])visit(reply,Math.min(1,depth+1));};
 for(const comment of roots)visit(comment,0);
 for(const comment of comments)visit(comment,0);
 return rows;
}
export function commentTimestamp(value,now=Date.now()) {
 const stamp=Date.parse(value);if(!Number.isFinite(stamp))return '';
 const seconds=Math.max(0,Math.floor((now-stamp)/1000));
 if(seconds<60)return 'now';if(seconds<3600)return `${Math.floor(seconds/60)}m`;if(seconds<86400)return `${Math.floor(seconds/3600)}h`;if(seconds<604800)return `${Math.floor(seconds/86400)}d`;
 return new Date(stamp).toLocaleDateString(undefined,{month:'short',day:'numeric',...(new Date(stamp).getFullYear()!==new Date(now).getFullYear()?{year:'numeric'}:{})});
}
