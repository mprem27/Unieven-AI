import {useLocation} from 'react-router-dom';

// Sharing an APK must not start private account hydration or require sign-in.
export default function AppEntry({children,installPage}){
 const {pathname}=useLocation();
 if(pathname==='/install')return installPage;
 return children;
}
