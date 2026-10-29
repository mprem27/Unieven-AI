const sourceNames={ams:'University records (AMS)','student-import':'Your imported copy','faculty-published':'Staff update · published in app','sample-preview':'Sample preview',demo:'Sample preview',mixed:'Multiple sources'};
export function academicSourceName(value){return sourceNames[value] || (value && value!=='unavailable'?String(value):'Source unavailable');}
export function safeAcademicUrl(value){
 if(typeof value!=='string' || !value)return '';
 try{const parsed=new URL(value);return parsed.protocol==='https:' && !parsed.username && !parsed.password?parsed.href:'';}catch{return '';}
}
export function officialAmsUrl(value){
 const safe=safeAcademicUrl(value);if(!safe)return '';
 const parsed=new URL(safe);return parsed.hostname==='ams.veltech.edu.in' && (!parsed.port || parsed.port==='443')?safe:'';
}
export function sectionProvenance(academic,key,mode='connected'){
 const rows=Array.isArray(academic?.[key])?academic[key]:[],known=academic?.sectionSources?.[key];
 if(mode==='demo')return {source:'sample-preview',status:rows.length?'available':'unavailable',recordCount:rows.length,updatedAt:null};
 if(known)return {...known,recordCount:rows.length};
 const sources=[...new Set(rows.map(row=>row.source || (key==='courses'?academic?.source:null)).filter(Boolean))];
 const timestamps=rows.map(row=>row.sourceUpdatedAt).filter(Boolean).sort();
 return {source:sources.length===1?sources[0]:sources.length?'mixed':'unavailable',status:rows.length?'available':'unavailable',recordCount:rows.length,updatedAt:timestamps.at(-1) || (key==='courses'?academic?.updatedAt:null)};
}
export function visibleAcademicRows(academic,key,mode='connected'){
 const rows=Array.isArray(academic?.[key])?academic[key]:[];
 return mode==='connected' && ['results','credits','creditSummary','resultSummary','gradeScale','fees','documents'].includes(key)?rows.filter(row=>row && row.source==='ams'):rows;
}
export function academicModuleStatus(academic,key){
 return academic?.syncStatus?.modules?.find(module=>module.id===key) || null;
}
export function academicFileUrl(row){
 return row?.source==='ams' && typeof row.downloadId==='string' && /^[a-f0-9]{24}$/i.test(row.downloadId)?`/api/campus/academics/documents/${row.downloadId}`:'';
}
export function academicTime(value){
 if(!value)return 'Not yet synced';
 const parsed=new Date(value);
 return Number.isFinite(parsed.getTime())?new Intl.DateTimeFormat('en-IN',{timeZone:'Asia/Kolkata',day:'numeric',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit',timeZoneName:'short'}).format(parsed):'Time unavailable';
}
export function academicDate(value,dateText=''){
 if(dateText)return String(dateText);
 if(!value)return 'Not provided';
 const parsed=new Date(/^\d{4}-\d{2}-\d{2}$/.test(value)?value+'T12:00:00+05:30':value);
 return Number.isFinite(parsed.getTime())?new Intl.DateTimeFormat('en-IN',{timeZone:'Asia/Kolkata',day:'numeric',month:'short',year:'numeric'}).format(parsed):String(value);
}
