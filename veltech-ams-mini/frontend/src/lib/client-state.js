export function createAccountGate() {
 let account=0,request=0,pending=false;
 return {
  beginAccount(){pending=true;request++;return ++account;},
  currentAccount(value){return value===account;},
  finishAccount(value){if(value===account)pending=false;},
  invalidate(){account++;request++;pending=false;},
  startRefresh(fromAccount=false){return pending && !fromAccount?null:{account,request:++request};},
  currentRefresh(value){return !!value && value.account===account && value.request===request;},
 };
}
export const needsAcademicWorkspace=profile=>!['faculty','admin'].includes(profile?.accountRole);
export function mergeCampusProfile(campus={},academic={}) {
 return {...campus,...academic,id:campus.id,email:campus.email,name:academic.name || campus.name,
  officialProfile:structuredClone(academic),socialName:campus.name || '',socialDepartment:campus.socialDepartment || '',socialLinks:campus.socialLinks || [],
  department:academic.department || campus.department,studentId:academic.studentId || campus.studentId,
  campusDepartment:campus.department || '',campusRole:campus.campusRole || 'student',accountRole:campus.accountRole || campus.role || 'student',adminPermissions:campus.adminPermissions,adminActionPermissions:campus.adminActionPermissions,adminAccessRole:campus.adminAccessRole,isAdminOwner:campus.isAdminOwner,adminCreatedBy:campus.adminCreatedBy,club:campus.club || '',
  photo:academic.photo || campus.image};
}
const eventId=ticket=>ticket.event?.id || ticket.event?._id || ticket.event;
const currentTicket=(state,id)=>state.registrations.find(ticket=>eventId(ticket)===id && ticket.status!=='cancelled');
export function createDemoRegistrationService({getState,update,makeTicket}) {
 const pending=new Map();let generation=0;
 return {
  invalidate(){generation++;pending.clear();},
  register(id) {
   if(pending.has(id))return pending.get(id);
   const started=generation;
   const work=(async()=>{
    const initial=getState();
    const event=initial.events.find(item=>item.id===id);
    if(!event || event.archivedAt || ['cancelled','completed'].includes(event.status))throw new Error('This event is unavailable');
    const existing=currentTicket(initial,id);if(existing)return existing;
    if(event.pricePaise>0)throw new Error('Demo payments are disabled. Connect the college payment account to purchase a paid ticket.');
    if(event.registrationCount>=event.capacity)throw new Error('This event is full');
    const candidate=await makeTicket(event);
    if(started!==generation)throw new Error('Demo workspace was reset. Start a new registration.');
    let result;
    update(state=>{
     const latest=state.events.find(item=>item.id===id);
     if(!latest || latest.archivedAt || ['cancelled','completed'].includes(latest.status))throw new Error('This event is unavailable');
     result=currentTicket(state,id);if(result)return state;
     if(latest.registrationCount>=latest.capacity)throw new Error('This event is full');
     result={...candidate,event:{...latest}};
     state.registrations.unshift(result);latest.registrationCount++;latest.registered='registered';return state;
    });
    return result;
   })();
   pending.set(id,work);
   const clear=()=>{if(pending.get(id)===work)pending.delete(id);};work.then(clear,clear);
   return work;
  }
 };
}
export function cancelDemoRegistration(state,id) {
 const ticket=state.registrations.find(item=>item.id===id);
 if(!ticket)throw new Error('Registration is unavailable');
 if(ticket.status==='cancelled')return false;
 if(ticket.status!=='registered')throw new Error('Ticket cannot be cancelled');
 const event=state.events.find(item=>item.id===eventId(ticket));
 ticket.status='cancelled';if(event){event.registrationCount=Math.max(0,event.registrationCount-1);event.registered=null;}return true;
}
