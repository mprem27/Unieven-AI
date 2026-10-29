const sectionLabels={profile:'student details',summary:'attendance totals',records:'attendance dates',timetable:'timetable',subjects:'courses',snapshot:'academic records',notifications:'notifications'};
export function syncProgressKey(status={}){
 return JSON.stringify([status.state,(status.modules || []).map(module=>[module.id,module.state,module.recordCount,module.lastSuccessAt,module.error])]);
}
export function academicIssueSummary(errors={}){
 const keys=Object.keys(errors).filter(key=>errors[key]);
 if(!keys.length)return '';
 const labels=[...new Set(keys.map(key=>sectionLabels[key] || 'academic records'))];
 return `Could not update ${labels.join(', ')}. Check University records in settings for details.`;
}
export function syncMutationFeedback(value,success='Updated'){
 if(value?.queued || value?.syncPending)return {text:'Sync started. You can keep using your workspace.',type:'success'};
 if(value?.partial)return {text:'Some university records are unavailable. View University records in settings for their status.',type:'error'};
 return {text:success,type:'success'};
}
export function welcomeSyncProgress(value){
 const status=value || {},known=new Set(['profile','timetable','attendance','courses','results','credits','examinations','fees','documents']);
 const modules=[...new Map((Array.isArray(status.modules)?status.modules:[]).filter(item=>known.has(item.id)).map(item=>[item.id,item])).values()];
 const updated=new Set(modules.filter(item=>item.state==='available' && !item.retained).map(item=>item.id));
 const coreReady=['profile','timetable','attendance','courses'].every(id=>updated.has(id));
 return {available:updated.size,total:modules.length,active:status.state==='syncing',enoughReady:coreReady || modules.length>0 && updated.size>=Math.ceil(modules.length/2),finished:['idle','partial','failed','not_connected'].includes(status.state),partial:status.state==='partial',failed:status.state==='failed'};
}
