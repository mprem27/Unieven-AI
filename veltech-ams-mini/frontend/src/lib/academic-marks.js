import {academicNumber} from './gpa.js';
import {resultAssessmentFields,hasResultMark,resultReportLabel,resultReportGroups} from './academic-results.js';

export const marksDivisions={
 unit:{label:'Unit tests',fields:['testMark1','testMark2','testMark3','midTestMark1','midTestMark2']},
 lab:{label:'Lab',fields:['labMark']},
 internal:{label:'Internal',fields:['assignmentMark','internalMark']},
};
export function academicSemesterKey(value){
 const text=String(value ?? '').trim().replace(/^(?:semester|sem)\s*[-:]?\s*/i,'').toUpperCase();
 const roman=['I','II','III','IV','V','VI','VII','VIII','IX','X','XI','XII','XIII','XIV','XV','XVI','XVII','XVIII','XIX','XX'];
 return roman.includes(text)?String(roman.indexOf(text)+1):/^\d+$/.test(text)?String(Number(text)):text;
}
const hasMarks=row=>Object.keys(resultAssessmentFields).some(field=>hasResultMark(row,field));
const assessmentRow=row=>hasMarks(row) || (!row.grade && Boolean(row.courseCode || row.subjectCode || row.courseName || row.subjectName));
function semesterOptions(rows){
 const map=new Map();
 for(const row of rows){const key=academicSemesterKey(row.semester);if(!key)continue;if(!map.has(key))map.set(key,{key,label:`Semester ${key}`,sourceLabels:[]});const labels=map.get(key).sourceLabels,label=String(row.semester).trim();if(!labels.includes(label))labels.push(label);}
 return [...map.values()].sort((a,b)=>a.key.localeCompare(b.key,undefined,{numeric:true}));
}
export function selectMarks(rows=[],filters={}){
 const division=Object.hasOwn(marksDivisions,filters.division)?filters.division:'unit',definition=marksDivisions[division];
 const fields=definition.fields.filter(field=>!filters.assessment || filters.assessment==='all' || filters.assessment===field);
 const pool=rows.filter(assessmentRow),query=String(filters.query || '').trim().toLocaleLowerCase();
 const sourceRows=pool.filter(row=>(!filters.report || filters.report==='all' || resultReportLabel(row)===filters.report));
 const semesterRows=sourceRows.filter(row=>(!filters.semester || filters.semester==='all' || academicSemesterKey(row.semester)===academicSemesterKey(filters.semester)));
 const selected=semesterRows.filter(row=>(!filters.session || filters.session==='all' || String(row.examinationSession || '')===filters.session) && (!query || `${row.courseCode || row.subjectCode || ''} ${row.courseName || row.subjectName || ''}`.toLocaleLowerCase().includes(query)) && (fields.some(field=>hasResultMark(row,field)) || (!hasMarks(row) && (!filters.assessment || filters.assessment==='all'))));
 const groups=resultReportGroups(selected).sort((a,b)=>academicSemesterKey(a.semester).localeCompare(academicSemesterKey(b.semester),undefined,{numeric:true}) || selected.indexOf(a.rows[0])-selected.indexOf(b.rows[0]));
 return {rows:selected,groups,pool,fields,division,filters:{...filters,division},semesters:semesterOptions(sourceRows),reports:[...new Set(pool.map(resultReportLabel))],sessions:[...new Set(semesterRows.map(row=>String(row.examinationSession || '')).filter(Boolean))]};
}

// A maximum belongs to one assessment. A generic course maximum is ambiguous
// when a source row carries several tests, and must never become their scale.
export function markCell(row,field){
 const raw=row[field];
 if(Array.isArray(raw)){
  const values=[...new Set(raw.map(value=>String(value ?? '').trim()).filter(Boolean))];
  if(values.length>1)return {text:`Source values disagree: ${values.join(' · ')}`,state:'conflict',value:null,maximum:null,note:'Conflicting source marks; no score selected.'};
  return markCell({...row,[field]:values[0]},field);
 }
 if(raw!==null && typeof raw==='object')return {text:'Source value unavailable',state:'unavailable',value:null,maximum:null,note:'Unrecognized source mark format.'};
 if(raw===null || raw===undefined || String(raw).trim()==='')return {text:'Not updated',state:'unavailable',value:null,maximum:null,note:''};
 const text=String(raw).trim(),value=academicNumber(raw);
 const supplied=[row[`${field}Max`],row[`${field}Maximum`],row.markMaximums?.[field]].filter(item=>item!==undefined && item!==null && String(item).trim()!=='');
 const maxima=[...new Set(supplied.map(academicNumber).filter(item=>item!==null && item>0))];
 const invalid=supplied.some(item=>academicNumber(item)===null || academicNumber(item)<=0);
 const conflicting=maxima.length>1,maximum=!invalid && !conflicting && maxima.length===1?maxima[0]:null;
 const state=/^(?:ab|abs|absent)$/i.test(text)?'absent':value!==null?'numeric':'unavailable';
 return {text:value!==null && maximum!==null?`${text} / ${maximum}`:text,state,value,maximum,note:invalid?'Invalid source maximum; denominator withheld.':conflicting?'Conflicting source maxima; denominator withheld.':value!==null && maximum!==null && value>maximum?'Source mark exceeds its supplied maximum.':''};
}

// Both download formats receive this exact projection of the visible records.
// Formatting an explicit maximum into the source cell keeps the existing report
// writer honest without inventing a course-wide or screenshot-derived scale.
export function marksExportSelection(selection){
 const rows=selection.rows.map(row=>{
  const copy={...row};
  for(const field of Object.keys(resultAssessmentFields)){
   if(!selection.fields.includes(field)){delete copy[field];continue;}
   if(hasResultMark(row,field)){const cell=markCell(row,field);if(cell.maximum!==null || cell.state==='conflict' || typeof row[field]==='object')copy[field]=cell.text;}
  }
  return copy;
 });
 const {division,...filters}=selection.filters;
 return {rows,filters:{...filters,assessment:filters.assessment || 'all'}};
}
