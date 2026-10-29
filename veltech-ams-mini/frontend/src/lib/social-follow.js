// Relationship writes are coalesced per owner/member, never per rendered card.
export function followState(person){
 const removing=person.following || person.requestStatus==='requested';
 return {following:!removing && !person.isPrivate,requestStatus:removing?null:person.isPrivate?'requested':'accepted'};
}
export function createFollowController({read,patch,isCurrent,send,pending:onPending=()=>{}}){
 let pending=null;
 return {act(){
  if(pending)return pending;
  const person=read(),before={following:!!person.following,requestStatus:person.requestStatus || null},optimistic=followState(person),removing=person.following || person.requestStatus==='requested';
  if(!isCurrent())return Promise.resolve(before);
  onPending(true);patch(optimistic);
  // Start the request synchronously; retain one promise across duplicate cards.
  let work;try{work=send(removing?'DELETE':'POST');}catch(error){work=Promise.reject(error);}
  pending=Promise.resolve(work).then(value=>{
   const result={following:!!value.following,requestStatus:value.status || (value.following?'accepted':null)};
   if(isCurrent())patch(result);return result;
  }).catch(error=>{if(isCurrent())patch(before);throw error;}).finally(()=>{pending=null;onPending(false);});
  return pending;
 }};
}

// Fence reads against writes that started before or during that read. Fresh
// reads after settlement still reconcile server-side changes from other devices.
export function createRelationshipReads(){
 const writes=new Map();let generation=0;
 const idOf=person=>String(person?.id || person?._id || '');
 return {
  clear(){generation++;writes.clear();},
  capture(){return {generation,versions:new Map([...writes].map(([id,entry])=>[id,{version:entry.version,pending:entry.pending}]))};},
  pending(id,pending){const entry=writes.get(id) || {version:0,state:{}};writes.set(id,{...entry,pending});},
  patch(id,state){const entry=writes.get(id) || {version:0,pending:false};writes.set(id,{...entry,version:entry.version+1,state});},
  current:token=>token?.generation===generation,
  reconcile(rows,token,localRows=[]){
   if(!token || token.generation!==generation)return rows;
   const seen=new Set();
   const merge=person=>{const id=idOf(person),entry=writes.get(id),atRead=token.versions.get(id);seen.add(id);
    if(!entry)return person;
    if(entry.pending || atRead?.pending || entry.version!==(atRead?.version || 0))return {...person,...entry.state,...(typeof person.followersCount==='number'?{followersCount:Math.max(0,person.followersCount+Number(!!entry.state.following)-Number(!!person.following))}:{})};
    // Remember fresh server state so an even older read cannot restore a
    // superseded local result after this read has already reconciled it.
    entry.state={following:!!person.following,requestStatus:person.requestStatus || null,...(typeof person.followersCount==='number'?{followersCount:person.followersCount}:{})};
    return person;
   };
   const merged=rows.map(merge);
   for(const person of localRows){const id=idOf(person),entry=writes.get(id),atRead=token.versions.get(id);
    if(!seen.has(id) && entry && (entry.pending || atRead?.pending || entry.version!==(atRead?.version || 0)))merged.push(merge(person));
   }
   return merged;
  }
 };
}

export function canDisplayCachedSocialContent(item,author,people,viewerId){
 const authorId=String(author?.id || author?._id || ''),relation=people.find(person=>String(person.id || person._id)===authorId);
 return !(relation && !relation.following && authorId!==String(viewerId) && (author.isPrivate || item.visibility==='followers'));
}
