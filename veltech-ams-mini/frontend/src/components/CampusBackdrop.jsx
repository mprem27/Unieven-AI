import {GraduationCap,BookOpen,Code2,Atom,CalendarDays,Lightbulb,Database,IdCard} from 'lucide-react';
import {useAppPreferences} from '../context/AppPreferences';
const icons=[GraduationCap,BookOpen,Code2,Atom,CalendarDays,Lightbulb,Database,IdCard];
export default function CampusBackdrop(){
 const {preferences}=useAppPreferences();if(!preferences.backgroundAnimation)return null;
 return <div className="campus-backdrop" aria-hidden="true">{icons.map((Icon,index)=><span key={index} style={{left:`${7+(index*19)%88}%`,top:`${10+(index*31)%79}%`,animationDelay:`-${index*2}s`,animationDuration:`${24+index*3}s`}}><Icon size={34+index%3*12} strokeWidth={1.1}/></span>)}</div>;
}
