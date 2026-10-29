import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {createHash} from 'node:crypto';
import {registerAppRelease} from '../routes/app-release.js';
import express from 'express';
// Exercise the real route without starting a database or authentication system.
test('release endpoint refuses unsigned manifests and unrelated package identities',async()=>{
 const directory=await fs.mkdtemp(path.join(os.tmpdir(),'campus-release-v22-')),routes=new Map();
 registerAppRelease({get:(name,handler)=>routes.set(name,handler)},{directory});
 const data=Buffer.alloc(1200,1),sha256=createHash('sha256').update(data).digest('hex');
 const manifest={versionName:'2.2.0',versionCode:20200,sha256,packageId:'in.velstudents.veltechams',certificateSha256:Array(32).fill('AB').join(':')};
 const get=async()=>{let result;await routes.get('/app-release')({}, {set(){return this;},json(value){result=value;}});return result;};
 try{
  await fs.writeFile(path.join(directory,sha256+'.apk'),data);await fs.writeFile(path.join(directory,'release.json'),JSON.stringify(manifest));
  assert.equal((await get()).available,false,'Unsigned publication receipt must not produce a download');
  manifest.signatureVerified=true;manifest.alignmentVerified=true;await fs.writeFile(path.join(directory,'release.json'),JSON.stringify(manifest));assert.equal((await get()).available,true);
  manifest.packageId='in.unrelated.application';await fs.writeFile(path.join(directory,'release.json'),JSON.stringify(manifest));assert.equal((await get()).available,false);
 }finally{await fs.rm(directory,{recursive:true,force:true});}
});
test('stable domain-only APK link serves the latest local verified release without an external redirect',async()=>{
 const directory=await fs.mkdtemp(path.join(os.tmpdir(),'campus-release-domain-')),routes=new Map();
 registerAppRelease({get:(name,handler)=>routes.set(name,handler)},{directory});
 try{
  const handler=routes.get('/app-release/latest.apk');assert.equal(typeof handler,'function');
  const data=Buffer.alloc(1400,1),sha256=createHash('sha256').update(data).digest('hex');
  const manifest={signatureVerified:true,alignmentVerified:true,versionName:'2.3.0',versionCode:20300,sha256,packageId:'in.velstudents.veltechams',certificateSha256:Array(32).fill('AB').join(':')};
  await fs.writeFile(path.join(directory,sha256+'.apk'),data);await fs.writeFile(path.join(directory,'release.json'),JSON.stringify(manifest));
  let attachment,headers;
  await handler({query:{url:'https://untrusted.example/app.apk'}},{set(value){headers=value;return this;},type(){return this;},download(...args){attachment=args;}});
  assert.equal(attachment[0],path.join(directory,sha256+'.apk'));
  assert.equal(attachment[1],'veltech-ams-mini-2.3.0.apk');
  assert.equal(headers['Cache-Control'],'no-store');assert.equal(headers['X-APK-SHA256'],sha256);
 }finally{await fs.rm(directory,{recursive:true,force:true});}
});
test('public pinned attachment preserves its own origin and rejects stale or corrupted releases',async()=>{
 const directory=await fs.mkdtemp(path.join(os.tmpdir(),'campus-release-pinned-'));
 const app=express(),router=express.Router();registerAppRelease(router,{directory});app.use('/api/campus',router);
 app.use((error,_req,res,_next)=>res.status(error.status || 500).json({message:error.message}));
 const server=app.listen(0,'127.0.0.1');await new Promise(resolve=>server.once('listening',resolve));
 const origin=`http://127.0.0.1:${server.address().port}`;
 try{
  const data=Buffer.alloc(1400,1);data.set([0x50,0x4b,3,4]);const sha256=createHash('sha256').update(data).digest('hex');
  const manifest={signatureVerified:true,alignmentVerified:true,versionName:'2.3.2',versionCode:20302,sha256,packageId:'in.velstudents.veltechams',certificateSha256:Array(32).fill('AB').join(':')};
  await fs.writeFile(path.join(directory,sha256+'.apk'),data);await fs.writeFile(path.join(directory,'release.json'),JSON.stringify(manifest));
  const metadata=await fetch(origin+'/api/campus/app-release');assert.equal(metadata.status,200);
  const release=await metadata.json();assert.equal(release.url,`/api/campus/app-release/apk?sha=${sha256}`);
  const attachment=await fetch(origin+release.url,{redirect:'error'});
  assert.equal(attachment.status,200);assert.equal(new URL(attachment.url).origin,origin);assert.equal(attachment.headers.get('location'),null);
  assert.match(attachment.headers.get('content-type'),/^application\/vnd.android.package-archive/);
  assert.match(attachment.headers.get('content-disposition'),/^attachment; filename="?veltech-ams-mini-2\.3\.2\.apk"?$/);
  assert.equal(attachment.headers.get('cache-control'),'no-store');assert.equal(attachment.headers.get('x-apk-sha256'),sha256);
  assert.equal(createHash('sha256').update(Buffer.from(await attachment.arrayBuffer())).digest('hex'),sha256);
  const stale=await fetch(origin+'/api/campus/app-release/apk?sha='+'00'.repeat(32));
  assert.equal(stale.status,409);assert.match((await stale.json()).message,/release changed/i);
  await fs.writeFile(path.join(directory,sha256+'.apk'),Buffer.alloc(1500,2));
  assert.equal((await (await fetch(origin+'/api/campus/app-release')).json()).available,false);
  assert.equal((await fetch(origin+release.url)).status,404);
 }finally{await new Promise(resolve=>server.close(resolve));await fs.rm(directory,{recursive:true,force:true});}
});
