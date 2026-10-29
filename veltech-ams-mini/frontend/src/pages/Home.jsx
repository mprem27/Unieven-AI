import LiveReminderHub from '../components/LiveReminderHub';
import {ChevronRight,RefreshCw} from 'lucide-react';
import {useCampus} from '../context/CampusContext';
import {displayDate} from '../lib/attendance';
import {PageHeader,SectionTitle,EventCard,EmptyState} from '../components/UI';
import StudentBand from '../components/StudentBand';
import AttendanceOverview from '../components/AttendanceOverview';
import ClassTimeline from '../components/ClassTimeline';
import SourceSyncStatus from '../components/SourceSyncStatus';
import HomeReels from '../components/HomeReels';
import AcademicQuickAccess,{useStudentSummary} from '../components/AcademicQuickAccess';
export default function Home({navigate,openEvent,openNotice}){
 const {data,today,mode,loading,notify}=useCampus(),summary=useStudentSummary();
 const profile=mode==='connected'?(data.profile.officialProfile || {}):data.profile;
 const sync=()=>{if(mode==='demo'){notify('Preview records are fictional.');return;}navigate('settings','connections');};
 return <div className="clarity-home"><PageHeader className="home-heading" title={`Hi, ${data.profile.name?.split(' ')[0] || 'there'}`} description={[profile.department || profile.branch,profile.semester?`Semester ${profile.semester}`:''].filter(Boolean).join(' · ')}><button className="clarity-sync-button" type="button" onClick={sync} aria-label="View university sync"><RefreshCw size={17} className={loading?'spin':''}/><span>Sync</span></button></PageHeader>
  <LiveReminderHub navigate={navigate} openNotice={openNotice}/>
  <section className="clarity-home-shortcuts"><div className="section-title"><h2>Quick access</h2><button type="button" className="text-button" onClick={()=>navigate('academics')}>Academics<ChevronRight size={14}/></button></div><AcademicQuickAccess navigate={navigate} summary={summary}/></section>
  <StudentBand profile={profile} onProfile={()=>navigate('profile')}/>
  <details className="panel clarity-home-disclosure"><summary>Attendance by subject<ChevronRight size={17}/></summary><AttendanceOverview subjects={data.subjects} onNavigate={navigate} embedded/></details>
  <details className="clarity-home-disclosure clarity-day-disclosure"><summary>Today’s classes<ChevronRight size={17}/></summary><ClassTimeline classes={data.classes} onNavigate={navigate}/></details>
  {data.notices.length?<section className="clarity-college-updates"><SectionTitle title="College updates" action="View inbox" onAction={()=>navigate('notifications')}/><div className="panel clarity-link-list">{data.notices.slice(0,2).map(notice=><button type="button" key={notice.id || notice._id} onClick={()=>openNotice(notice)}><span><strong>{notice.title}</strong><small>{notice.category || 'College update'}</small></span><ChevronRight size={17}/></button>)}</div></section>:null}
  <HomeReels/>
  <section className="clarity-home-events"><SectionTitle title="Campus events" action="View all" onAction={()=>navigate('events')}/>{data.events.length?<div className="home-event-grid">{data.events.slice(0,2).map(event=><EventCard compact key={event.id || event._id} event={event} onOpen={openEvent}/>)}</div>:<EmptyState title="No published events" description="College events will appear here when organizers publish them."/>}</section>
  <div className="clarity-home-sync"><SourceSyncStatus/><button className="text-button" onClick={()=>navigate('settings','connections')}>View sync details<ChevronRight size={14}/></button><span className="clarity-home-date">{displayDate(today,{weekday:'long',year:undefined,month:'long'})}</span></div>
 </div>;
}
