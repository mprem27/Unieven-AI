import {Link} from 'react-router-dom';
import {BookOpen,FileText,ChartNoAxesColumn,Wallet,FolderOpen,ExternalLink,Download,ArrowLeft,ClipboardList,Info,LayoutGrid} from 'lucide-react';
import {useCampus} from '../context/CampusContext';
import {useLiveResource} from '../hooks/useLiveResource';
import {academicDate,academicTime,academicSourceName,safeAcademicUrl,officialAmsUrl,sectionProvenance,visibleAcademicRows,academicModuleStatus,academicFileUrl} from '../lib/academic-source';
import {academicSection} from '../lib/student-navigation';
import {downloadRemote} from '../lib/download';
import {PageHeader,Button,EmptyState,Badge,Feedback} from '../components/UI';
import StudentDocuments from '../components/StudentDocuments';
import StudentExamSeating from '../components/StudentExamSeating';
import CreditDetails from '../components/CreditDetails';
import ResultsDashboard from '../components/ResultsDashboard';
import MarksDashboard from '../components/MarksDashboard';
import AcademicOverview from '../components/AcademicOverview';
import AcademicRules from '../components/AcademicRules';
import CourseRegistration from './CourseRegistration';
import './academic.css';
const categories=[['overview','Overview',LayoutGrid],['results','Results & grades',ChartNoAxesColumn],['marks','Marks',ClipboardList],['courses','Registered courses',BookOpen],['credits','Credit earned',BookOpen],['examinations','Examinations',FileText],['fees','Fees & receipts',Wallet],['documents','Documents',FolderOpen],['rules','Academic rules',Info]];
const missing={credits:'Credit-earned records have not been received for this account.',fees:'Fee or receipt records have not been received for this account.'};
function Examinations({items}){
 return <div className="academic-rows">{items.map((exam,index)=>{const url=safeAcademicUrl(exam.url);return <div key={exam.id || index}><span className="document-icon"><FileText/></span><div><h3>{exam.name || exam.title || 'Examination'}</h3>{exam.courseName || exam.courseCode?<p>{[exam.courseCode,exam.courseName].filter(Boolean).join(' · ')}</p>:null}<p>{academicDate(exam.date,exam.dateText)} · {exam.time || 'Time not provided'} · {exam.room || 'Room not provided'}</p>{exam.semester || exam.section || exam.department?<p>{[exam.department,exam.semester?`Semester ${exam.semester}`:'',exam.section?`Section ${exam.section}`:''].filter(Boolean).join(' · ')}</p>:null}{exam.notes?<p>{exam.notes}</p>:null}{exam.publishedBy?<small>Published by {exam.publishedBy}</small>:null}</div>{url?<a className="button secondary" href={url} target="_blank" rel="noopener noreferrer">Open document<ExternalLink size={14}/></a>:null}</div>;})}</div>;
}
function SectionSource({academic,tab,mode}){
 const key=tab==='marks'?'results':tab,rows=visibleAcademicRows(academic,key,mode),status=mode==='connected'?academicModuleStatus(academic,key):null,raw=sectionProvenance(academic,key,mode);
 const source=mode==='demo'?'sample-preview':!rows.length && ['results','fees','documents'].includes(key)?'unavailable':raw.source;
 return <div className="clarity-record-source"><div><strong>{academicSourceName(source)}</strong><span>{mode==='demo'?'Fictional sample records':status?.state && status.state!=='available'?rows.length?status.retained?'Saved records · update incomplete':'Records available · update unverified':'Data not available':status?.lastSuccessAt?`Updated ${academicTime(status.lastSuccessAt)}`:raw.updatedAt?`Updated ${academicTime(raw.updatedAt)}`:'No update received'}</span></div>{mode!=='demo'?<details><summary>Sync details</summary><p>{status?.lastSuccessAt?`Last successful update: ${academicTime(status.lastSuccessAt)}`:'This section has no successful update.'}</p>{status?.lastAttemptAt?<p>Last attempt: {academicTime(status.lastAttemptAt)}</p>:null}{status?.error?<p>{status.error}</p>:null}{status?.retained?<p>Previous records are retained until a new update succeeds.</p>:null}</details>:null}</div>;
}
export default function Academics({initialTab='overview',navigate}){
 const {data,mode,notify}=useCampus(),tab=academicSection(initialTab),academic=data.academic || {},accountId=data.profile.id;
 const facultyResource=useLiveResource('/academics/faculty-exams',mode==='connected' && tab==='examinations'),faculty=facultyResource.value?.examinations || [];
 const profile=mode==='connected'?(data.profile.officialProfile || {}):data.profile;
 const title=categories.find(([id])=>id===tab)?.[1] || 'Academics',items=visibleAcademicRows(academic,tab,mode),creditSummary=[...visibleAcademicRows(academic,'creditSummary',mode),...visibleAcademicRows(academic,'resultSummary',mode)];
 const sourceModule=academic.sourceModules?.find(module=>module.kind===(tab==='courses'?'course-registration':tab==='marks'?'results':tab)),official=officialAmsUrl(sourceModule?.url) || 'https://ams.veltech.edu.in/Default.aspx';
 const meta=[profile.department || profile.branch,profile.semester?`Semester ${profile.semester}`:'',profile.batch].filter(Boolean).join(' · ');
 if(tab==='overview')return <div className="clarity-academics"><PageHeader title="Academics" description={meta}/><AcademicOverview navigate={navigate}/></div>;
 return <div className={`clarity-academics academic-section-${tab}`}><Link className="clarity-academic-back" to="/academics"><ArrowLeft size={16}/>Academics</Link><PageHeader title={title} description={meta}/><div className="academic-layout"><nav className="academic-nav panel" aria-label="Academic sections">{categories.map(([id,label,Icon])=><button type="button" key={id} className={tab===id?'active':''} onClick={()=>navigate('academics',id)} aria-current={tab===id?'page':undefined}><Icon size={18}/>{label}</button>)}</nav><section className="academic-content panel">
  {!['examinations','rules','courses'].includes(tab)?<SectionSource academic={academic} tab={tab} mode={mode}/>:null}
  {tab==='courses'?<CourseRegistration embedded/>:null}
  {tab==='results'?<ResultsDashboard key={`${mode}:${accountId}`} results={visibleAcademicRows(academic,'results',mode)} credits={visibleAcademicRows(academic,'credits',mode)} gradeScale={visibleAcademicRows(academic,'gradeScale',mode)} creditSummary={creditSummary} mode={mode} accountKey={accountId} studentProfile={data.profile}/>:null}
  {tab==='marks'?<MarksDashboard key={`${mode}:${accountId}`} results={visibleAcademicRows(academic,'results',mode)} mode={mode} accountKey={accountId} studentProfile={data.profile}/>:null}
  {tab==='credits'?(items.length || creditSummary.length?<CreditDetails rows={items} summary={creditSummary}/>:<EmptyState title="Credit records not available" description={missing.credits}/>):null}
  {tab==='rules'?<AcademicRules profile={data.profile} mode={mode}/>:null}
  {tab==='documents'?<StudentDocuments amsDocuments={items}/>:null}
  {tab==='fees'?(items.length?<div className="academic-rows">{items.map((fee,index)=>{const url=mode==='connected'?academicFileUrl(fee):'';return <div key={index}><span className="document-icon"><Wallet/></span><div><h3>{fee.name || fee.title || 'College fee'}</h3><p>{academicDate(fee.date,fee.dateText)}{fee.reference?` · ${fee.reference}`:''}</p></div><strong>{fee.amount!==null && fee.amount!==undefined && fee.amount!=='' && Number.isFinite(Number(fee.amount))?`₹${Number(fee.amount).toLocaleString('en-IN')}`:'Amount not provided'}</strong><Badge status={/^paid$/i.test(fee.status || '')?'present':/due|unpaid|overdue/i.test(fee.status || '')?'absent':'neutral'}>{fee.status || 'Status not provided'}</Badge>{url?<button type="button" className="text-button" onClick={()=>downloadRemote(url,fee.name || 'Receipt').catch(error=>notify(error.message,'error'))}>Download receipt<Download size={14}/></button>:<span className="muted">Receipt unavailable</span>}</div>;})}</div>:<EmptyState title="Fee records not available" description={missing.fees}/>):null}
  {tab==='examinations'?<><StudentExamSeating/><Feedback error={facultyResource.error}/>{mode==='demo'?<Examinations items={items}/>:facultyResource.loading && !facultyResource.value?<p role="status">Loading published examinations…</p>:faculty.length?<Examinations items={faculty}/>:!facultyResource.error?<EmptyState title="No matching examinations" description={facultyResource.value?.message || 'Published exams will appear when they match your registered courses.'}/>:null}{facultyResource.value?.scheduleDocuments?.length?<div className="academic-rows">{facultyResource.value.scheduleDocuments.map(doc=><div key={doc.id}><FileText size={20}/><div><h3>{doc.title}</h3><p>{doc.name}</p></div><Button variant="secondary" onClick={()=>downloadRemote(doc.url,doc.name).catch(error=>notify(error.message,'error'))}><Download size={15}/>Schedule document</Button></div>)}</div>:null}</>:null}
  {!['rules','courses'].includes(tab)?<div className="academic-actions clarity-official-action"><a className="button secondary" href={official} target="_blank" rel="noopener noreferrer">Open official AMS<ExternalLink size={14}/></a></div>:null}
 </section></div></div>;
}
