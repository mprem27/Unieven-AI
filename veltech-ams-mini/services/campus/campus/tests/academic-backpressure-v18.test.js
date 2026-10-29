import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import {academicClient} from '../services/academic.js';

test('academic source-login backpressure survives the service boundary',async()=>{
 const server=http.createServer((_req,res)=>{res.writeHead(503,{'Content-Type':'application/json','Retry-After':'3'});res.end(JSON.stringify({detail:'AMS sign-in is busy. Retry shortly.'}));}).listen(0,'127.0.0.1');
 await new Promise(resolve=>server.once('listening',resolve));
 const academic=academicClient(`http://127.0.0.1:${server.address().port}`,'synthetic-service-key');
 try {
  for(const action of [()=>academic.internal('/campus/portal-login/session',{}),()=>academic.request('synthetic-owner-token','/campus/ams/sync','POST',{}),()=>academic.bootstrap({campusId:'owner'})]){
   await assert.rejects(action,error=>error.status===503 && error.retryAfter===3 && error.message==='AMS sign-in is busy. Retry shortly.');
  }
 }finally{await new Promise(resolve=>server.close(resolve));}
});

test('AMS refresh cooldown preserves Retry-After and never retries the source mutation',async()=>{
 let calls=0;const server=http.createServer((_req,res)=>{calls++;res.writeHead(429,{'Content-Type':'application/json','Retry-After':'120'});res.end(JSON.stringify({detail:'AMS was checked recently.'}));}).listen(0,'127.0.0.1');
 await new Promise(resolve=>server.once('listening',resolve));
 try{const academic=academicClient(`http://127.0.0.1:${server.address().port}`);await assert.rejects(()=>academic.request('synthetic-owner-token','/campus/ams/refresh','POST',{}),error=>error.status===429 && error.retryAfter===120);assert.equal(calls,1);}
 finally{await new Promise(resolve=>server.close(resolve));}
});
