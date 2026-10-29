import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import express from 'express';
import {registerDownloads} from '../routes/downloads.js';
test('downloads use actual attachment bytes and only allow fixed package identifiers',async()=>{
 const directory=await fs.mkdtemp(path.join(os.tmpdir(),'campus-download-test-'));
 await fs.writeFile(path.join(directory,'veltech-ams-mini-v1.8-source.zip'),'test-package');
 const app=express();registerDownloads(app,{directory});const server=app.listen(0);await new Promise(resolve=>server.once('listening',resolve));const url=`http://127.0.0.1:${server.address().port}`;
 try {
  const index=await (await fetch(url+'/downloads')).json();assert.equal(index.items[0].available,true);assert.equal(index.items[1].hosted,true);assert.match(index.items[1].url,/^https:\/\/raw.githubusercontent.com\/vtu26418-design\/Clinical\/veltech-ams-mini-v2\.3\.3-college-update\//);
  const file=await fetch(url+'/downloads/source');assert.equal(file.headers.get('content-type'),'application/zip');assert.match(file.headers.get('content-disposition'),/attachment/);assert.equal(await file.text(),'test-package');
  await fs.writeFile(path.join(directory,'veltech-ams-mini-source.zip'),'updated-package');assert.equal(await (await fetch(url+'/downloads/source')).text(),'updated-package');
  assert.equal((await fetch(url+'/downloads/unknown')).status,404);const remote=await fetch(url+'/downloads/mobile-web',{redirect:'manual'});assert.equal(remote.status,302);assert.equal(remote.headers.get('location'),index.items[1].url);
 }finally{await new Promise(resolve=>server.close(resolve));await fs.rm(directory,{recursive:true,force:true});}
});
