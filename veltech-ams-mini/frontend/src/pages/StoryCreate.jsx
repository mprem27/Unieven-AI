import {Link,useNavigate} from 'react-router-dom';
import {ArrowLeft} from 'lucide-react';
import {PageHeader} from '../components/UI';
import {StoryCreator} from '../components/Stories';
import './community-pages.css';
export default function StoryCreate(){const navigate=useNavigate();return <div className="v14-create-route"><Link className="v14-back-link" to="/community"><ArrowLeft size={16}/>Back to community</Link><PageHeader title="Make a moment of it." description="Photo, video or a thought. Your story, for the next 24 hours."/><StoryCreator onClose={()=>navigate('/community')}/></div>;}
