import {useEffect,useId,useMemo,useRef,useState} from 'react';
import {ChevronDown,Download,FileText,Search,SlidersHorizontal,RotateCcw} from 'lucide-react';
import {marksDivisions,selectMarks,markCell,marksExportSelection} from '../lib/academic-marks';
import {hasResultMark,resultAssessmentFields} from '../lib/academic-results';
import {statementStudent} from '../lib/statement-student';
import {downloadFile} from '../lib/download';
import {Button,EmptyState,Field} from './UI';
import '../academic-clarity.css';

function MarkValues({row,fields}){
 return <dl className="marks-values">{fields.map(field=>{const cell=markCell(row,field);return <div key={field}><dt>{resultAssessmentFields[field]}</dt><dd className={`marks-cell marks-cell-${cell.state}`}><span>{cell.text}</span>{cell.note?<small>{cell.note}</small>:null}</dd></div>;})}</dl>;
}
function SubjectMarks({row,fields}){
 const testFields=fields.filter(field=>!field.startsWith('midTest')),midFields=fields.filter(field=>field.startsWith('midTest'));
 const tests=testFields.some(field=>hasResultMark(row,field))?testFields:[],mids=midFields.some(field=>hasResultMark(row,field))?midFields:[];
 return <article className="marks-subject"><div className="marks-subject-heading"><span>{row.courseCode || row.subjectCode || 'Code not provided'}</span><h4>{row.courseName || row.subjectName || 'Subject not provided'}</h4></div>
  {tests.length?<MarkValues row={row} fields={tests}/>:null}
  {mids.length?<section className="marks-midterms" aria-label="Mid-term marks"><h5>Mid-term</h5><MarkValues row={row} fields={mids}/></section>:null}
 </article>;
}

