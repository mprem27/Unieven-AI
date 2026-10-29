export function verifiedCertificate(output){
 const match=output.match(/^Signer #1 certificate SHA-256 digest:\s*([a-f0-9]{64})\s*$/im);
 if(!match || !/^Verified using v[23] scheme[^\n]*:\s*true\s*$/im.test(output))throw new Error('APK signature verification did not confirm a v2/v3 release certificate.');
 if(/^Signer #2 /m.test(output))throw new Error('Multiple APK signing identities are not supported.');
 return match[1].toUpperCase();
}
export function domainAssociation(links,config,fingerprint){
 const normalized=fingerprint.replaceAll(':','').toUpperCase();
 const verified=Array.isArray(links) && links.some(link=>link.relation?.includes('delegate_permission/common.handle_all_urls')
  && link.target?.namespace==='android_app' && link.target.package_name===config.packageId
  && Array.isArray(link.target.sha256_cert_fingerprints) && link.target.sha256_cert_fingerprints.some(v=>typeof v==='string' && /^(?:[a-f0-9]{2}:){31}[a-f0-9]{2}$/i.test(v) && v.replaceAll(':','').toUpperCase()===normalized));
 return {verified,status:verified?'verified':'pending',note:verified?'Live domain statement matches this APK certificate.':'Deploy assetlinks.json for this release certificate. Until domain verification succeeds, the app may open with browser controls.'};
}
export function verifyApkIdentity(output,config){
 const line=output.split('\n').find(v=>v.startsWith('package: ')) || '';
 const expected={name:config.packageId,versionCode:String(config.versionCode),versionName:config.versionName};
 for(const [key,value] of Object.entries(expected))if(!line.includes(`${key}='${value}'`))throw new Error(`APK identity does not match configured ${key}.`);
 if(!/^launchable-activity: /m.test(output))throw new Error('APK has no launchable Android activity.');
 if(/^application-debuggable/m.test(output))throw new Error('A debuggable APK cannot be published as a release.');
}
