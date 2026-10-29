import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {createCampusApp} from '../server.js';
test('Android domain association serves only the configured public JSON, without SPA or hidden-file fallback',async()=>{
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'campus-assetlinks-')),before=process.env.CAMPUS_WEB_DIST;process.env.CAMPUS_WEB_DIST=dir;
 await fs.mkdir(path.join(dir,'.well-known'));await fs.writeFile(path.join(dir,'index.html'),'<html>fictional shell</html>');
 const server=createCampusApp().listen(0);await new Promise(r=>server.once('listening',r));const base='http://127.0.0.1:'+server.address().port;
 const association=[{relation:['delegate_permission/common.handle_all_urls'],target:{namespace:'android_app',package_name:'edu.veltech.amsmini',sha256_cert_fingerprints:[Array(32).fill('AB').join(':')]}}];
 try{
  const missing=await fetch(base+'/.well-known/assetlinks.json');assert.equal(missing.status,404);assert.match(missing.headers.get('content-type'),/application\/json/);
  await fs.writeFile(path.join(dir,'.well-known','assetlinks.json'),JSON.stringify(association));
  const present=await fetch(base+'/.well-known/assetlinks.json');assert.equal(present.status,200);assert.match(present.headers.get('content-type'),/application\/json/);assert.deepEqual(await present.json(),association);
  await fs.writeFile(path.join(dir,'.well-known','assetlinks.json'),'<html>wrong upload</html>');assert.equal((await fetch(base+'/.well-known/assetlinks.json')).status,503);
  await fs.writeFile(path.join(dir,'.well-known','assetlinks.json'),'x'.repeat(65537));assert.equal((await fetch(base+'/.well-known/assetlinks.json')).status,503);
 }finally{await new Promise(r=>server.close(r));if(before===undefined)delete process.env.CAMPUS_WEB_DIST;else process.env.CAMPUS_WEB_DIST=before;await fs.rm(dir,{recursive:true,force:true});}
});
