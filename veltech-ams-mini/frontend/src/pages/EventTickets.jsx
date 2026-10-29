import {Link} from 'react-router-dom';
import {ArrowLeft,ArrowUpRight,Ticket} from 'lucide-react';
import {useCampus} from '../context/CampusContext';
import {Badge,EmptyState,PageHeader} from '../components/UI';
import {entityId} from '../components/SocialComposer';
import {displayDate} from '../lib/attendance';
import './community-pages.css';
export default function EventTickets(){const {data,mode}=useCampus();return <><Link to="/events" className="v14-back-link"><ArrowLeft size={16}/>Explore events</Link><PageHeader title="Good plans, all in one place." description={mode==='demo'?'Sample registrations and fictional tickets.':'Your registrations, payment status and private QR tickets.'}/><div className="v14-ticket-grid">{data.registrations.map(ticket=>{const event=data.events.find(e=>entityId(e)===entityId(ticket.event)) || ticket.event;return <article className="panel v14-ticket-card" key={entityId(ticket)}><img src={event?.image || '/assets/code-jam.png'} alt=""/><div><Badge status={ticket.status}/><h2>{event?.title || 'Event registration'}</h2><p>{displayDate(event?.date)} · {event?.location || 'Campus event'}</p><small>Registration {entityId(ticket).slice(-8).toUpperCase()}</small><Link className="button secondary" to={`/events/${encodeURIComponent(entityId(event))}/register`}><Ticket size={15}/>View registration<ArrowUpRight size={15}/></Link></div></article>;})}</div>{!data.registrations.length?<EmptyState title="Something to look forward to" description="Register for an event and your ticket will appear here."/>:null}</>;}
