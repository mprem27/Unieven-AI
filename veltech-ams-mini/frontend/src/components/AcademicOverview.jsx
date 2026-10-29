import {BookOpen,GraduationCap,CalendarDays,CalendarRange,Wallet,FolderOpen,Info,ChevronRight} from 'lucide-react';
import {useCampus} from '../context/CampusContext';
import {visibleAcademicRows} from '../lib/academic-source';
import AcademicQuickAccess,{useStudentSummary} from './AcademicQuickAccess';
export default function AcademicOverview({navigate}){
 const {data,mode}=useCampus(),summary=useStudentSummary(),academic=data.academic || {},courses=visibleAcademicRows(academic,'courses',mode);
 const rows=[['attendance','Attendance','Subject totals, calendar and calculator',CalendarDays],['timetable','Timetable',(data.classes || []).length?`${data.classes.length} classes today`:'Today and your full week',CalendarRange],['courses','Registered courses',courses.length?`${courses.length} course records`:'Your curriculum and registration status',BookOpen],['credits','Credit earned','Credit ledger and exports',GraduationCap],['examinations','Examinations','Your exam schedule and seating',CalendarDays],['fees','Fees & receipts','College fee records and receipts',Wallet],['documents','Documents','University and staff documents',FolderOpen],['rules','Academic rules','Programme, regulation and calculations',Info]];
 return <div className="clarity-academic-overview"><AcademicQuickAccess navigate={navigate} summary={summary} expanded/><section className="panel clarity-link-list">{rows.map(([id,label,detail,Icon])=><button type="button" key={id} onClick={()=>['attendance','timetable'].includes(id)?navigate(id):navigate('academics',id)}><span className="clarity-link-icon"><Icon size={21}/></span><span><strong>{label}</strong><small>{detail}</small></span><ChevronRight size={18}/></button>)}</section></div>;
}
