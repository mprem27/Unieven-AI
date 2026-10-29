import {useEffect,useRef,useState} from 'react';
import {Copy,Download,RefreshCw,Share2,Smartphone} from 'lucide-react';
import {request} from '../lib/api';
import {ANDROID_APK_URL,ANDROID_INSTALL_URL,androidReleaseState,validateAndroidRelease} from '../lib/app-release';
import {Button,Badge,Feedback} from './UI';
import {androidLaunch} from '../lib/update-policy';
export default function AndroidUpdates(){
 const [release,setRelease]=useState(null),[error,setError]=useState(''),[busy,setBusy]=useState(false),[requested,setRequested]=useState(false),[sharing,setSharing]=useState(false),[shareFeedback,setShareFeedback]=useState('');
 const active=useRef(true),installation=androidLaunch;
 async function check(){setBusy(true);setError('');setRequested(false);try{const value=validateAndroidRelease(await request('/app-release'));if(active.current)setRelease(value);}catch(e){if(active.current){setRelease(null);setError(e.message);}}finally{if(active.current)setBusy(false);}}
 useEffect(()=>{active.current=true;void check();return()=>{active.current=false;};},[]);
 async function copyApkLink(){
  try{if(!navigator.clipboard?.writeText)throw new Error();await navigator.clipboard.writeText(ANDROID_APK_URL);if(active.current)setShareFeedback('APK link copied. It downloads the latest signed release from app.veltech-mini-ams.me.');}
  catch{if(active.current)setShareFeedback('Copy the APK link below using your browser’s link menu.');}
 }
 async function share(){
  setShareFeedback('');
  if(!navigator.share){
   try{if(!navigator.clipboard?.writeText)throw new Error();await navigator.clipboard.writeText(ANDROID_INSTALL_URL);if(active.current)setShareFeedback('Download page link copied. Share it for the APK and installation guide.');}
   catch{if(active.current)setShareFeedback('Share this download page: '+ANDROID_INSTALL_URL);}
   return;
  }
  setSharing(true);
  try{await navigator.share({title:'Veltech AMS mini · Android APK',text:'Download the Android APK and follow the installation guide. Android will ask you to confirm installation.',url:ANDROID_INSTALL_URL});}
  catch(e){if(e.name!=='AbortError' && active.current)setShareFeedback('Sharing could not open. Use Copy APK link or share '+ANDROID_INSTALL_URL);}
  finally{if(active.current)setSharing(false);}
 }
 return <div className="android-updates">
  <div className="connection-heading"><span className="connection-icon"><Smartphone size={23}/></span><div><h3>Android APK</h3><p role="status">{busy && !release?'Checking Android release…':androidReleaseState(release,installation)}</p></div><Badge status={installation.installed?'present':'neutral'}>{installation.installed?'Android app':'APK'}</Badge></div>
  {release?.available?<>
   <p>Version {release.versionName} · {(release.bytes/1048576).toFixed(1)} MB</p>{release.notes?<p>{release.notes}</p>:null}
   <div className="app-install-actions"><a className="button primary" href={release.url} download={`veltech-ams-mini-${release.versionName}.apk`} onClick={()=>setRequested(true)}><Download size={16}/>{installation.installed?'Download Android update':'Download Android APK'}</a><Button variant="secondary" busy={busy} onClick={check}><RefreshCw size={15}/>Check for updates</Button></div>
   {requested?<p role="status" className="apk-download-complete">Download requested. Check your browser’s Downloads, then open the APK. Android will ask you to confirm installation. If the download did not start, check for updates and try again.</p>:null}
   <p className="page-footnote">Downloaded directly from this website. The server checks the published APK’s SHA-256 before serving it; a changed release requires checking again.</p>
   <div className="apk-share"><strong>Share the Android download</strong><p>The public download page includes this guide and works before sign-in.</p><div className="app-install-actions"><Button variant="secondary" busy={sharing} onClick={share}><Share2 size={16}/>Share download page</Button><Button variant="secondary" onClick={copyApkLink}><Copy size={16}/>Copy APK link</Button></div><a className="apk-domain-link" href={ANDROID_APK_URL}>{ANDROID_APK_URL}</a>{shareFeedback?<p role="status" className="page-footnote">{shareFeedback}</p>:null}</div>
   <details className="apk-verification"><summary>Verify this download</summary><p>Package: {release.packageId}</p><p>SHA-256: <code>{release.sha256}</code></p>{release.certificateSha256?<p>Signing certificate SHA-256: <code>{release.certificateSha256}</code></p>:null}</details>
  </>:<><p className="page-footnote">{error?'Release details are unavailable. Retry when connected.':'A signed APK has not been published to this server yet. Check again after the release is deployed.'}</p><Button variant="secondary" busy={busy} onClick={check}><RefreshCw size={15}/>Check Android release</Button></>}
  <Feedback error={error}/>
  <div className="apk-install-guide"><h4>Install the APK on Android</h4><ol><li><strong>Download the APK.</strong> Use the button above on your Android phone. Downloads come from <strong>app.veltech-mini-ams.me</strong>.</li><li><strong>Open Downloads.</strong> Open <code>veltech-ams-mini-*.apk</code>. If Android asks, review and allow this browser to install this file.</li><li><strong>Confirm Install or Update.</strong> Open Veltech AMS mini from Android’s app drawer. Use Check for updates here for future releases.</li></ol><p className="page-footnote">Android and your browser control installation and security warnings. Review any warning; if Android blocks the file or the identity differs, stop and check the release. This website cannot install silently or remove device warnings.</p><p className="page-footnote">Chrome’s “Install app” or “Add to Home screen” creates a separate browser web app and can show “From Chrome.” Use Download Android APK for the Android package. A browser window alone cannot tell whether that package is installed elsewhere on your phone.</p></div>
 </div>;
}
