import {useEffect,useRef} from 'react';
import {X} from 'lucide-react';
import {IconButton} from './UI';
export default function PagePanel({title,children,onClose}){
 const ref=useRef(null);
 useEffect(()=>{ref.current?.scrollIntoView({block:'start',behavior:'instant'});ref.current?.focus({preventScroll:true});},[]);
 return <section ref={ref} tabIndex={-1} className="panel page-work-panel" aria-label={title}><div className="section-title"><h2>{title}</h2><IconButton label="Close workspace section" onClick={onClose}><X size={20}/></IconButton></div>{children}</section>;
}
