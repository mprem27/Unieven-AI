const metadata=['title','examType','academicYear','term','department','regulation','batch','semester','section','instructions'];
const normalized=value=>String(value || '').toUpperCase().replace(/[^A-Z0-9]/g,'');
const dateIsValid=value=>/^\d{4}-\d{2}-\d{2}$/.test(value || '') && Number.isFinite(Date.parse(`${value}T12:00:00Z`)) && new Date(`${value}T12:00:00Z`).toISOString().slice(0,10)===value;
const timeIsValid=value=>/^([01]\d|2[0-3]):[0-5]\d$/.test(value || '');
const audiencesOverlap=(plan,left,right)=>['department','semester','section'].every(key=>{const a=normalized(left[key] || plan[key]),b=normalized(right[key] || plan[key]);return !a || !b || a===b;});
export function validateExamDraft(plan){
 const errors=[],add=(field,message,row)=>errors.push({field,message,...(row===undefined?{}:{row})});
 for(const [field,label] of [['title','schedule title'],['examType','exam type'],['academicYear','academic year'],['term','term']])if(!String(plan[field] || '').trim())add(field,`Enter the ${label}.`);
 const rows=Array.isArray(plan.rows)?plan.rows:[];
 if(!rows.length)add('rows','Add at least one examination row.');
 if(rows.length>500)add('rows','Keep each schedule within 500 examination rows.');
 rows.forEach((row,index)=>{
  if(!/^[A-Za-z0-9][A-Za-z0-9._/-]{1,39}$/.test(String(row.courseCode || '').trim()))add('courseCode','Enter the exact registered course code.',index);
  if(!String(row.courseName || '').trim())add('courseName','Enter the course name.',index);
  if(!dateIsValid(row.date))add('date','Enter a valid examination date.',index);
  if(!timeIsValid(row.startTime))add('startTime','Enter a valid start time.',index);
  if(!timeIsValid(row.endTime))add('endTime','Enter a valid end time.',index);
  else if(timeIsValid(row.startTime) && row.endTime<=row.startTime)add('endTime','End time must be after the start time.',index);
  if(timeIsValid(row.startTime) && timeIsValid(row.endTime) && rows.slice(0,index).some(other=>normalized(other.courseCode)===normalized(row.courseCode) && other.date===row.date && timeIsValid(other.startTime) && timeIsValid(other.endTime) && row.startTime<other.endTime && row.endTime>other.startTime && audiencesOverlap(plan,other,row)))add('startTime','This course session overlaps another row for the same audience.',index);
 });
 return errors;
}
export function examDraftPayload(plan){
 return {...Object.fromEntries(metadata.map(key=>[key,String(plan[key] || '')])),rows:(plan.rows || []).map(row=>({...row})),revision:plan.revision};
}
export async function publishExamDraft({plan,reviewed,request,onSaved}){
 if(!reviewed)throw new Error('Review every row and confirm the review before publishing.');
 const errors=validateExamDraft(plan);
 if(errors.length)throw new Error(`${errors[0].row===undefined?'':`Row ${errors[0].row+1}: `}${errors[0].message}`);
 if(!plan.id)throw new Error('Save this schedule as a draft before publishing.');
 const saved=await request(`/exam-plans/${plan.id}`,{method:'PUT',body:examDraftPayload(plan)});
 onSaved?.(saved.plan);
 const published=await request(`/exam-plans/${plan.id}/publish`,{method:'POST',body:{revision:saved.plan.revision,reviewed:true}});
 return published.plan;
}

export function examScheduleDateRange(plan,formatDate=value=>value){
 const dates=(plan.rows || []).map(row=>row.date).filter(dateIsValid).sort();
 const first=plan.startDate || dates[0],last=plan.endDate || dates.at(-1) || first;
 return !first?'Dates not added':first===last?formatDate(first):`${formatDate(first)} – ${formatDate(last)}`;
}
