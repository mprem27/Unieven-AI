import {readFile,mkdir,writeFile,copyFile,rename} from 'node:fs/promises';
import path from 'node:path';
import {createHash,randomUUID} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {BUILD_TOOLS_VERSION} from './android-config.mjs';
import {verifiedCertificate,verifyApkIdentity} from './android-release-tools.mjs';
// Run after android-build.mjs has verified the signature. Copy only public release
// outputs; private signing material never belongs in the server media directory.
const args=process.argv.slice(2),get=k=>args.find(v=>v.startsWith('--'+k+'='))?.slice(k.length+3);
const apk=get('apk'),receipt=get('receipt'),out=get('out'),notes=get('notes') || '';
if(!apk || !receipt || !out || args.some(v=>!/^--(apk|receipt|out|notes)=/.test(v)))throw new Error('Usage: node scripts/publish-android-release.mjs --apk=android/out/veltech-ams-mini-release.apk --receipt=android/out/signing-receipt.json --out=/private/app-releases');
const data=await readFile(apk),proof=JSON.parse(await readFile(receipt,'utf8')),sha256=createHash('sha256').update(data).digest('hex');
if(proof.signatureVerified!==true || proof.alignmentVerified!==true || proof.apkSha256!==sha256 || !/^\d+\.\d+\.\d+$/.test(proof.versionName || '') || !Number.isInteger(proof.versionCode) || !proof.packageId || !/^[a-f0-9]{2}(?::[a-f0-9]{2}){31}$/i.test(proof.certificateSha256 || ''))throw new Error('Use the matching verified Android release receipt.');
if(data[0]!==0x50 || data[1]!==0x4b || data[2]!==3 || data[3]!==4)throw new Error('The supplied file is not an APK archive.');
if(!process.env.ANDROID_HOME)throw new Error('Set ANDROID_HOME to independently verify this APK with Android SDK Build-Tools before publishing.');
const tools=path.join(process.env.ANDROID_HOME,'build-tools',BUILD_TOOLS_VERSION);
function check(command,args){const result=spawnSync(command,args,{encoding:'utf8',shell:false});if(result.error || result.status!==0)throw new Error('APK verification failed: '+(result.error?.message || result.stderr || result.stdout));return result.stdout;}
const certificate=verifiedCertificate(check('java',['-jar',path.join(tools,'lib/apksigner.jar'),'verify','--verbose','--print-certs',apk]));
if(certificate!==proof.certificateSha256.replaceAll(':','').toUpperCase())throw new Error('APK signing certificate differs from the receipt.');
verifyApkIdentity(check(path.join(tools,process.platform==='win32'?'aapt.exe':'aapt'),['dump','badging',apk]),proof);
check(path.join(tools,process.platform==='win32'?'zipalign.exe':'zipalign'),['-c','-P','16','4',apk]);
const destination=path.resolve(out);await mkdir(destination,{recursive:true,mode:0o700});await copyFile(apk,path.join(destination,sha256+'.apk'));
const manifest={signatureVerified:true,alignmentVerified:true,domainAssociation:proof.domainAssociation || {verified:false,status:'pending'},versionName:proof.versionName,versionCode:proof.versionCode,packageId:proof.packageId,certificateSha256:proof.certificateSha256,sha256,publishedAt:new Date().toISOString(),notes};
const temp=path.join(destination,randomUUID()+'.json');await writeFile(temp,JSON.stringify(manifest,null,2)+'\n',{mode:0o600,flag:'wx'});await rename(temp,path.join(destination,'release.json'));
console.log('Published a checksum-verified APK and public release metadata. Keep the old APK until the rollout is verified.');
