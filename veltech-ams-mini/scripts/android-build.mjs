import {readFile,writeFile,access,rm,mkdir,copyFile} from 'node:fs/promises';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {createHash,X509Certificate} from 'node:crypto';
import {readConfig,androidRoot,projectDirectory,repositoryRoot,argumentsFor,assertPublicDomain,configDigest,BUILD_TOOLS_VERSION,GRADLE_VERSION} from './android-config.mjs';
import {deploymentResources} from './android-prepare.mjs';
import {verifiedCertificate,verifyApkIdentity,domainAssociation} from './android-release-tools.mjs';
async function run(command,args,{capture=false,cwd=projectDirectory}={}){
 return new Promise((resolve,reject)=>{let output='';const child=spawn(command,args,{cwd,stdio:capture?['ignore','pipe','inherit']:'inherit',shell:false});if(capture)child.stdout.on('data',v=>{output+=v;});child.once('error',reject);child.once('exit',code=>code===0?resolve(output):reject(new Error(`${path.basename(command)} failed (exit ${code}). No release is confirmed.`)));});
}
try{
 const options=argumentsFor(process.argv.slice(2),{'--config':'value','--dry-run':'flag','--require-domain-association':'flag','--help':'flag'});
 if(options['--help']){console.log('Usage: node scripts/android-build.mjs [--config path] [--dry-run] [--require-domain-association]\nLinux/macOS or Windows signed release. SDK/JDK and a private release key required. Domain association is recorded separately; use --require-domain-association to gate delivery on its live deployment.');}
 else{
  const config=await readConfig(options['--config']),output=path.join(androidRoot,'out/veltech-ams-mini-release.apk');
  if(options['--dry-run'])console.log(JSON.stringify({status:'build-plan-only',deploymentUrl:config.deploymentUrl,project:projectDirectory,output,tools:{node:'>=22.12.0',java:'17 or 21',gradle:GRADLE_VERSION,androidPlatform:36,buildTools:BUILD_TOOLS_VERSION},gates:['Public HTTPS deployment and PWA assets','Generated project matches config','Private release keystore','Android SDK and successful Gradle release build','APK identity, signature and alignment verification'],domainAssociation:'Recorded separately; optional strict live gate',note:'No network, signing, SDK installation, or APK creation performed.'},null,2));
  else{
   await assertPublicDomain(config);await deploymentResources(config);
   const generated=JSON.parse(await readFile(path.join(projectDirectory,'velstudents-build.json'),'utf8'));
   if(generated.configDigest!==configDigest(config))throw new Error('Android config changed. Run android-prepare.mjs before building.');
   const signingKey=path.join(process.env.CAMPUS_ANDROID_KEY_DIRECTORY || path.join(androidRoot,'private'),config.signingKeyFile);await access(signingKey);
   const receiptFile=path.join(androidRoot,'out/signing-receipt.json');await mkdir(path.dirname(output),{recursive:true});await rm(output,{force:true});await rm(receiptFile,{force:true});
   let certificate;
   if(process.platform==='win32'){
    const powershell=path.join(process.env.SystemRoot || 'C:\\Windows','System32/WindowsPowerShell/v1.0/powershell.exe');
    await run(powershell,['-NoProfile','-File',path.join(repositoryRoot,'scripts/android-build.ps1'),'-ProjectDirectory',projectDirectory,'-SigningKeyPath',signingKey,'-KeyAlias',config.signingKeyAlias,'-AllowedFingerprintCsv','PENDING','-OutputFile',output,'-ReceiptFile',receiptFile,'-PackageId',config.packageId,'-VersionName',config.versionName,'-VersionCode',String(config.versionCode)]);
    certificate=JSON.parse((await readFile(receiptFile,'utf8')).replace(/^\uFEFF/,'')).certificateSha256;
   }else{
    if(!process.env.ANDROID_HOME)throw new Error('Set ANDROID_HOME to your Android SDK.');
    if(!process.env.CAMPUS_ANDROID_STORE_PASSWORD || !process.env.CAMPUS_ANDROID_KEY_PASSWORD)throw new Error('Set CAMPUS_ANDROID_STORE_PASSWORD and CAMPUS_ANDROID_KEY_PASSWORD securely in this process (never in config/source).');
    const tools=path.join(process.env.ANDROID_HOME,'build-tools',BUILD_TOOLS_VERSION),aligned=path.join(projectDirectory,'release-aligned.apk'),signed=path.join(projectDirectory,'release-signed.apk');
    try{
     // Invoke the official wrapper through sh: source ZIPs may not retain executable bits.
     await run('sh',[path.join(projectDirectory,'gradlew'),'--no-daemon','--console=plain','assembleRelease']);
     const unsigned=path.join(projectDirectory,'app/build/outputs/apk/release/app-release-unsigned.apk');await access(unsigned);
     await run(path.join(tools,'zipalign'),['-P','16','-f','4',unsigned,aligned]);
     await run(path.join(tools,'apksigner'),['sign','--ks',signingKey,'--ks-key-alias',config.signingKeyAlias,'--ks-pass','env:CAMPUS_ANDROID_STORE_PASSWORD','--key-pass','env:CAMPUS_ANDROID_KEY_PASSWORD','--out',signed,aligned]);
     certificate=verifiedCertificate(await run(path.join(tools,'apksigner'),['verify','--verbose','--print-certs',signed],{capture:true}));
     const publicKey=await run('keytool',['-exportcert','-rfc','-keystore',signingKey,'-alias',config.signingKeyAlias,'-storepass:env','CAMPUS_ANDROID_STORE_PASSWORD'],{capture:true});
     if(new X509Certificate(publicKey).fingerprint256.replaceAll(':','')!==certificate)throw new Error('APK certificate differs from the selected release keystore.');
     verifyApkIdentity(await run(path.join(tools,'aapt'),['dump','badging',signed],{capture:true}),config);
     await run(path.join(tools,'zipalign'),['-c','-P','16','4',signed]);await copyFile(signed,output);
    }finally{await rm(aligned,{force:true});await rm(signed,{force:true});}
   }
   let association=domainAssociation([],config,certificate);
   try{const response=await fetch(`${config.deploymentUrl}/.well-known/assetlinks.json`,{redirect:'error',signal:AbortSignal.timeout(20000)});if(response.ok && response.headers.get('content-type')?.includes('application/json'))association=domainAssociation(await response.json(),config,certificate);}catch{/* An installable signed APK does not require a deployed domain statement. */}
   const checksum=createHash('sha256').update(await readFile(output)).digest('hex');
   const receipt={signatureVerified:true,alignmentVerified:true,certificateSha256:certificate.match(/../g).join(':'),apkSha256:checksum,packageId:config.packageId,versionName:config.versionName,versionCode:config.versionCode,deploymentUrl:config.deploymentUrl,domainAssociation:association};
   await writeFile(receiptFile,JSON.stringify(receipt,null,2)+'\n');await writeFile(output+'.sha256',`${checksum}  ${path.basename(output)}\n`);
   console.log(`Verified signed release APK: ${output}\nSHA-256: ${checksum}\nDomain association: ${association.status}. ${association.note}\nTest this APK on a real Android phone before sharing it.`);
   if(options['--require-domain-association'] && !association.verified)throw new Error('The signed APK was built, but strict live domain association is pending. Deploy the generated assetlinks.json and rerun.');
  }
 }
}catch(error){console.error(`Android release stopped: ${error.message}`);process.exitCode=1;}
