import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
test('publisher rejects a fabricated APK even with a matching claimed signing receipt',async()=>{
 const dir=await mkdtemp(path.join(tmpdir(),'campus-fake-apk-'));
 try{
  const data=Buffer.alloc(1200,1);await writeFile(path.join(dir,'fake.apk'),data);await writeFile(path.join(dir,'receipt.json'),JSON.stringify({apkSha256:createHash('sha256').update(data).digest('hex'),versionName:'2.2.0',versionCode:20200,packageId:'in.velstudents.veltechams',certificateSha256:Array(32).fill('AB').join(':'),signatureVerified:true,alignmentVerified:true}));
  const result=spawnSync(process.execPath,['scripts/publish-android-release.mjs',`--apk=${path.join(dir,'fake.apk')}`,`--receipt=${path.join(dir,'receipt.json')}`,`--out=${path.join(dir,'out')}`],{cwd:new URL('../../',import.meta.url),encoding:'utf8'});
  assert.notEqual(result.status,0,'Non-APK bytes were accepted as a signed release');assert.match(result.stderr,/APK|signature|SDK/);
 }finally{await rm(dir,{recursive:true,force:true});}
});
