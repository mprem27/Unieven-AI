import {useEffect,useState} from 'react';
import {Link,useParams} from 'react-router-dom';
import {ArrowLeft} from 'lucide-react';
import {useCampus} from '../context/CampusContext';
import {request} from '../lib/api';
import {EmptyState,PageHeader} from '../components/UI';
import {entityId} from '../components/SocialComposer';
import {PostCard} from './Feed';
import './community-pages.css';
export default function SocialPost(){
 const {id}=useParams(),{data,mode,loading}=useCampus(),[remote,setRemote]=useState(null),[fetching,setFetching]=useState(mode==='connected'),[error,setError]=useState('');
 useEffect(()=>{setRemote(null);setError('');if(mode!=='connected'){setFetching(false);return;}const abort=new AbortController();setFetching(true);request('/feed/'+encodeURIComponent(id),{signal:abort.signal}).then(value=>{if(!abort.signal.aborted)setRemote(value);}).catch(e=>{if(!abort.signal.aborted)setError(e.message);}).finally(()=>{if(!abort.signal.aborted)setFetching(false);});return()=>abort.abort();},[mode,data.profile.id,id]);
 const post=error?null:remote || data.posts.find(p=>entityId(p)===id);
 return <div className="v14-conversation-route"><Link className="v14-back-link" to="/community"><ArrowLeft size={16}/>Back to community</Link><PageHeader title="Community conversation"/>{post?<PostCard post={post} conversation onUpdate={setRemote}/>:loading || fetching?<p role="status">Loading conversation…</p>:<EmptyState title="This post is unavailable" description="It may have been removed or shared with a different audience."/>}</div>;
}
