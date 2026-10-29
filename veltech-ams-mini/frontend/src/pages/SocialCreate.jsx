import {Link,useLocation,useNavigate,useSearchParams} from 'react-router-dom';
import {ArrowLeft} from 'lucide-react';
import {useCampus} from '../context/CampusContext';
import {PageHeader} from '../components/UI';
import SocialComposer,{entityId} from '../components/SocialComposer';
import './community-pages.css';
export default function SocialCreate(){const {data}=useCampus(),navigate=useNavigate(),location=useLocation(),[search]=useSearchParams(),type=location.pathname.startsWith('/reels') || search.get('type')==='reel'?'reel':'post',event=data.events.find(e=>entityId(e)===search.get('event')),back=event?`/events/${encodeURIComponent(entityId(event))}`:type==='reel'?'/reels':'/community';return <div className="v14-create-route"><Link className="v14-back-link" to={back}><ArrowLeft size={16}/>Back to {event?'event':type==='reel'?'reels':'community'}</Link><PageHeader title={event?`A moment from ${event.title}`:type==='reel'?'Let the moment move.':'Something worth sharing.'} description="A project, a perspective, a small win. Make it yours."/><SocialComposer key={`${type}:${entityId(event)}`} initialType={type} event={event} onClose={()=>navigate(back)}/></div>;}