export default function MarksDashboard({results=[],mode='connected',accountKey='',studentProfile={}}){
 const searchId=useId(),owner=`${mode}:${accountKey || 'preview'}`,currentOwner=useRef(owner),mounted=useRef(true);
 currentOwner.current=owner;
 useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;};},[]);
 // A keyed owner keeps a prior student's filters and in-flight exports isolated.
 return <MarksWorkspace key={owner} {...{results,mode,studentProfile,owner,currentOwner,searchId,mounted}}/>;
}
function MarksWorkspace({results,mode,studentProfile,owner,currentOwner,searchId,mounted}){
 const [semester,setSemester]=useState('all'),[division,setDivision]=useState('unit'),[query,setQuery]=useState(''),[report,setReport]=useState('all'),[session,setSession]=useState('all'),[assessment,setAssessment]=useState('all');
 const [exporting,setExporting]=useState(''),[exportError,setExportError]=useState('');
 const selection=useMemo(()=>selectMarks(results,{semester,division,query,report,session,assessment}),[results,semester,division,query,report,session,assessment]);
 const filtered=semester!=='all' || query.trim() || report!=='all' || session!=='all' || assessment!=='all';
 function reset(){setSemester('all');setQuery('');setReport('all');setSession('all');setAssessment('all');setExportError('');}
 async function exportReport(type){
  if(exporting)return;setExporting(type);
  try{
   const {createResultsReport,resultsPdf,resultsXlsx}=await import('../lib/results-export');
   if(!mounted.current || currentOwner.current!==owner)return;
   const model=createResultsReport({...marksExportSelection(selection),view:'assessments',mode,student:type==='pdf'?statementStudent(studentProfile,mode):{}});
   const bytes=type==='pdf'?resultsPdf(model):resultsXlsx(model);
   if(!mounted.current || currentOwner.current!==owner)return;
   downloadFile(`veltech-ams-marks-${division}-semester-${semester.replace(/[^a-z0-9_-]/gi,'_')}.${type}`,bytes,type==='pdf'?'application/pdf':'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');setExportError('');
  }catch(error){if(mounted.current && currentOwner.current===owner)setExportError(error.message || 'The report could not be exported. Try another selection.');}
  finally{if(mounted.current && currentOwner.current===owner)setExporting('');}
 }
 return <div className="marks-dashboard">
  <p className="marks-intro">Unit tests, mid-terms, lab and internal marks from your source reports.</p>
  <div className="marks-semesters" role="group" aria-label="Marks semester"><button type="button" aria-pressed={semester==='all'} onClick={()=>{setSemester('all');setSession('all');}}>All</button>{selection.semesters.map(item=><button type="button" key={item.key} title={`${item.label} · Source: ${item.sourceLabels.join(', ')}`} aria-label={item.label} aria-pressed={semester===item.key} onClick={()=>{setSemester(item.key);setSession('all');}}>S{item.key}</button>)}</div>
  <div className="marks-divisions" role="group" aria-label="Mark division">{Object.entries(marksDivisions).map(([key,item])=><button type="button" key={key} aria-pressed={division===key} onClick={()=>{setDivision(key);setAssessment('all');}}>{item.label}</button>)}</div>
  <div className="marks-search"><Search size={20}/><input id={searchId} type="search" aria-label="Search marks by subject" placeholder="Search subjects by code or name…" value={query} onChange={event=>setQuery(event.target.value)}/></div>
  <details className="academic-tools marks-source-tools"><summary><SlidersHorizontal size={16}/><span>Report & assessment filters</span><small>{report!=='all' || session!=='all' || assessment!=='all'?'Filters applied':'All source reports'}</small><ChevronDown size={16}/></summary><div className="academic-tools-content results-filters">
   <Field label="Source report"><select value={report} onChange={event=>{setReport(event.target.value);setSemester('all');setSession('all');}}><option value="all">All assessment reports</option>{selection.reports.map(label=><option key={label} value={label}>{label}</option>)}</select></Field>
   <Field label="Examination session"><select value={session} onChange={event=>setSession(event.target.value)}><option value="all">All examination sessions</option>{selection.sessions.map(label=><option key={label} value={label}>{label}</option>)}</select></Field>
   <Field label="Assessment"><select value={assessment} onChange={event=>setAssessment(event.target.value)}><option value="all">All {marksDivisions[division].label.toLowerCase()} fields</option>{marksDivisions[division].fields.map(field=><option key={field} value={field}>{resultAssessmentFields[field]}</option>)}</select></Field>
  </div></details>
  <div className="marks-selection-status"><p role="status">{selection.rows.length} {selection.rows.length===1?'record':'records'} · {selection.groups.length} {selection.groups.length===1?'report':'reports'}</p>{filtered?<button type="button" onClick={reset}><RotateCcw size={14}/>Reset filters</button>:null}</div>
  {selection.groups.length?<div className="marks-reports">{selection.groups.map(group=><section className="marks-report" key={group.key} aria-label={`${group.report}, semester ${group.semester || 'not supplied'}, ${group.session || 'session not supplied'}`}><header><div><h3>{group.report}</h3><p>{group.semester?`Semester ${group.semester}`:'Semester not provided'}{group.session?` · ${group.session}`:''}{group.sourceReport && group.sourceReport!==group.report?` · ${group.sourceReport}`:''}</p></div><span>{group.rows.length} {group.rows.length===1?'record':'records'}</span></header><div className="marks-subjects">{group.rows.map((row,index)=><SubjectMarks key={`${row.courseCode || row.subjectCode || 'subject'}:${index}`} row={row} fields={selection.fields}/>)}</div></section>)}</div>:<EmptyState title={query.trim()?'No subjects match your search':`No ${marksDivisions[division].label.toLowerCase()} in this selection`} description={query.trim()?'Try a shorter subject name or course code.':'Choose another semester or division. Marks appear when supplied by AMS.'} action={filtered?'Reset filters':undefined} onAction={reset}/>}
  <div className="marks-export-actions"><Button variant="secondary" disabled={!selection.rows.length || semester==='all' || !!exporting} busy={exporting==='pdf'} onClick={()=>exportReport('pdf')}><FileText size={17}/>Export as PDF</Button><Button variant="secondary" disabled={!selection.rows.length || !!exporting} busy={exporting==='xlsx'} onClick={()=>exportReport('xlsx')}><Download size={17}/>Export as Excel</Button></div>
  {exportError?<p className="results-export-error" role="alert">{exportError}</p>:null}
  <p className="marks-source-note">{semester==='all'?'Choose a semester for PDF export. ':''}Both downloads use the visible records and mark division. Reports and sessions stay separate. “Not updated” means no mark was supplied; zero and absence remain as reported. A denominator appears only when this assessment has a source maximum.</p>
 </div>;
}
