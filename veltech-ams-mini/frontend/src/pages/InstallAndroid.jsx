import AndroidUpdates from '../components/AndroidUpdates';
import '../components/install-app.css';
export default function InstallAndroid(){
 return <main className="android-install-page install-app-settings"><header className="android-install-brand"><a href="#/login"><img src="/assets/original-logo.png" alt=""/><span>Veltech AMS mini<small>Developed by VEL STUDENTS</small></span></a><a className="button secondary" href="#/login">Open website</a></header><section className="android-install-intro"><span className="eyebrow">YOUR COLLEGE DAY</span><h1>Get the Android app.</h1><p>Download the signed APK from <strong>app.veltech-mini-ams.me</strong>. No sign-in is needed to download. Android will ask you to confirm installation.</p></section><AndroidUpdates/><footer className="android-install-footer">Works on Android 7 or newer with a compatible browser. iPhone and desktop users can <a href="#/login">open the website</a>.</footer></main>;
}
