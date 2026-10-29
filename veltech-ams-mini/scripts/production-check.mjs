import {spawnSync} from 'node:child_process';
import {readFileSync,statfsSync,existsSync} from 'node:fs';
import {X509Certificate,createPrivateKey,createPublicKey} from 'node:crypto';
import {isIP} from 'node:net';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const hasPort=service=>(service?.ports || []).length>0 || service?.network_mode==='host';
const strong=(value,length=48)=>typeof value==='string' && value.length>=length && new Set(value).size>=8 && !/change.?this|replace.?with|example|password|<|>/i.test(value);
const hexKey=value=>/^[a-f0-9]{64}$/i.test(value || '') && new Set(value).size>=8;
const truth=value=>String(value).toLowerCase()==='true';

export function evaluateProductionConfig(config) {
  const checks=[],add=(ok,message)=>checks.push({ok:!!ok,message});
  const {campus,academic,proxy,mongo,postgres,ferretdb}=config.services || {},c=campus?.environment || {},a=academic?.environment || {};
  add(campus && academic && proxy,'Production campus, academic and HTTPS proxy services exist.');
  add(c.NODE_ENV==='production' && truth(c.CAMPUS_COOKIE_SECURE),'Production mode and Secure session cookies are enabled.');
  let origins=[];
  try {origins=String(c.CAMPUS_ORIGINS || '').split(',').map(value=>new URL(value.trim()));}catch{}
  add(origins.length>0 && origins.every(value=>value.protocol==='https:' && value.origin===value.href.replace(/\/$/,'') && !value.username && !value.password && !['localhost','127.0.0.1','[::1]'].includes(value.hostname)),'Allowed browser origins are explicit public HTTPS origins.');
  const hostname=proxy?.environment?.CAMPUS_SERVER_NAME;
  add(typeof hostname==='string' && /^[a-z0-9.-]+$/i.test(hostname) && !/example\.|\.invalid$/.test(hostname) && origins.some(value=>value.protocol==='https:' && value.hostname===hostname),'TLS proxy hostname matches an allowed origin and has been customized.');
  add(hexKey(c.CAMPUS_LINK_KEY),'The persistent campus encryption key is configured.');
  add(hexKey(c.CAMPUS_SERVICE_KEY) && c.CAMPUS_SERVICE_KEY===a.CAMPUS_SERVICE_KEY,'The private bridge key is strong and identical in both services.');
  add(strong(a.JWT_SECRET),'The private academic JWT signing secret is configured.');
  let fernet=false;try {fernet=/^[A-Za-z0-9_-]{43}=$/.test(a.PORTAL_CREDENTIAL_ENCRYPTION_KEY || '') && Buffer.from(a.PORTAL_CREDENTIAL_ENCRYPTION_KEY,'base64url').length===32 && new Set(a.PORTAL_CREDENTIAL_ENCRYPTION_KEY).size>=8;}catch{}
  add(fernet,'The persistent portal credential encryption key is configured.');
  const validMongo=uri=>{
    try {
      const value=new URL(uri);
      if(!['mongodb:','mongodb+srv:'].includes(value.protocol) || !value.username || !value.password || !value.pathname.slice(1))return false;
      for(const [key,entry] of value.searchParams)if((/^(tls|ssl)$/i.test(key) && /^(false|0)$/i.test(entry)) || (/^(tlsinsecure|tlsallowinvalidcertificates|tlsallowinvalidhostnames)$/i.test(key) && /^(true|1)$/i.test(entry)))return false;
      if(value.hostname==='ferretdb')return !!postgres && !!ferretdb && !hasPort(postgres) && !hasPort(ferretdb) && !!config.networks?.private?.internal && !!ferretdb.networks?.private && !!postgres.networks?.private && value.searchParams.get('authSource')==='postgres';
      if(value.hostname==='mongo')return !!mongo && !hasPort(mongo);
      return value.protocol==='mongodb+srv:' || truth(value.searchParams.get('tls')) || truth(value.searchParams.get('ssl'));
    }catch{return false;}
  };
  add(validMongo(c.MONGODB_URI) && validMongo(a.MONGO_URI),'Both database connections use authenticated private storage or verified TLS.');
  add(c.CAMPUS_RATE_LIMIT_STORE==='mongo','Request limits use shared database counters across campus replicas.');
  const proxyAddress=Object.values(proxy?.networks || {}).map(value=>value?.ipv4_address).find(Boolean);
  add(isIP(proxyAddress || '')===4 && c.CAMPUS_TRUST_PROXY===`${proxyAddress}/32`,'Only the configured reverse proxy address is trusted for client IPs.');
  add(!hasPort(campus) && !hasPort(academic) && !hasPort(mongo) && !hasPort(postgres) && !hasPort(ferretdb),'Campus, private academic API and database services have no published host ports.');
  add(c.ACADEMIC_API_URL==='http://academic:8000/api/v1' && (academic?.command || []).slice(-2).join(' ')==='--workers 1' && String(academic?.environment?.WEB_CONCURRENCY)==='1','The private academic API uses one worker for pending AMS verification sessions.');
  const media=(campus?.volumes || []).find(value=>value.target==='/app/media');
  add(media?.type==='volume' && !media.read_only && c.CAMPUS_MEDIA_DIR==='/app/media','Campus replicas mount the same persistent media volume.');
  const tls=(proxy?.volumes || []).find(value=>value.target==='/etc/nginx/tls');
  add(tls?.type==='bind' && tls.read_only,'TLS certificates are mounted from an operator directory as read-only.');
  const from=c.CAMPUS_MAIL_FROM || c.MAIL_FROM || c.SMTP_FROM;
  const realSender=typeof from==='string' && !/[\r\n\0]/.test(from) && /[^\s<>]+@[^\s<>]+\.[^\s<>]+/.test(from) && !/\.invalid(?:>|$)/.test(from);
  const mailPort=Number(c.SMTP_PORT || 587),directTLS=truth(c.SMTP_SECURE) || mailPort===465;
  let mailOrigin=true;
  if(c.CAMPUS_PUBLIC_URL)try {const value=new URL(c.CAMPUS_PUBLIC_URL);mailOrigin=value.protocol==='https:' && value.origin===value.href.replace(/\/$/,'') && !value.username && !value.password;}catch{mailOrigin=false;}
  const smtp=!!c.SMTP_HOST && !/mailpit|localhost|127\.0\.0\.1/i.test(c.SMTP_HOST) && Number.isInteger(mailPort) && mailPort>0 && mailPort<=65535 && !(mailPort===587 && directTLS) && (truth(c.SMTP_REQUIRE_TLS) || directTLS) && (!!c.SMTP_USER===!!c.SMTP_PASS);
  add(realSender && mailOrigin && (smtp || (!c.SMTP_HOST && strong(c.BREVO_API_KEY,16))),'Real email delivery has a sender and TLS SMTP configuration or a Brevo credential.');
  if(mongo) {
    const m=mongo.environment || {};
    add(strong(m.MONGO_INITDB_ROOT_PASSWORD,32) && strong(m.MONGO_CAMPUS_PASSWORD,32) && strong(m.MONGO_ACADEMIC_PASSWORD,32) && new Set([m.MONGO_INITDB_ROOT_PASSWORD,m.MONGO_CAMPUS_PASSWORD,m.MONGO_ACADEMIC_PASSWORD]).size===3,'Self-hosted MongoDB has distinct strong root and application credentials.');
    add((mongo.volumes || []).some(value=>value.target==='/data/db' && value.type==='volume' && !value.read_only),'Self-hosted MongoDB uses persistent operator-owned storage.');
  }
  if(postgres || ferretdb){
    const p=postgres?.environment || {},f=ferretdb?.environment || {};let gateway=false;
    try{const uri=new URL(f.FERRETDB_POSTGRESQL_URL);gateway=uri.protocol==='postgres:' && uri.hostname==='postgres' && uri.pathname==='/postgres' && decodeURIComponent(uri.username)===p.POSTGRES_USER && decodeURIComponent(uri.password)===p.POSTGRES_PASSWORD;}catch{}
    add(strong(p.POSTGRES_PASSWORD,32) && gateway,'PostgreSQL has a strong credential and matching private gateway configuration.');
    add((postgres?.volumes || []).some(v=>v.type==='volume' && v.target==='/var/lib/postgresql/data' && !v.read_only),'PostgreSQL data is stored on a persistent volume.');
  }
  return checks;
}

