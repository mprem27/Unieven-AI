import {academicNumber,weightedGpa,percentageEstimate} from './gpa.js';
export const resultAssessmentFields={testMark1:'Test 1',testMark2:'Test 2',testMark3:'Test 3',midTestMark1:'Mid-test 1',midTestMark2:'Mid-test 2',labMark:'Lab',assignmentMark:'Assignment',internalMark:'Final internal'};
export const hasResultMark=(row,field)=>row[field]!==undefined && row[field]!==null && String(row[field]).trim()!=='';
export const resultReportLabel=row=>{const report=String(row.resultType || row.sourceReport || 'Results'),source=String(row.sourceReport || '');return source && source!==report?`${report} · ${source}`:report;};
export function filterResults(rows=[],filters={}){
 const query=String(filters.query || '').trim().toLocaleLowerCase();
 return rows.filter(row=>(!filters.report || filters.report==='all' || resultReportLabel(row)===filters.report) && (!filters.semester || filters.semester==='all' || String(row.semester ?? '').trim()===filters.semester) && (!filters.session || filters.session==='all' || row.examinationSession===filters.session) && (!filters.assessment || filters.assessment==='all' || (Object.hasOwn(resultAssessmentFields,filters.assessment) && hasResultMark(row,filters.assessment))) && (!query || `${row.courseName || row.subjectName || ''} ${row.courseCode || row.subjectCode || ''}`.toLocaleLowerCase().includes(query)));
}
// Published summaries are read verbatim. Calculated values are kept separate;
// a semester GPA is never mistaken for an overall value or percentage.
export function publishedResultSummary(summary=[]){
 const overall=summary.filter(row=>!String(row.semester ?? '').trim());
 const read=(pattern,percentage=false)=>{const values=[...new Set(overall.filter(row=>pattern.test(String(row.label || '').trim())).map(row=>academicNumber(percentage?String(row.value ?? '').trim().replace(/%$/,'').trim():row.value)).filter(value=>value!==null && (!percentage || value<=100)))];return values.length===1?values[0]:null;};
 return {cgpa:read(/^(?:overall\s+)?(?:cgpa|cumulative grade point average)$/i),percentage:read(/^(?:(?:overall|aggregate|cumulative)\s+)?(?:percentage|percentage\s*\(\s*%\s*\)|percentage\s*%|%)$/i,true)};
}
const course=row=>String(row.courseCode || row.subjectCode || row.code || '').trim().toUpperCase();
const semesterKey=value=>{const text=String(value ?? '').trim().replace(/^(?:semester|sem)\s*[-:]?\s*/i,'').toUpperCase(),roman=['I','II','III','IV','V','VI','VII','VIII','IX','X'];return roman.includes(text)?String(roman.indexOf(text)+1):text;};
const absent=value=>value===null || value===undefined || /^(?:\s*|[-–—]|N\/?A)$/i.test(String(value).trim());
const firstNumber=values=>{const found=[...new Set(values.map(academicNumber).filter(value=>value!==null))];return found.length===1?found[0]:undefined;};
const gradeKey=value=>String(value || '').trim().toUpperCase();
export function prepareResults(rows=[],credits=[],gradeScale=[],calculationScale=[]){
 const scales=new Map();
 const creditIndex=new Map();
 for(const row of credits){const key=course(row);if(key){if(!creditIndex.has(key))creditIndex.set(key,[]);creditIndex.get(key).push(row);}}
 for(const row of gradeScale){const grade=gradeKey(row.grade),point=academicNumber(row.points ?? row.gradePoints);if(grade && point!==null){const values=scales.get(grade) || new Set();values.add(point);scales.set(grade,values);}}
 const selectedScale=new Map(calculationScale.map(row=>[gradeKey(row.grade),academicNumber(row.points)]));
 const enriched=rows.map(row=>{
  const candidates=(creditIndex.get(course(row)) || []).filter(c=>!row.semester || !c.semester || semesterKey(c.semester)===semesterKey(row.semester));
  const values=[...new Set(candidates.map(c=>academicNumber(c.credits ?? c.credit)).filter(c=>c!==null))];
  const point=scales.get(gradeKey(row.grade)),ledgerPoint=firstNumber(candidates.filter(c=>!c.grade || gradeKey(c.grade)===gradeKey(row.grade)).map(c=>c.gradePoints ?? c.gradePoint));
  const sourcePoint=ledgerPoint ?? (point?.size===1?[...point][0]:undefined),selectedPoint=!point?selectedScale.get(gradeKey(row.grade)):undefined;
  const existingCredit=row.credits ?? row.credit,existingPoint=row.gradePoints ?? row.gradePoint;
  const configured=absent(existingPoint) && sourcePoint===undefined && selectedPoint!==null && selectedPoint!==undefined;
  return {...row,credits:absent(existingCredit)?values.length===1?values[0]:undefined:existingCredit,
   gradePoints:absent(existingPoint)?sourcePoint ?? (configured?selectedPoint:undefined):existingPoint,
   ...(configured?{gradePointSource:'calculation'}:{})};
 });
 return {grades:enriched.filter(row=>row.grade!==undefined && row.grade!==null && row.grade!==''),publishedRows:enriched.filter(row=>!row.grade && ['cgpa','gpa','sgpa','overallPercentage'].some(field=>row[field]!==undefined)),assessments:enriched.filter(row=>row.grade===undefined || row.grade===null || row.grade==='' || Object.keys(resultAssessmentFields).some(field=>hasResultMark(row,field)))};
}
export function resultSemesters(rows=[]){const labels=new Map();for(const row of rows){const label=String(row.semester ?? '').trim();if(label && !labels.has(semesterKey(label)))labels.set(semesterKey(label),label);}return [...labels.values()].sort((a,b)=>semesterKey(a).localeCompare(semesterKey(b),undefined,{numeric:true}));}
export function resultMetrics(rows=[]){return weightedGpa(rows.map(row=>({...row,courseCode:course(row),...(row.creditClassificationConflict?{gradePoints:undefined,gradePoint:undefined}:{})})));}

