import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawn} from 'node:child_process';
import net from 'node:net';
const script=fileURLToPath(new URL('../scripts/mail-check.js',import.meta.url));
async function fixture(t,overrides={}) {
 const dir=await mkdtemp(path.join(tmpdir(),'veltech-mail-'));t.after(()=>rm(dir,{recursive:true,force:true}));
 const values={NODE_ENV:'production',CAMPUS_MAIL_FROM:'Campus <sender@example.test>',SMTP_HOST:'smtp.example.test',SMTP_PORT:'587',SMTP_USER:'fixture-user',SMTP_PASS:'private-sentinel-password',CAMPUS_PUBLIC_URL:'https://campus.example.test',...overrides};
 const file=path.join(dir,'campus.env');await writeFile(file,Object.entries(values).map(([k,v])=>`${k}=${JSON.stringify(v)}`).join('\n'),{mode:0o600});return file;
}
async function run(file,args=[]) {
 return new Promise((resolve,reject)=>{const p=spawn(process.execPath,[script,`--env-file=${file}`,...args],{env:{...process.env,NODE_ENV:'development'},stdio:['ignore','pipe','pipe']});let stdout='',stderr='';p.stdout.on('data',b=>stdout+=b);p.stderr.on('data',b=>stderr+=b);p.on('error',reject);p.on('close',status=>resolve({status,stdout,stderr}));});
}
test('email check validates configuration without connecting or printing credentials',async t=>{
 const result=await run(await fixture(t));assert.equal(result.status,0,result.stderr);assert.match(result.stdout,/SMTP/i);assert.doesNotMatch(result.stdout+result.stderr,/private-sentinel-password|fixture-user/);
});
test('email check rejects production plaintext and hides raw secret-looking options',async t=>{
 const result=await run(await fixture(t,{NODE_ENV:'production',SMTP_REQUIRE_TLS:'false'}));assert.notEqual(result.status,0);assert.match(result.stdout+result.stderr,/TLS/);assert.doesNotMatch(result.stdout+result.stderr,/private-sentinel-password/);
 const bad=await run(await fixture(t),['--password=private-sentinel-password']);assert.notEqual(bad.status,0);assert.doesNotMatch(bad.stdout+bad.stderr,/private-sentinel-password/);
});
test('real loopback SMTP verifies without sending, then accepts a multipart branded test message',async t=>{
 const messages=[];const sockets=new Set();
 const server=net.createServer(socket=>{sockets.add(socket);socket.on('close',()=>sockets.delete(socket));socket.setEncoding('utf8');socket.write('220 localhost fixture SMTP\r\n');let buffer='',data=false,message='';socket.on('data',part=>{buffer+=part;let end;while((end=buffer.indexOf('\r\n'))>=0){const line=buffer.slice(0,end);buffer=buffer.slice(end+2);if(data){if(line==='.') {messages.push(message);message='';data=false;socket.write('250 2.0.0 accepted\r\n');}else message+=line+'\r\n';continue;}const cmd=line.split(' ')[0].toUpperCase();if(cmd==='EHLO'||cmd==='HELO')socket.write('250-localhost\r\n250 8BITMIME\r\n');else if(cmd==='DATA'){data=true;socket.write('354 end with a dot\r\n');}else if(cmd==='QUIT'){socket.end('221 bye\r\n');}else socket.write('250 OK\r\n');}});});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));t.after(async()=>{for(const s of sockets)s.destroy();await new Promise(resolve=>server.close(resolve));});
 const file=await fixture(t,{NODE_ENV:'development',SMTP_HOST:'127.0.0.1',SMTP_PORT:String(server.address().port),SMTP_REQUIRE_TLS:'false',SMTP_USER:'',SMTP_PASS:''});
 const verified=await run(file,['--verify']);assert.equal(verified.status,0,verified.stderr);assert.equal(messages.length,0);
 const result=await run(file,['--send-to=student@example.test']);assert.equal(result.status,0,result.stderr);assert.equal(messages.length,1);assert.match(messages[0],/multipart\/alternative/);assert.match(messages[0],/text\/html/);assert.match(messages[0],/text\/plain/);assert.match(messages[0],/veltech-ams-mini/);assert.match(result.stdout,/accepted/i);
});
