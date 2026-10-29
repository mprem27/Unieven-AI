import {existsSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
if(!existsSync(path.join(root,'.private/campus.env')) || !existsSync(path.join(root,'.private/academic.env'))) {
 console.error('Configure Atlas first from Windows PowerShell: powershell -NoProfile -ExecutionPolicy Bypass -File .\\Setup.ps1');
 process.exit(1);
}
const args=['compose','-f','compose.yaml'];
if(existsSync(path.join(root,'.private/dev-mail.enabled')) || process.argv.includes('--dev-mail')) args.push('-f','compose.dev-mail.yaml');
args.push('up','-d','--wait','--wait-timeout','180');
const result=spawnSync('docker',args,{cwd:root,stdio:'inherit',shell:false});
if(result.error) {console.error('Docker Desktop is unavailable. Start its Linux container engine and retry.');process.exit(1);}
if(result.status!==0) {console.error('API startup failed. Run npm run doctor and inspect docker compose logs --tail 80.');process.exit(result.status || 1);}
console.log('API containers are healthy. Run npm run dev in another terminal for the React development server.');
