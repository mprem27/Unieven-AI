import path from 'node:path';
import fs from 'node:fs/promises';
import {createReadStream} from 'node:fs';
import {createHash} from 'node:crypto';
import {fail} from '../security.js';
export function registerAppRelease(router,options={}){
 const directory=path.resolve(options.directory || process.env.CAMPUS_APK_DIRECTORY || '.campus-releases');let cached;
 async function release(){
  let raw;try{const info=await fs.lstat(path.join(directory,'release.json'));if(!info.isFile() || info.isSymbolicLink() || info.size>20000)throw new Error();raw=JSON.parse(await fs.readFile(path.join(directory,'release.json'),'utf8'));}catch{return null;}
  if(raw.signatureVerified!==true || raw.alignmentVerified!==true || !Number.isInteger(raw.versionCode) || raw.versionCode<1 || typeof raw.versionName!=='string' || !/^\d+\.\d+\.\d+$/.test(raw.versionName) || !/^[a-f0-9]{64}$/.test(raw.sha256 || '') || !/^[a-z][a-z0-9_]*(?:\.[a-z][a-z0-9_]*){2,}$/.test(raw.packageId || '') || !/^[a-f0-9]{2}(?::[a-f0-9]{2}){31}$/i.test(raw.certificateSha256 || '') || raw.packageId!==(process.env.CAMPUS_ANDROID_PACKAGE_ID || 'in.velstudents.veltechams'))return null;
  const filename=path.join(directory,raw.sha256+'.apk');let info;try{info=await fs.lstat(filename);}catch{return null;}if(!info.isFile() || info.isSymbolicLink() || info.size<1000 || info.size>250*1024*1024)return null;
  const fingerprint=[filename,info.size,info.mtimeMs,info.ctimeMs].join(':');
  if(cached?.fingerprint!==fingerprint){const hash=createHash('sha256');for await(const chunk of createReadStream(filename))hash.update(chunk);if(hash.digest('hex')!==raw.sha256)return null;cached={fingerprint};}
  return {filename,info,public:{available:true,versionCode:raw.versionCode,versionName:raw.versionName,packageId:raw.packageId,sha256:raw.sha256,certificateSha256:raw.certificateSha256,bytes:info.size,signatureVerified:true,domainAssociation:raw.domainAssociation?.verified===true?'verified':'pending',publishedAt:raw.publishedAt || null,notes:typeof raw.notes==='string'?raw.notes.slice(0,4000):'',url:`/api/campus/app-release/apk?sha=${raw.sha256}`}};
 }
 router.get('/app-release',async(_req,res)=>{const value=await release();res.set('Cache-Control','no-store').json(value?.public || {available:false});});
 router.get('/app-release/apk',async(req,res)=>{const value=await release();if(!value)fail(404,'An Android release is not available yet.');if(req.query.sha!==value.public.sha256)fail(409,'The release changed. Check for updates again.');res.set({'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','X-APK-SHA256':value.public.sha256});res.type('application/vnd.android.package-archive');res.download(value.filename,`veltech-ams-mini-${value.public.versionName}.apk`,{dotfiles:'allow'});});
 // Public human-readable install link. Always reads the local verified release;
 // no remote URLs, GitHub redirects or caller-provided filenames are accepted.
 router.get('/app-release/latest.apk',async(_req,res)=>{const value=await release();if(!value)fail(404,'An Android release is not available yet.');res.set({'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','X-APK-SHA256':value.public.sha256});res.type('application/vnd.android.package-archive');res.download(value.filename,`veltech-ams-mini-${value.public.versionName}.apk`,{dotfiles:'allow'});});
}
