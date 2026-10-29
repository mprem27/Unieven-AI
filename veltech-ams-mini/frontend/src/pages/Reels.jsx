import {useEffect,useRef,useState} from 'react';
import {useNavigate,useSearchParams} from 'react-router-dom';
import {Plus,RefreshCw} from 'lucide-react';
import {useCampus} from '../context/CampusContext';
import {request} from '../lib/api';
import {Button,EmptyState,Feedback,IconButton,PageHeader} from '../components/UI';
import {entityId,listItems} from '../components/SocialComposer';
import ReelViewer,{ReelCard} from '../components/ReelViewer';
import {orderForRefresh} from '../lib/community';
import '../community-v15.css';
export {ReelCard} from '../components/ReelViewer';

export default function Reels() {
 const [search]=useSearchParams(),focus=search.get('reel'),navigate=useNavigate(),{data,mode}=useCampus(),[items,setItems]=useState([]),[error,setError]=useState(''),[loading,setLoading]=useState(false),[revision,setRevision]=useState(0),[tab,setTab]=useState('all'),[viewer,setViewer]=useState(null),opened=useRef(false);
 useEffect(()=>{opened.current=false;setViewer(null);},[mode,data.profile.id,focus]);
 useEffect(()=>{setError('');if(mode==='demo'){setItems(data.reels || []);return;}const abort=new AbortController();setLoading(true);request('/reels',{signal:abort.signal}).then(x=>setItems(listItems(x))).catch(e=>{if(!abort.signal.aborted)setError(e.message);}).finally(()=>{if(!abort.signal.aborted)setLoading(false);});return()=>abort.abort();},[mode,data.profile.id,data.reels,revision]);
 useEffect(()=>{if(!items.length || opened.current)return;const target=focus?items.find(x=>entityId(x)===focus):items[0];if(target){setViewer(entityId(target));opened.current=true;}},[items,focus]);
 const visible=orderForRefresh(items.filter(x=>tab!=='saved' || x.saved),revision),update=next=>setItems(old=>old.map(x=>entityId(x)===entityId(next)?next:x)),remove=id=>setItems(old=>old.filter(x=>entityId(x)!==id));
 return <><PageHeader title="Campus reels" description="Projects in motion. Moments worth sharing."><Button onClick={()=>navigate('/reels/create')}><Plus size={17}/>Create reel</Button></PageHeader><div className="v15-reels-toolbar"><div className="tabs"><button className={tab==='all'?'active':''} onClick={()=>setTab('all')}>Discover</button><button className={tab==='saved'?'active':''} onClick={()=>setTab('saved')}>Saved reels</button></div><IconButton label="Refresh reels" disabled={loading} onClick={()=>setRevision(x=>x+1)}><RefreshCw size={17} className={loading?'spin':''}/></IconButton></div><Feedback error={error}/>{loading?<p className="muted" role="status">Loading campus reels…</p>:null}<div className="v15-reel-grid">{visible.map(reel=><ReelCard key={entityId(reel)} reel={reel} onOpen={item=>setViewer(entityId(item))}/>)}</div>{!loading && !visible.length?<EmptyState title={tab==='saved'?'Your saved reels live here':'Share a fresh perspective'} description={mode==='demo'?'Try a video from your device. Demo media stays in this browser session.':'Share a project demo, a campus moment, or a useful idea.'} action="Create a reel" onAction={()=>navigate('/reels/create')}/>:null}{focus && !loading && items.length>0 && !items.some(x=>entityId(x)===focus)?<Feedback error="This reel is unavailable or shared with a different audience."/>:null}{viewer && items.some(x=>entityId(x)===viewer)?<ReelViewer reels={visible.length && visible.some(x=>entityId(x)===viewer)?visible:items} initialId={viewer} onClose={()=>setViewer(null)} onUpdate={update} onDelete={remove}/>:null}</>;
}
