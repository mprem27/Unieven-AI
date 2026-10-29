import test from 'node:test';
import assert from 'node:assert/strict';
import * as releases from '../src/lib/app-release.js';
const {validateAndroidRelease, verifyApkDownload, androidInstallation}=releases;
import {webcrypto} from 'node:crypto';
const sha='ab'.repeat(32);
const release={available:true,versionName:'2.2.0',versionCode:20200,bytes:1024,packageId:'in.velstudents.veltechams',sha256:sha,url:`/api/campus/app-release/apk?sha=${sha}`};
test('download metadata must bind a same-origin APK endpoint to its checksum',()=>{
 assert.equal(validateAndroidRelease(release).url,release.url);
 for(const patch of [{url:'https://evil.invalid/app.apk'},{url:'/api/campus/app-release/apk?sha=other'},{bytes:0},{versionCode:NaN},{packageId:'other.app'}]) assert.throws(()=>validateAndroidRelease({...release,...patch}));
 assert.equal(validateAndroidRelease({available:false}).available,false);
});
test('APK download fails closed when bytes are incomplete or checksum differs',async()=>{
 const bytes=new Uint8Array(1024);bytes.set([0x50,0x4b,3,4]);const digest=Buffer.from(await webcrypto.subtle.digest('SHA-256',bytes)).toString('hex');
 await verifyApkDownload(bytes,{...release,sha256:digest},webcrypto);
 await assert.rejects(verifyApkDownload(bytes,release,webcrypto),/checksum/i);
 await assert.rejects(verifyApkDownload(bytes.subarray(0,100),release,webcrypto),/incomplete/i);
});
test('unknown Android apps cannot establish this app installation without matching package',()=>{
 assert.equal(androidInstallation({referrer:'android-app://in.unrelated.launcher'}).installed,false);
 assert.equal(androidInstallation({search:'?androidPackage=in.velstudents.veltechams&androidVersionCode=20200'}).installed,false);
});
