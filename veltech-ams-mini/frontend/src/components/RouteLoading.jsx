import {LoaderCircle} from 'lucide-react';
export default function RouteLoading(){return <div className="route-loading" role="status" aria-label="Loading campus page"><div className="route-loading-label"><LoaderCircle size={19}/>Opening your campus workspace…</div><div className="skeleton-line short"/><div className="skeleton-line"/><div className="skeleton-panel"/></div>;}
