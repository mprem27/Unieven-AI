import {ArrowUpRight,CalendarDays,ChartNoAxesColumn,ClipboardList,CalendarRange} from 'lucide-react';
import {useCampus} from '../context/CampusContext';
import useAcademicSummary from '../hooks/useAcademicSummary';
import {visibleAcademicRows} from '../lib/academic-source';
import {attendancePlan,subjectAttendance} from '../lib/attendance-tools';

export function useStudentSummary(){
 const {data,mode}=useCampus(),academic=data.academic || {};
 return useAcademicSummary({results:visibleAcademicRows(academic,'results',mode),credits:visibleAcademicRows(academic,'credits',mode),gradeScale:visibleAcademicRows(academic,'gradeScale',mode),creditSummary:[...visibleAcademicRows(academic,'creditSummary',mode),...visibleAcademicRows(academic,'resultSummary',mode)],mode,accountKey:data.profile.id,studentProfile:data.profile});
}
export default function AcademicQuickAccess({navigate,summary,expanded=false}){
 const {data,mode}=useCampus(),subjects=(data.subjects || []).map(subjectAttendance),valid=subjects.length>0 && subjects.every(row=>row.valid),present=subjects.reduce((sum,row)=>sum+(row.present || 0),0),total=subjects.reduce((sum,row)=>sum+(row.total || 0),0),attendance=valid?attendancePlan(present,total,75):null;
 const cgpa=summary?.overall?.cgpa,calculated=summary?.overall?.cgpaSource!=='published';
 const percentage=summary?.percentage;
 const percentageLabel=percentage?.source==='published'?(mode==='demo'?'sample':'published'):percentage?.source==='project-rule' || summary?.estimatedPoints && summary?.overall?.cgpaSource!=='published'?'estimate':'calculated';
 const rows=[
  ['attendance','Attendance',attendance?.percent!==null && attendance?.percent!==undefined?`${attendance.percent}%`:'View attendance','Subject totals & calendar',CalendarDays],
  ['results','Results',Number.isFinite(cgpa)?`${cgpa.toFixed(2)} CGPA`:'View results',expanded && Number.isFinite(percentage?.value)?`${percentage.value.toFixed(2)}% · ${percentageLabel}`:calculated && Number.isFinite(cgpa)?'Calculated · all semesters':'Semester grades & CGPA',ChartNoAxesColumn],
  ['marks','Marks','Tests & internal','Unit tests, lab and internal',ClipboardList],
  ['timetable','Timetable',(data.classes || []).length?`${data.classes.length} classes today`:'View timetable','Today & full week',CalendarRange],
 ];
 return <div className={`clarity-quick-access ${expanded?'expanded':''}`}>{(expanded?rows.filter(([id])=>['results','marks'].includes(id)):rows).map(([id,title,value,detail,Icon])=><button key={id} type="button" onClick={()=>['results','marks'].includes(id)?navigate('academics',id):navigate(id)}><span className={`clarity-quick-icon icon-${id}`}><Icon size={21}/></span><span className="clarity-quick-copy"><strong>{title}</strong><b>{value}</b><small>{detail}</small></span><ArrowUpRight size={16}/></button>)}</div>;
}
