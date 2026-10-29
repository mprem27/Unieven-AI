import {Badge,SectionTitle,EmptyState} from './UI';
export default function ClassTimeline({classes,onNavigate}) {
 return <section className="panel timeline-panel"><SectionTitle title="Today’s classes"/>{!classes.length?<EmptyState title="No classes to show" description="Your connected timetable will appear here. A free day also has no scheduled classes." action="View timetable" onAction={()=>onNavigate('timetable')}/>:<ol className="class-timeline">{classes.map(c=><li key={c.id || c.startTime+c.subjectName} className={c.status}><time>{c.startTime || "—"}</time><span className="timeline-dot"/><div className="class-copy"><h3>{c.subjectName || c.name}</h3><p>{c.room || 'Room not provided'}</p></div><Badge status={c.status}/></li>)}</ol>}</section>;
}