function calculationRows(rows){
 const seen=new Set();return rows.filter((row,index)=>{
  if(academicNumber(row.credits)===0)return false;
  const key=JSON.stringify([course(row) || index,semesterKey(row.semester),row.credits,row.gradePoints ?? row.gradePoint]);
  if(seen.has(key))return false;seen.add(key);return true;
 });
}

function resultSummaries(rows,summary){
 return [...summary,...rows.flatMap(row=>[
  ...(row.cgpa!==undefined?[{label:'CGPA',value:row.cgpa,semester:row.semester}]:[]),
  ...(row.gpa!==undefined || row.sgpa!==undefined?[{label:'SGPA',value:row.gpa ?? row.sgpa,semester:row.semester}]:[]),
  ...(row.overallPercentage!==undefined?[{label:'Overall percentage',value:row.overallPercentage,semester:row.semester}]:[]),
 ])];
}
export function overallResultOverview(rows=[],summary=[],options={}){
 const summaries=resultSummaries(rows,summary),published=publishedResultSummary(summaries);
 const semesters=resultSemesters(summaries),latest=semesters.at(-1),last=latest?publishedResultSummary(summaries.filter(row=>semesterKey(row.semester)===semesterKey(latest)).map(row=>({...row,semester:''}))):{cgpa:null,percentage:null};
 const unique=calculationRows(rows),calculated=resultMetrics(unique),sourceCgpa=published.cgpa ?? last.cgpa,cgpa=sourceCgpa ?? (calculated.complete?calculated.value:null);
 const sourcePercentage=published.percentage ?? last.percentage,estimate=options.percentageFactor?percentageEstimate(cgpa,options.percentageFactor):null;
 const ordered=resultSemesters([...unique,...summaries]);
 const cgpaPoints=ordered.map((label,index)=>{
  const scope=ordered.slice(0,index+1),metrics=resultMetrics(unique.filter(row=>scope.some(value=>semesterKey(value)===semesterKey(row.semester))));
  const explicit=publishedResultSummary(summaries.filter(row=>semesterKey(row.semester)===semesterKey(label)).map(row=>({...row,semester:''}))).cgpa;
  const value=explicit ?? (index===ordered.length-1?published.cgpa:null) ?? (metrics.complete?metrics.value:null);
  return {label:`Semester ${label}`,shortLabel:label,detail:explicit!==null || index===ordered.length-1 && published.cgpa!==null?'Published cumulative CGPA':`Calculated cumulative CGPA · ${metrics.credits} credits`,value};
 });
 if(!cgpaPoints.length && cgpa!==null)cgpaPoints.push({label:'Overall',shortLabel:'Overall',detail:sourceCgpa!==null?'Published overall CGPA':'Calculated overall CGPA',value:cgpa});
 return {cgpa,cgpaSource:sourceCgpa!==null?'published':calculated.complete?'calculated':'unavailable',
  percentage:sourcePercentage ?? estimate,percentageSource:sourcePercentage!==null?'published':estimate!==null?'calculated':'unavailable',points:resultTrend(unique,'all','all',summaries),cgpaPoints};
}

// Every section retains its source report, semester and examination session.
// No attempt-selection rule is inferred from the order of source records.
export function resultReportGroups(rows=[]){
 const groups=new Map(),reports=[...new Set(rows.map(row=>String(row.resultType || row.sourceReport || 'Results')))];
 for(const row of rows){
  const report=String(row.resultType || row.sourceReport || 'Results'),semester=String(row.semester ?? '').trim(),session=String(row.examinationSession || '');
  const sourceReport=String(row.sourceReport || ''),key=JSON.stringify([report,sourceReport,semester,session]);
  if(!groups.has(key))groups.set(key,{key,report,sourceReport,semester,session,rows:[]});
  groups.get(key).rows.push(row);
 }
 const semesters=resultSemesters(rows);
 return [...groups.values()].sort((a,b)=>reports.indexOf(a.report)-reports.indexOf(b.report)||(a.semester?semesters.indexOf(a.semester):semesters.length)-(b.semester?semesters.indexOf(b.semester):semesters.length));
}

