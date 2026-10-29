import test from 'node:test';
import assert from 'node:assert/strict';
import * as release from '../../scripts/android-release-tools.mjs';
const fingerprint='AB'.repeat(32);
test('signature receipt requires a real apksigner certificate digest and successful v2/v3 verification',()=>{
 const output=`Verifies\nVerified using v1 scheme (JAR signing): true\nVerified using v2 scheme (APK Signature Scheme v2): true\nSigner #1 certificate SHA-256 digest: ${fingerprint.toLowerCase()}\n`;
 assert.equal(release.verifiedCertificate(output),fingerprint);
 assert.throws(()=>release.verifiedCertificate(output.replace('v2): true','v2): false')),/signature/i);
 assert.throws(()=>release.verifiedCertificate('Signer #1 certificate SHA-256 digest: nope'),/signature/i);
});
test('domain association is distinct from signature verification and matches exact package and certificate',()=>{
 const config={packageId:'in.velstudents.veltechams'};
 assert.equal(release.domainAssociation([],config,fingerprint).verified,false);
 const links=[{relation:['delegate_permission/common.handle_all_urls'],target:{namespace:'android_app',package_name:config.packageId,sha256_cert_fingerprints:[fingerprint.match(/../g).join(':')]}}];
 assert.equal(release.domainAssociation(links,config,fingerprint).verified,true);
 assert.equal(release.domainAssociation(links,{packageId:'another.package.id'},fingerprint).verified,false);
});
test('APK metadata must match release package, version and launchable application',()=>{
 const config={packageId:'in.velstudents.veltechams',versionCode:20200,versionName:'2.2.0'};
 const output="package: name='in.velstudents.veltechams' versionCode='20200' versionName='2.2.0'\nlaunchable-activity: name='in.velstudents.veltechams.LauncherActivity'";
 assert.doesNotThrow(()=>release.verifyApkIdentity(output,config));
 assert.throws(()=>release.verifyApkIdentity(output.replace('20200','20100'),config),/identity/i);
 assert.throws(()=>release.verifyApkIdentity(output.replace('launchable-activity:','none:'),config),/launchable/i);
});
