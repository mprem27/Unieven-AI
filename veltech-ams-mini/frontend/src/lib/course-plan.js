const code=c=>String(c.code || c.subjectCode || c.courseCode || '').trim();
const validTime=value=>typeof value==='string' && /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value);
export function auditCoursePlan(courses,timetable=[],window={}){
 const unique=new Map(),duplicates=[];for(const course of courses){const id=code(course);if(!id)continue;if(unique.has(id))duplicates.push(id);else unique.set(id,course);}
 let knownCredits=0,unknownCredits=0,unknownSchedules=0;const slots=[],prerequisiteChecks=[];
 for(const [id,course] of unique){const credits=Number(course.credits);if(course.credits!==null && course.credits!==undefined && String(course.credits).trim()!=='' && Number.isFinite(credits) && credits>=0)knownCredits+=credits;else unknownCredits++;
  const rows=[...(Array.isArray(course.schedules)?course.schedules:[]),...(course.day?[course]:[]),...timetable.filter(row=>code(row)===id)].filter(row=>row.day && validTime(row.startTime) && validTime(row.endTime) && row.startTime<row.endTime);
  if(!rows.length)unknownSchedules++;
  const seen=new Set();for(const row of rows){const day=String(row.day).toLowerCase(),key=`${day}/${row.startTime}/${row.endTime}`;if(!seen.has(key)){slots.push({course:id,day,start:row.startTime,end:row.endTime});seen.add(key);}}
  if(course.prerequisites && String(course.prerequisites).trim())prerequisiteChecks.push({course:id,required:course.prerequisites});
 }
 const conflicts=[];for(let i=0;i<slots.length;i++)for(let j=i+1;j<slots.length;j++){const a=slots[i],b=slots[j];if(a.course!==b.course && a.day===b.day && a.start<b.end && b.start<a.end)conflicts.push({courses:[a.course,b.course],day:a.day,start:a.start>b.start?a.start:b.start});}
 const limit=Number(window?.maxCredits);return {knownCredits,unknownCredits,unknownSchedules,conflicts,duplicates,prerequisiteChecks,exceedsCreditLimit:Number.isFinite(limit) && limit>0 && knownCredits>limit};
}
