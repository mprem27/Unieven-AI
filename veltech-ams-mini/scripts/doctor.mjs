import {existsSync,readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
let failed=false;
function report(ok,message){console.log(`${ok?'OK':'CHECK'} ${message}`);if(!ok)failed=true;}
const [major,minor]=process.versions.node.split('.').map(Number);
report(major>22 || major===22 && minor>=12,`Node ${process.versions.node}; supported minimum 22.12 (Node 24 LTS recommended).`);
report(existsSync(path.join(root,'frontend/node_modules/vite/package.json')),'Frontend dependencies; install with npm run setup.');
for(const file of ['campus.env','academic.env']) report(existsSync(path.join(root,'.private',file)),`Private ${file}; generate with Setup.ps1.`);
for(const args of [['version','--format','{{.Server.Version}}'],['compose','version']]) {
 const result=spawnSync('docker',args,{cwd:root,encoding:'utf8',shell:false});
 report(!result.error && result.status===0,args[0]==='version'?'Docker engine is reachable.':'Docker Compose is available.');
}
let port='4100';
const envFile=path.join(root,'.private/campus.env');
if(existsSync(envFile)) {
 const match=readFileSync(envFile,'utf8').match(/^CAMPUS_PUBLIC_PORT=["']?(\d+)["']?\s*$/m);
 if(match)port=match[1];
}
try {
 const response=await fetch(`http://127.0.0.1:${port}/api/campus/health`,{signal:AbortSignal.timeout(5000)});
 const value=await response.json();report(response.ok && value.status==='ok' && value.database==='connected',`Campus API and its database respond on port ${port}.`);
} catch {report(false,`API is not ready on port ${port}; run Start.ps1 or npm run dev:api.`);}
console.log('This check never prints database URIs, keys or account credentials.');
process.exitCode=failed?1:0;
