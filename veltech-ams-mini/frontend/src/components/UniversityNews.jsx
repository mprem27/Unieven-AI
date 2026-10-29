import {useEffect,useState} from 'react';
import {Link} from 'react-router-dom';
import {ExternalLink,Newspaper,ArrowUpRight} from 'lucide-react';
import {useCampus} from '../context/CampusContext';
import {request} from '../lib/api';
import {SectionTitle} from './UI';
export default function UniversityNews(){
 const {data,mode}=useCampus(),[news,setNews]=useState(null),[error,setError]=useState(''),[notices,setNotices]=useState(data.notices);
 useEffect(()=>{const controller=new AbortController();request('/university/news',{signal:controller.signal}).then(value=>{if(!controller.signal.aborted)setNews(value);}).catch(e=>{if(!controller.signal.aborted)setError('University website updates are unavailable.');});return()=>controller.abort();},[]);
 useEffect(()=>{setNotices(data.notices);if(mode!=='connected')return;const abort=new AbortController();request('/notices',{signal:abort.signal}).then(value=>{if(!abort.signal.aborted)setNotices(value);}).catch(()=>{});return()=>abort.abort();},[mode,data.profile.id,data.notices]);
 const updates=notices.slice(0,4),admin=data.profile.campusRole==='admin';
 return <section className="panel university-news college-updates-v16"><SectionTitle title="Vel Tech updates"/>{admin?<Link className="text-button" to="/management">Manage college updates<ArrowUpRight size={15}/></Link>:null}<div className="college-updates-grid"><div><h3><Newspaper size={17}/>College noticeboard</h3>{updates.length?<div className="college-update-list">{updates.map(item=><article key={item.id || item._id}><span>{item.category || 'Campus'}</span><h4>{item.title}</h4><p>{item.body}</p>{item.url?<a href={item.url} target="_blank" rel="noopener noreferrer">Read update<ExternalLink size={14}/></a>:null}<small>{mode==='demo'?'Sample update':new Date(item.createdAt).toLocaleDateString('en-IN')}</small></article>)}</div>:<p className="muted">College updates will appear here when published.</p>}</div><div><h3>University website</h3>{news?.items?.length?<div className="university-news-list">{news.items.slice(0,4).map(item=><a key={item.url} href={item.url} target="_blank" rel="noopener noreferrer"><div><strong>{item.title}</strong><small>{item.source || 'Vel Tech website'}</small></div><ExternalLink size={17}/></a>)}</div>:<p className="muted">{error || (news?'No website updates available.':'Loading updates…')}</p>}</div></div></section>;
}
