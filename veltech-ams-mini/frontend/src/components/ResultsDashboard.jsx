import {useEffect,useId,useRef,useState} from 'react';
import {Link} from 'react-router-dom';
import {ChevronDown,ChevronRight,Download,TrendingUp,GraduationCap,FileText,Search,Percent,RotateCcw,SlidersHorizontal} from 'lucide-react';
import {resultSemesters,resultMetrics,resultReportGroups,resultTrend,resultAssessmentFields,resultReportLabel,filterResults,hasResultMark} from '../lib/academic-results';
import {statementStudent} from '../lib/statement-student';
import useAcademicSummary from '../hooks/useAcademicSummary';
import {downloadFile} from '../lib/download';
import {Field,Button,EmptyState} from './UI';
import GpaCalculator from './GpaCalculator';
import ResultsCalculationSettings from './ResultsCalculationSettings';
import '../academic-results.css';
import '../academic-clarity.css';

const marks=resultAssessmentFields;
const reportName=resultReportLabel;
const format=value=>value===null?'—':value.toFixed(2);

function PerformanceGraph({points,title,assessment=false,chooseAssessment=false,semesterTrend=false,cumulative=false,estimated=false,converted=false}){
 const unit=assessment?'marks':semesterTrend?'GPA':'grade points';
 const plot=useRef(null),gradient=useId().replaceAll(':',''),instructions=useId();
 const [width,setWidth]=useState(600),[active,setActive]=useState(()=>Math.max(0,points.findLastIndex(point=>point.value!==null)));
 const available=points.filter(point=>point.value!==null),hasValues=available.length>0;
 useEffect(()=>{
  if(!plot.current)return;
  const observer=new ResizeObserver(([entry])=>setWidth(Math.max(semesterTrend?points.length*48:340,Math.round(entry.contentRect.width))));
  observer.observe(plot.current);return()=>observer.disconnect();
 },[hasValues,semesterTrend,points.length]);
 const left=36,right=width-14,top=16,bottom=184,maximum=Math.ceil(Math.max(1,...available.map(point=>point.value))/2)*2;
 const x=index=>points.length<2?(left+right)/2:left+index*(right-left)/(points.length-1),y=value=>bottom-value/maximum*(bottom-top);
 useEffect(()=>{
  const node=plot.current,scroller=node?.parentElement;
  if(!node || !scroller || !hasValues)return;
  const position=(points.length<2?(left+right)/2:left+active*(right-left)/(points.length-1))*node.clientWidth/width;
  if(position<scroller.scrollLeft+28)scroller.scrollLeft=Math.max(0,position-28);
  else if(position>scroller.scrollLeft+scroller.clientWidth-28)scroller.scrollLeft=position-scroller.clientWidth+28;
 },[active,width,hasValues,points.length,left,right]);
 const current=points[active] || points[0],segments=[];
 for(let index=0;index<points.length;index++){
  if(points[index].value===null)continue;
  if(index===0 || points[index-1].value===null)segments.push([]);
  segments.at(-1).push({x:x(index),y:y(points[index].value)});
 }
 function selectPointer(event){
  const rect=event.currentTarget.getBoundingClientRect(),position=(event.clientX-rect.left)/rect.width*width;
  setActive(points.length<2?0:Math.max(0,Math.min(points.length-1,Math.round((position-left)/(right-left)*(points.length-1)))));
 }
 function selectKey(event){
  const actions={ArrowLeft:Math.max(0,active-1),ArrowRight:Math.min(points.length-1,active+1),Home:0,End:points.length-1};
  if(Object.hasOwn(actions,event.key)){event.preventDefault();setActive(actions[event.key]);}
 }
 const valueText=current?`${current.label}: ${current.value===null?'numeric value unavailable':`${format(current.value)} ${unit}`}`:'';
 return <figure className="performance-graph">
  <figcaption><span><TrendingUp size={18}/>{title}</span><small>{assessment?'Source assessment marks':cumulative?'Cumulative CGPA':semesterTrend?'Semester GPA':'Source grade points'}</small></figcaption>
  {hasValues?<>
   <div className="performance-readout"><div><strong>{format(current?.value??null)}</strong><span>{current?.label}{current?.contextLabel?<small>{current.contextLabel}</small>:null}</span></div><small>{current?.detail || `Explicit source ${unit}`}{current?.value===null?' · Numeric value unavailable':''}</small></div>
   <p className="performance-axis-label">{assessment?'Score · raw marks':cumulative?'Cumulative CGPA':semesterTrend?'Semester GPA':'Grade points'}</p><div className="performance-scroll"><div ref={plot} className="performance-plot" style={semesterTrend?{minWidth:points.length*48}:undefined} tabIndex={0} role="slider" aria-label={`${title}; selected data point`} aria-orientation="horizontal" aria-valuemin={1} aria-valuemax={points.length} aria-valuenow={active+1} aria-valuetext={valueText} aria-describedby={instructions} onKeyDown={selectKey} onPointerMove={selectPointer} onPointerDown={selectPointer}>
    <svg viewBox={`0 0 ${width} 222`} role="img" aria-label={title}>
     <title>{title}</title><desc>Numeric result values are plotted with their published, calculated or estimated context. Missing values leave gaps.</desc>
     <defs><linearGradient id={gradient} x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor="#0a66c2" stopOpacity=".2"/><stop offset="100%" stopColor="#0a66c2" stopOpacity=".015"/></linearGradient></defs>
     {[0,.25,.5,.75,1].map(value=><g key={value}><line x1={left} x2={right} y1={y(value*maximum)} y2={y(value*maximum)} stroke="#e2eaf3" strokeDasharray="3 5"/><text x={left-9} y={y(value*maximum)+4} textAnchor="end" fontSize="12" fill="#72849b">{Number((value*maximum).toFixed(1))}</text></g>)}
     {segments.map((segment,index)=>{const line=segment.map((point,i)=>`${i?'L':'M'}${point.x},${point.y}`).join(' ');return <g key={index}>{segment.length>1?<path d={`${line} L${segment.at(-1).x},${bottom} L${segment[0].x},${bottom} Z`} fill={`url(#${gradient})`}/>:null}<path d={line} fill="none" stroke="#0a66c2" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round"/></g>;})}
     {points.map((point,index)=>point.value!==null?<circle key={index} cx={x(index)} cy={y(point.value)} r={index===active?5:3} fill={index===active?'#0a66c2':'white'} stroke="#0a66c2" strokeWidth="2"/>:null)}
     {points.map((point,index)=>point.value!==null && (points.length<=8 || index===active)?<text key={'score'+index} x={Math.max(left+10,Math.min(right-12,x(index)))} y={Math.max(top+12,y(point.value)-10)} textAnchor="middle" fontSize="12" fontWeight="600" fill="#164878">{Number(point.value.toFixed(2))}</text>:null)}
     {current?<line x1={x(active)} x2={x(active)} y1={top} y2={bottom} stroke="#0a66c2" strokeOpacity=".35" strokeDasharray="3 4"/>:null}
     {current?.value!==null && current?.value!==undefined?<line x1={left} x2={right} y1={y(current.value)} y2={y(current.value)} stroke="#0a66c2" strokeOpacity=".2" strokeDasharray="3 4"/>:null}
     {points.map((point,index)=>index%Math.max(1,Math.ceil(points.length/(width<340?3:6)))===0 || index===points.length-1?<text key={index} x={x(index)} y="208" textAnchor={index===0?'start':index===points.length-1?'end':'middle'} fontSize="12" fill="#62758c">{point.shortLabel || point.label.slice(0,12)}</text>:null)}
    </svg>
   </div>
   </div><div className="performance-legend"><span><i/>{estimated?'Includes calculated estimates':converted?'Includes official grade conversions':'Numeric source values'}</span><small id={instructions}>Hover, tap or use arrow keys</small></div>
   {estimated?<p className="performance-note">Some points use the selected 10-point grade estimate. Published values take priority; the official transcript remains authoritative.</p>:converted?<p className="performance-note">Some points use the documented grade scale for your official programme and regulation.</p>:null}
   {points.some(point=>point.value===null)?<p className="performance-note">{assessment?'Gaps indicate missing or non-numeric source marks. Marks from different assessments are never combined.':'Gaps indicate missing credits or grade points, or repeated course attempts. No value is estimated.'}</p>:null}
  </>:<div className="performance-unavailable"><span><TrendingUp size={26}/></span><strong>{chooseAssessment?'Choose an assessment to see its trend':'A numeric trend is not available'}</strong><p>{chooseAssessment?'Select a test, mid-test, lab, assignment or final internal above. Each source mark uses its own scale.':assessment?'This selection has no numeric source marks for the chosen assessment. Original marks remain visible in the reports below.':'AMS has not supplied complete credits and numeric grade points for this selection. Letter grades are shown in the reports below.'}</p></div>}
 </figure>;
}

function ResultReport({group,view,index,assessment}){
 const fields=Object.entries(marks).filter(([field])=>(assessment==='all' || assessment===field) && group.rows.some(row=>hasResultMark(row,field)));
 return <details className="academic-report" open={index===0}>
  <summary><span className="academic-report-icon"><FileText size={17}/></span><span className="academic-report-title"><strong>{group.report}</strong><small>{group.semester?`Semester ${group.semester}`:'Semester not provided'}{group.session?` · ${group.session}`:''}{group.sourceReport && group.sourceReport!==group.report?` · ${group.sourceReport}`:''}</small></span><span className="academic-report-count">{group.rows.length} {group.rows.length===1?'record':'records'}</span><ChevronDown size={17} className="academic-report-chevron"/></summary>
  <div className="table-scroll"><table className="academic-detail-table" style={view==='assessments'?{minWidth:Math.max(280,195+fields.length*80)}:undefined}><caption className="sr-only">{group.report}, {group.semester?`Semester ${group.semester}`:'semester not provided'}{group.session?`, ${group.session}`:''}{group.sourceReport?`, ${group.sourceReport}`:''}</caption><thead><tr><th>Course / subject</th>{view==='grades'?<><th>Result</th><th>Grade</th><th>Credits</th><th>Grade points</th></>:fields.length?fields.map(([field,label])=><th key={field}>{label}</th>):<th>Source marks</th>}</tr></thead><tbody>{group.rows.map((row,index)=><tr key={`${row.courseCode}:${index}`}><td><strong>{row.courseName || row.courseCode || 'Course not provided'}</strong><small className="result-course-code">{row.courseCode}</small></td>{view==='grades'?<><td>{row.status || '—'}</td><td><b className="result-grade">{row.grade}</b></td><td>{row.credits??'—'}</td><td>{row.gradePoints??'—'}{row.creditClassificationConflict?<small>Non-credit grade · check source credits</small>:row.gradePointSource==='calculation'?<small>Estimated</small>:row.gradePointSource==='official-regulation'?<small>Regulation conversion</small>:null}</td></>:fields.length?fields.map(([field])=><td className="result-assessment-value" key={field}>{hasResultMark(row,field)?row[field]:'—'}</td>):<td>Marks not provided by source</td>}</tr>)}</tbody></table></div>
 </details>;
}

export default function ResultsDashboard(props){return <ResultsWorkspace key={`${props.mode || 'connected'}:${props.accountKey || 'preview'}`} {...props}/>;}
function ResultsWorkspace({results=[],credits=[],gradeScale=[],creditSummary=[],mode='connected',accountKey='',studentProfile={}}){
 const queryId=useId(),mounted=useRef(false);
 const {prepared,sourcePrepared,overall,percentage,estimatedPoints,creditConflict,contextIncomplete,calculation,setCalculation,calculationOwner,retryPolicies,canRetryPolicies}=useAcademicSummary({results,credits,gradeScale,creditSummary,mode,accountKey,studentProfile});
 const currentOwner=useRef(calculationOwner);currentOwner.current=calculationOwner;
 const [exporting,setExporting]=useState(''),[overallView,setOverallView]=useState('cgpa');
 useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;};},[]);
 const [semester,setSemester]=useState('all'),[view,setView]=useState('grades'),[exam,setExam]=useState('all'),[kind,setKind]=useState('all'),[query,setQuery]=useState(''),[assessment,setAssessment]=useState('all'),[exportError,setExportError]=useState('');
 const pool=view==='grades'?prepared.grades:prepared.assessments;
 const reports=[...new Set(pool.map(reportName))],reportRows=filterResults(pool,{report:kind});
 const semesters=resultSemesters(reportRows),semesterRows=filterResults(reportRows,{semester});
 const exams=[...new Set(semesterRows.map(row=>row.examinationSession).filter(Boolean))];
 const availableAssessments=Object.entries(marks).filter(([field])=>pool.some(row=>hasResultMark(row,field)));
 const filters={report:kind,semester,session:exam,query,assessment:view==='assessments'?assessment:'all'};
 const selected=filterResults(pool,filters),groups=resultReportGroups(selected),current=resultMetrics(selected);
 const overallPoints=overallView==='cgpa'?overall.cgpaPoints:overall.points;
 const graph=view==='grades'?resultTrend(selected,semester):[];
 const distribution=[...selected.reduce((counts,row)=>{if(row.grade)counts.set(String(row.grade),(counts.get(String(row.grade)) || 0)+1);return counts;},new Map())];
 const filtered=semester!=='all' || kind!=='all' || exam!=='all' || query.trim() || assessment!=='all';
 function resetFilters(){setSemester('all');setExam('all');setKind('all');setQuery('');setAssessment('all');setExportError('');}
 function changeView(value){setView(value);resetFilters();}
 async function exportReport(type){
  if(exporting)return;setExporting(type);
  try{
   const {createResultsReport,resultsPdf,resultsXlsx}=await import('../lib/results-export');if(!mounted.current || currentOwner.current!==calculationOwner)return;
   const exportRows=selected.map(row=>{if(!['calculation','official-regulation'].includes(row.gradePointSource))return row;const copy={...row};delete copy.gradePoints;return copy;});
   const report=createResultsReport({rows:exportRows,filters,view,summary:creditSummary,mode,student:type==='pdf'?statementStudent(studentProfile,mode):{}});
   const filename=`veltech-ams-results-${view}-semester-${semester.replace(/[^a-z0-9_-]/gi,'_')}`;
   downloadFile(`${filename}.${type}`,type==='pdf'?resultsPdf(report):resultsXlsx(report),type==='pdf'?'application/pdf':'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');setExportError('');
  }catch(error){if(mounted.current && currentOwner.current===calculationOwner)setExportError(error.message || 'The report could not be exported. Try another selection.');}finally{if(mounted.current && currentOwner.current===calculationOwner)setExporting('');}
 }
 return <div className="results-dashboard">
  {contextIncomplete && overall.cgpaSource!=='published'?<p className="feedback error" role="status">Programme information is incomplete in this saved record. Reconnect before converting letter grades.</p>:null}
  {creditConflict?<p className="feedback error" role="status">Some non-credit grades have positive course credits in the source. Calculated averages need review; published AMS values are retained.</p>:null}
  {view==='grades'?<section className="results-overview" aria-label="Overall results overview">
  <div className="results-overall">
   <div><span><GraduationCap size={16}/>Overall CGPA</span><strong>{format(overall.cgpa)}</strong><small>{overall.cgpaSource==='published'?'Published by AMS':overall.cgpaSource==='calculated'?estimatedPoints?'Calculated estimate · selected 10-point scale':'Calculated from available credits and verified grade points':'Waiting for source credits or grade points. Check Calculation rules below.'}</small></div>
   <div><span><Percent size={15}/>Overall percentage</span><strong>{percentage.value===null?'—':`${format(percentage.value)}%`}</strong><small>{percentage.source==='published'?(mode==='demo'?'Fictional preview value':'Published by AMS'):percentage.source==='project-rule'?'Project estimate · (CGPA − 0.5) × 10':percentage.source==='legacy-rule'?'Administrator-confirmed legacy cohort rule':percentage.source==='official-rule'?`${estimatedPoints && overall.cgpaSource!=='published'?'Estimate using':'Official conversion'} · ${percentage.rule.regulation}`:percentage.source==='batch-rule'?`${estimatedPoints && overall.cgpaSource!=='published'?'Estimate using':'Administrator-confirmed rule'} · ${percentage.rule.regulation}`:percentage.reason || 'Not available for these records.'}</small>{canRetryPolicies && percentage.source!=='published'?<button type="button" className="text-button" onClick={retryPolicies}>Retry conversion rules</button>:null}</div>
  </div>
   {percentage.rule?<p className="batch-rule-note">{percentage.source==='project-rule'?'Project estimate: ':''}Percentage = {percentage.rule.offset?`(CGPA − ${percentage.rule.offset})`:'CGPA'} × {percentage.rule.factor}.{percentage.rule.sourceUrl?<> <a href={percentage.rule.sourceUrl} target="_blank" rel="noopener noreferrer">{percentage.rule.regulation} · {percentage.rule.sourceClause}</a></>:null}</p>:null}
   <div className="results-overview-switch" role="group" aria-label="Overall graph metric"><button aria-pressed={overallView==='cgpa'} onClick={()=>setOverallView('cgpa')}>CGPA trend</button><button aria-pressed={overallView==='gpa'} onClick={()=>setOverallView('gpa')}>Semester GPA</button></div>
   <PerformanceGraph key={`${overallView}:${calculation.scheme}`} points={overallPoints} title="Overall performance · all semesters" semesterTrend cumulative={overallView==='cgpa'} estimated={estimatedPoints} converted={prepared.grades.some(row=>row.gradePointSource==='official-regulation')}/>
  </section>:null}
  <Link className="results-marks-link" to="/academics?section=marks"><span><strong>Looking for test or internal marks?</strong><small>Open Marks for unit tests, mid-terms, lab and internal assessments.</small></span><ChevronRight size={20}/></Link>
  <div className="results-primary-filters">
   <Field label="Semester"><select value={semester} onChange={event=>{setSemester(event.target.value);setExam('all');}}><option value="all">All source semesters</option>{semesters.map(label=><option key={label} value={label}>Semester {label}</option>)}</select></Field>
   <div className="field"><label htmlFor={queryId}>Search subject</label><span className="results-subject-search"><Search size={15}/><input id={queryId} aria-label="Search subject" type="search" placeholder="Course name or code" value={query} onChange={event=>setQuery(event.target.value)}/></span></div>
  </div>
  <details className="academic-tools" aria-label="Advanced result tools"><summary><SlidersHorizontal size={16}/><span>Filters & calculation tools</span><small>{filtered?'Filters applied':'Optional'}</small><ChevronDown size={16}/></summary><div className="academic-tools-content">
  <div className="results-selection-summary results-overall">
   <div><span>{view==='grades'?'Selected course average':'Assessment fields'}</span><strong>{view==='grades'?format(current.complete?current.value:null):(assessment==='all'?'All marks':marks[assessment])}</strong><small>{view==='grades'?current.complete?`${selected.some(row=>row.gradePointSource==='calculation')?'Estimate · selected 10-point scale · ':''}Credit-weighted · ${current.credits} credits`:'Complete, unambiguous credits and grade points required':'Original test, mid-test and assignment marks are shown below.'}</small></div>
   <div><span>Selected records</span><strong>{selected.length}</strong><small>{groups.length} report divisions · {resultSemesters(selected).length} source semesters</small></div>
  </div>
  <div className="academic-view-switch" role="group" aria-label="Result record category"><button type="button" aria-pressed={view==='grades'} onClick={()=>changeView('grades')}>Final results<span>{prepared.grades.length}</span></button><button type="button" aria-pressed={view==='assessments'} onClick={()=>changeView('assessments')}>Assessment & internal<span>{prepared.assessments.length}</span></button></div>
  <div className="results-filters">
   <Field label="Source report"><select value={kind} onChange={event=>{setKind(event.target.value);setSemester('all');setExam('all');}}><option value="all">{view==='grades'?'All final result reports':'All assessment reports'}</option>{reports.map(report=><option key={report} value={report}>{report} ({pool.filter(row=>reportName(row)===report).length})</option>)}</select></Field>

   {exams.length?<Field label="Examination session"><select value={exam} onChange={event=>setExam(event.target.value)}><option value="all">All examination sessions</option>{exams.map(session=><option key={session} value={session}>{session}</option>)}</select></Field>:null}
   {view==='assessments'?<Field label="Assessment"><select value={assessment} onChange={event=>setAssessment(event.target.value)}><option value="all">All assessment fields</option>{availableAssessments.map(([field,label])=><option key={field} value={field}>{label}</option>)}</select></Field>:null}

  </div>
  {view==='grades' && filtered?<PerformanceGraph key={JSON.stringify([kind,semester,exam,query,graph.map(point=>point.label)])} points={graph} title={semester==='all'?'Selected semester performance':`Semester ${semester} · course performance`} estimated={selected.some(row=>row.gradePointSource==='calculation')} converted={selected.some(row=>row.gradePointSource==='official-regulation')}/>:null}
  {view==='grades' && !graph.some(point=>point.value!==null) && distribution.length?<div className="result-distribution"><span>Source grade distribution</span><div>{distribution.map(([grade,count])=><span key={grade}><b>{grade}</b>{count} {count===1?'record':'records'}</span>)}</div></div>:null}
  {view==='assessments'?<p className="academic-report-explanation">Tests, mid-tests, lab, assignments and final internal marks have separate columns. Each report retains the original semester, source marks and examination session.</p>:null}
  {view==='grades'?<ResultsCalculationSettings value={calculation} onSave={setCalculation}/>:null}
  {view==='grades'?<GpaCalculator results={sourcePrepared.grades} mode={mode} accountKey={accountKey}/>:null}
  </div></details>
  <div className="results-selection-status"><p role="status">{selected.length} of {pool.length} {view==='grades'?'final result':'assessment'} records{semester!=='all'?` · Semester ${semester}`:''}{query.trim()?` · Matching “${query.trim()}”`:''}</p>{filtered?<button type="button" onClick={resetFilters}><RotateCcw size={12}/>Reset filters</button>:null}</div>
  <div className="academic-record-heading"><div><h3>{view==='grades'?'Final result reports':'Assessment reports'}</h3><p>{selected.length} records · {groups.length} {groups.length===1?'report division':'report divisions'}</p></div><div className="results-export-actions"><Button variant="secondary" disabled={!selected.length || !!exporting} busy={exporting==='xlsx'} onClick={()=>exportReport('xlsx')}><Download size={15}/>Export Excel</Button><Button variant="secondary" disabled={!selected.length || semester==='all' || !!exporting} busy={exporting==='pdf'} onClick={()=>exportReport('pdf')}><FileText size={15}/>Semester PDF</Button></div></div>
  <p className="results-export-note">{semester==='all'?'Select a semester to download its PDF report. ':''}The semester PDF uses the college marks-statement layout and current filters. Excel keeps source reports on separate sheets.</p>
  {exportError?<p className="results-export-error" role="alert">{exportError}</p>:null}
  {groups.length?<div className="academic-report-list">{groups.map((group,index)=><ResultReport key={group.key} group={group} view={view} assessment={assessment} index={index}/>)}</div>:<EmptyState title={query.trim()?'No subjects match your search':'No results in this selection'} description={query.trim()?'Try a course code, a shorter subject name or reset your filters.':'Choose another semester, source report or assessment to view available records.'} action={filtered?'Reset filters':undefined} onAction={resetFilters}/>}
  <p className="page-footnote">Reports retain the semester, source report and examination session supplied by AMS. Published values take priority. Calculated averages use explicit credits; any selected grade estimate or official regulation conversion is labelled. Repeated or incomplete records prevent a complete average. Your official transcript remains authoritative.</p>
 </div>;
}
