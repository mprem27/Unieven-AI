import {useMemo,useState} from 'react';
import {Link,useParams} from 'react-router-dom';
import {ArrowLeft,BookOpen,ShieldCheck} from 'lucide-react';
import {useCampus} from '../context/CampusContext';
import {PageHeader,EmptyState} from '../components/UI';
import {AttendanceCalculator,AttendanceExports,AttendanceHistory,AttendancePlanResult,TargetSlider} from '../components/AttendanceTools';
import {findAttendanceSubject,subjectAttendance,subjectRecords} from '../lib/attendance-tools';
import '../attendance.css';

export default function AttendanceSubject() {
 const {subjectCode}=useParams(),{data,mode,today}=useCampus(),[target,setTarget]=useState(75);
 const subject=findAttendanceSubject(data.subjects || [],subjectCode),records=useMemo(()=>subject?subjectRecords(data.records || [],subject):[],[data.records,subject]);
 if(!subject)return <div className="att-page"><Link to="/attendance" className="att-back-link"><ArrowLeft size={16}/>All attendance</Link><PageHeader title="Subject attendance"/><EmptyState title="Subject not available" description="This subject is not in the current account’s attendance data. Return to attendance to choose an available subject."/></div>;
 return <SubjectAttendancePage key={`${mode}:${subject.id || subject.code}`} subject={subject} records={records} mode={mode} today={today} target={target} setTarget={setTarget}/>;
}
function SubjectAttendancePage({subject,records,mode,today,target,setTarget}) {
 const summary=subjectAttendance(subject),subjects=useMemo(()=>[subject],[subject]);
 return <div className="att-page att-subject-page"><Link to="/attendance" className="att-back-link"><ArrowLeft size={16}/>All attendance</Link><PageHeader title={subject.name || 'Subject attendance'} description={`${subject.code || 'Course'} · Attendance and class history`}><AttendanceExports subjects={subjects} records={records} mode={mode} target={target} today={today} scope={`${subject.name || subject.code} | All supplied dates`}/></PageHeader><div className={`att-source-note ${mode==='demo'?'demo':''}`}><ShieldCheck size={16}/><span>{mode==='demo'?'Fictional demo · These sample records are for exploration.':'Connected academic data · Daily marks and summary totals may cover different date ranges.'}</span></div><section className="panel att-subject-hero"><div className="att-subject-hero-score"><span className="att-course-icon"><BookOpen size={23}/></span><span>Current attendance</span><strong>{summary.percent===null?<span className="att-missing-value">Data not available</span>:`${summary.percent}%`}</strong><p>{summary.present ?? '—'} attended out of {summary.total ?? '—'} total classes</p><small>{summary.other ?? '—'} other / unmarked — not a confirmed absence count</small></div><div className="att-subject-planner"><h2>Plan your next classes</h2><TargetSlider target={target} onChange={setTarget}/><AttendancePlanResult source present={subject.present} total={subject.total} target={target}/><p className="att-help-note">One future class adds one to total; attending adds one to attended too. The estimate uses the full source summary and assumes its current counts do not change.</p></div></section><AttendanceHistory key={subject.id || subject.code} records={records} subjects={subjects} mode={mode} today={today} target={target} subjectName={subject.name || subject.code}/><AttendanceCalculator initialTarget={target}/><p className="att-help-note att-page-note">Daily records show only supplied marks and keep repeated periods separate. No record means no information. On duty remains separate; credit comes only from the source summary. Percentages are rounded for display; planning uses original counts.</p></div>;
}
