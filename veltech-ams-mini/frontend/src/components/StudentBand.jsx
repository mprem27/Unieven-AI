import {Avatar} from './UI';
import {homeFacts} from '../lib/schedule';
import {ChevronRight} from 'lucide-react';
export default function StudentBand({profile,onProfile}){
 return <section className="panel premium-student-band clarity-student-band"><button className="student-photo-button" onClick={onProfile} aria-label="Open student details"><Avatar name={profile.name} src={profile.photo || profile.image} size="large"/><span><strong>{profile.name || 'Student details'}</strong><small>{[profile.vtuNumber || profile.studentId,profile.section?`Section ${profile.section}`:'',profile.batch].filter(Boolean).join(' · ') || 'View your university record'}</small></span><ChevronRight size={18}/></button><details><summary>Basic student information<ChevronRight size={16}/></summary><dl className="student-ten-facts">{homeFacts(profile).map(([label,value])=><div key={label}><dt>{label}</dt><dd>{value || 'Not provided'}</dd></div>)}</dl></details></section>;
}
