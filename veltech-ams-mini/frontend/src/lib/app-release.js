export const ANDROID_PACKAGE_ID='in.velstudents.veltechams';
export const ANDROID_INSTALL_URL='https://app.veltech-mini-ams.me/#/install';
export const ANDROID_APK_URL='https://app.veltech-mini-ams.me/api/campus/app-release/latest.apk';
export function androidInstallation({referrer='',search='',packageId=ANDROID_PACKAGE_ID}={}){
 let origin;try{origin=new URL(referrer);}catch{}
 const params=new URLSearchParams(search),claimed=params.get('androidPackage'),code=Number(params.get('androidVersionCode'));
 const trusted=origin?.protocol==='android-app:' && origin.hostname===(packageId || ANDROID_PACKAGE_ID);
 return {installed:!!trusted,versionCode:trusted && claimed===origin.hostname && Number.isInteger(code) && code>0?code:null};
}
export function androidReleaseState(release,installation={}){
 if(!release?.available)return installation.installed?'Installed · release unavailable':'Android release not available';
 if(!installation.installed)return 'Android download available';
 if(!installation.versionCode)return 'Installed · version unknown';
 return release.versionCode>installation.versionCode?'Update available':'Installed · up to date';
}
export function validateAndroidRelease(value){
 if(value?.available===false)return {available:false};
 if(value?.available!==true || value.packageId!==ANDROID_PACKAGE_ID || !Number.isInteger(value.versionCode) || value.versionCode<1
  || !/^\d+\.\d+\.\d+$/.test(value.versionName || '') || !Number.isSafeInteger(value.bytes) || value.bytes<1000 || value.bytes>250*1024*1024
  || !/^[a-f0-9]{64}$/.test(value.sha256 || '') || value.url!==`/api/campus/app-release/apk?sha=${value.sha256}`)throw new Error('The Android release details could not be verified. Check for updates again.');
 return value;
}
export async function verifyApkDownload(data,release,crypto=globalThis.crypto){
 const bytes=new Uint8Array(data);
 if(bytes.byteLength!==release.bytes)throw new Error('The APK download is incomplete. Please try again.');
 if(bytes[0]!==0x50 || bytes[1]!==0x4b || bytes[2]!==3 || bytes[3]!==4)throw new Error('The server did not return an APK. Please check for updates again.');
 const digest=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),v=>v.toString(16).padStart(2,'0')).join('');
 if(digest!==release.sha256)throw new Error('The APK checksum did not match. Please check for updates again.');
 return bytes;
}