export function resultTrend(rows=[],semester='all',assessment='all',summary=[]){
 if(assessment!=='all')return rows.map((row,index)=>({label:row.courseCode || `Course ${index+1}`,shortLabel:row.courseCode || `Course ${index+1}`,contextLabel:row.semester?`Sem ${row.semester}`:'Semester unavailable',detail:[row.courseName || row.courseCode || `Course ${index+1}`,row.semester?`Semester ${row.semester}`:'',resultAssessmentFields[assessment] || 'Assessment',resultReportLabel(row)].filter(Boolean).join(' · '),value:Object.hasOwn(resultAssessmentFields,assessment)?academicNumber(row[assessment]):null}));
 if(semester!=='all')return rows.map((row,index)=>({label:row.courseCode || `Course ${index+1}`,detail:row.courseName || row.courseCode || `Course ${index+1}`,value:academicNumber(row.gradePoints ?? row.gradePoint)}));
 const attempts=new Map();
 for(const row of rows){const code=course(row);if(code)attempts.set(code,(attempts.get(code) || 0)+1);}
 const semesters=resultSemesters([...rows,...summary.filter(row=>/^(?:gpa|sgpa|semester grade point average)$/i.test(String(row.label || '').trim()))]);
 if(rows.some(row=>!String(row.semester ?? '').trim()))semesters.push('');
 return semesters.map(label=>{
  const publishedRows=[...rows.filter(row=>semesterKey(row.semester)===semesterKey(label)).map(row=>row.gpa ?? row.sgpa),...summary.filter(row=>semesterKey(row.semester)===semesterKey(label) && /^(?:gpa|sgpa|semester grade point average)$/i.test(String(row.label || '').trim())).map(row=>row.value)];
  const publishedValues=[...new Set(publishedRows.map(academicNumber).filter(value=>value!==null))];
  if(publishedValues.length)return {label:label?`Semester ${label}`:'Semester not provided',shortLabel:label || '—',detail:publishedValues.length===1?'Published semester GPA':'Conflicting semester GPA values',value:publishedValues.length===1?publishedValues[0]:null};
  const sourceRows=rows.filter(row=>String(row.semester ?? '').trim()===label),eligible=sourceRows.filter(row=>!course(row) || attempts.get(course(row))===1);
  const calculated=resultMetrics(eligible),repeated=sourceRows.length-eligible.length,metrics={...calculated,excluded:calculated.excluded+repeated,complete:calculated.complete && repeated===0};
  return {label:label?`Semester ${label}`:'Semester not provided',shortLabel:label || '—',detail:`${metrics.included} courses · ${metrics.credits} credits${metrics.excluded?` · ${metrics.excluded} incomplete or repeated records`:''}`,value:metrics.complete?metrics.value:null};
 });
}
export function resultAssessmentTrends(rows=[]){
 return Object.entries(resultAssessmentFields).filter(([field])=>rows.some(row=>hasResultMark(row,field))).map(([field,label])=>({field,label,unit:'Raw marks',points:resultTrend(rows,'all',field)}));
}

export const creditColumns={courseName:'Course name',courseCode:'Course code',semester:'Semester',category:'Category',requiredCredits:'Required credits',credits:'Credits',earnedCredits:'Credits earned',grade:'Grade',gradePoints:'Grade points',creditPoints:'Credit points',status:'Status',label:'Source label',value:'Source value'};
export function creditColumnLabel(field,rows=[]){
 const labels=[...new Set(rows.map(row=>row.sourceColumns?.[field]).filter(label=>typeof label==='string' && label.trim()))];
 return labels.length===1?labels[0]:creditColumns[field] || field;
}
export function creditReportSections(rows=[]){
 const groups=new Map(),order=['course','category','semester','summary','other'];
 for(const row of rows){
  const explicit=String(row.rowType || '').toLowerCase();
  const kind=order.includes(explicit)?explicit:explicit==='bucket'?'category':course(row)?'course':row.category?'category':row.semester?'semester':row.label?'summary':'other';
  const report=String(row.sourceReport || ''),semester=kind==='course'?String(row.semester ?? '').trim():'';
  const key=JSON.stringify([kind,report,semester]);
  if(!groups.has(key))groups.set(key,{key,kind,report,semester,rows:[]});
  groups.get(key).rows.push(row);
 }
 const semesters=resultSemesters(rows);
 return [...groups.values()].sort((a,b)=>order.indexOf(a.kind)-order.indexOf(b.kind)||(a.kind==='course'&&a.report===b.report?(a.semester?semesters.indexOf(a.semester):semesters.length)-(b.semester?semesters.indexOf(b.semester):semesters.length):0));
}
