import {Link} from 'react-router-dom';
import {ArrowLeft} from 'lucide-react';
import {EventDialog} from '../components/EventDialog';
import {EmptyState,Feedback,PageHeader} from '../components/UI';
import {entityId} from '../components/SocialComposer';
import {useResolvedEvent} from './EventDetails';
import './community-pages.css';
import './events-v18.css';
export default function EventRegistration(){const {event,error,loading}=useResolvedEvent();return <div className="v14-registration-route"><Link className="v14-back-link" to={event?`/events/${encodeURIComponent(entityId(event))}`:'/events'}><ArrowLeft size={16}/>Back to event</Link><PageHeader title="Your place. Your next experience." description="Review your details and keep your ticket in one place."/><Feedback error={error}/>{event?<EventDialog key={entityId(event)} event={event}/>:loading?<p role="status">Loading registration…</p>:<EmptyState title="Event unavailable" description="Return to Events and select an available event."/>}</div>;}
