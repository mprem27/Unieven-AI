import {lazy,Suspense,useEffect,useState} from 'react';
import {Film,Play,ArrowUpRight} from 'lucide-react';
import {useNavigate} from 'react-router-dom';
import {useCampus} from '../context/CampusContext';
import {useAppPreferences} from '../context/AppPreferences';
import {request} from '../lib/api';
import {SectionTitle,EmptyState} from './UI';
const ReelViewer=lazy(()=>import('./ReelViewer'));
const idOf=x=>String(x?.id || x?._id || '');
export default function HomeReels(){
 const {preferences}=useAppPreferences(),{data,mode}=useCampus(),navigate=useNavigate(),[reels,setReels]=useState([]),[active,setActive]=useState(null);
 useEffect(()=>{setReels([]);setActive(null);if(!preferences.showHomeReels)return;if(mode==='demo'){setReels(data.reels || []);return;}const abort=new AbortController();request('/reels',{signal:abort.signal}).then(value=>{if(!abort.signal.aborted)setReels(Array.isArray(value)?value:value.items || []);}).catch(()=>{});return()=>abort.abort();},[preferences.showHomeReels,mode,data.profile.id]);
 useEffect(()=>{if(mode==='demo')setReels(data.reels || []);},[mode,data.reels]);
 if(!preferences.showHomeReels)return null;
 return <section className="panel home-reels"><SectionTitle title="Campus reels" action="All reels" onAction={()=>navigate('/reels')}/>{reels.length?<div className="home-reel-strip">{reels.slice(0,5).map(reel=><button key={idOf(reel)} onClick={()=>setActive(idOf(reel))}><img src={reel.thumbnail || '/assets/code-jam.png'} alt={reel.caption || 'Campus reel'} loading="lazy"/><span className="home-reel-play"><Play size={19} fill="currentColor"/></span><span className="home-reel-copy"><Film size={13}/>{reel.caption || 'Watch campus reel'}</span></button>)}</div>:<EmptyState title="No reels yet" description="Campus reels will appear here."/>}{active?<Suspense fallback={null}><ReelViewer reels={reels} initialId={active} onClose={()=>setActive(null)} onUpdate={next=>setReels(list=>list.map(item=>idOf(item)===idOf(next)?next:item))} onDelete={id=>{setReels(list=>list.filter(item=>idOf(item)!==id));setActive(null);}}/></Suspense>:null}</section>;
}
