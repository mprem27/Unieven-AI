import {useEffect,useState} from 'react';
import {Link,useNavigate,useParams} from 'react-router-dom';
import {ArrowLeft} from 'lucide-react';
import {useCampus} from '../context/CampusContext';
import {request} from '../lib/api';
import {entityId,listItems} from '../components/SocialComposer';
import {EmptyState,Feedback,PageHeader} from '../components/UI';
import ReelViewer from '../components/ReelViewer';
import './community-pages.css';
export default function Conversation(){
 const {id}=useParams(),navigate=useNavigate(),{data,mode}=useCampus(),[items,setItems]=useState([]),[error,setError]=useState(''),[loading,setLoading]=useState(false);
 useEffect(()=>{setError('');if(mode==='demo'){setItems(data.reels || []);return;}const abort=new AbortController();setLoading(true);request('/reels',{signal:abort.signal}).then(x=>setItems(listItems(x))).catch(err=>{if(!abort.signal.aborted)setError(err.message);}).finally(()=>{if(!abort.signal.aborted)setLoading(false);});return()=>abort.abort();},[mode,data.profile.id,data.reels]);
 const reel=items.find(r=>entityId(r)===id);
 return <div className="v14-conversation-route"><Link className="v14-back-link" to="/reels"><ArrowLeft size={16}/>Back to reels</Link><PageHeader title="Campus reels" description="Keep the conversation with the moment."/><Feedback error={error}/>{reel?<ReelViewer reels={items} initialId={id} initialComments onClose={()=>navigate('/reels')} onUpdate={next=>setItems(old=>old.map(x=>entityId(x)===entityId(next)?next:x))} onDelete={rid=>setItems(old=>old.filter(x=>entityId(x)!==rid))}/>:loading?<p role="status">Loading reel…</p>:<EmptyState title="This reel is unavailable" description="It may have been removed or shared with a different audience."/>}</div>;
}