async function main() {
  const args=process.argv.slice(2),selfHosted=args.includes('--self-hosted'),postgres=args.includes('--postgres') || existsSync(path.join(root,'.private/postgres.enabled'));
  const option=name=>args.find(value=>value.startsWith(`${name}=`))?.slice(name.length+1);
  if(args.some(value=>!['--self-hosted','--postgres'].includes(value) && !['--url=','--storage-path='].some(prefix=>value.startsWith(prefix)))) {
    console.error('Usage: node scripts/production-check.mjs [--self-hosted | --postgres] [--url=https://campus.your-domain.edu] [--storage-path=/host/storage]');process.exitCode=1;return;
  }
  if(selfHosted && postgres){console.error('Choose either the MongoDB or PostgreSQL overlay, not both.');process.exitCode=1;return;}
  const dockerArgs=['compose','--env-file','.env.production','-f','compose.production.yaml',...(selfHosted?['-f','compose.mongo.yaml']:[]),...(postgres?['-f','compose.postgres.production.yaml']:[]),'config','--format','json'];
  const result=spawnSync('docker',dockerArgs,{cwd:root,encoding:'utf8',maxBuffer:8*1024*1024,shell:false});
  if(result.error || result.status!==0) {
    console.error('CHECK Production Compose configuration could not be resolved. Ensure Docker Compose, .env.production and private env files exist. No configuration or error output was printed because it may contain credentials.');process.exitCode=1;return;
  }
  let config;
  try {config=JSON.parse(result.stdout);}catch{console.error('CHECK Docker Compose did not return valid configuration.');process.exitCode=1;return;}
  const checks=evaluateProductionConfig(config);
  const tls=config.services?.proxy?.volumes?.find(value=>value.target==='/etc/nginx/tls');
  try {
    const certificate=new X509Certificate(readFileSync(path.join(tls.source,'fullchain.pem'))),key=createPrivateKey(readFileSync(path.join(tls.source,'privkey.pem')));
    checks.push({ok:!!certificate.checkHost(config.services.proxy.environment.CAMPUS_SERVER_NAME) && Date.parse(certificate.validFrom)<=Date.now() && Date.parse(certificate.validTo)>Date.now()+7*86400000 && certificate.publicKey.export({type:'spki',format:'der'}).equals(createPublicKey(key).export({type:'spki',format:'der'})),message:'TLS certificate matches its key and hostname and remains valid for at least seven days.'});
  }catch{checks.push({ok:false,message:'Readable matching fullchain.pem and privkey.pem are required in the TLS directory.'});}
  const storagePath=option('--storage-path');
  if(storagePath) {
    try {const value=statfsSync(storagePath);checks.push({ok:value.bavail*value.bsize>=1024**3,message:'The selected host storage filesystem has at least 1 GiB available (minimum check only, not a capacity plan).'});}
    catch{checks.push({ok:false,message:'The selected host storage filesystem can be inspected.'});}
  }
  const url=option('--url');
  if(url) {
    try {
      const parsed=new URL(url);
      if(parsed.protocol!=='https:' || parsed.username || parsed.password || parsed.search || parsed.hash || parsed.pathname!=='/')throw new Error();
      const response=await fetch(new URL('/api/campus/health',parsed),{signal:AbortSignal.timeout(10000),redirect:'error'}),value=await response.json();
      checks.push({ok:response.ok && value.status==='ok' && value.database==='connected',message:'The public HTTPS route returns the campus health response and a successful database ping.'});
      const privateResponse=await fetch(new URL('/api/v1/health',parsed),{signal:AbortSignal.timeout(10000),redirect:'error'});
      checks.push({ok:privateResponse.status===404,message:'The public HTTPS route does not expose the academic health endpoint.'});
    }catch{checks.push({ok:false,message:'The public HTTPS functional health checks completed with certificate verification enabled.'});}
  }
  for(const {ok,message} of checks)console.log(`${ok?'OK':'CHECK'} ${message}`);
  if(!url)console.log('UNRUN Public HTTPS health: add --url=https://your-host after startup.');
  if(!storagePath)console.log('UNRUN Actual volume capacity: inspect Docker host data/media filesystems and backups; optionally add --storage-path.');
  console.log('Email delivery, AMS credentials, backup restoration and production load still require operator validation. No secret values were printed.');
  process.exitCode=checks.every(value=>value.ok)?0:1;
}
if(process.argv[1] && path.resolve(process.argv[1])===fileURLToPath(import.meta.url))await main();
