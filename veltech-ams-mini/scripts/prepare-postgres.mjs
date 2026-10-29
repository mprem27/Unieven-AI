import {mkdirSync,existsSync,readFileSync,writeFileSync,renameSync,unlinkSync} from 'node:fs';
import {randomBytes} from 'node:crypto';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),dir=path.join(root,'.private');
if(['campus.env','academic.env','postgres.env','ferretdb.env'].some(f=>existsSync(path.join(dir,f))))throw new Error('Existing configuration found. Nothing changed. Follow docs/V2-UPGRADE.md; do not replace keys or switch to an empty database.');
const originArg=process.argv.slice(2).find(v=>v.startsWith('--origin=')),origin=originArg?.slice(9) || 'http://localhost:4100';const url=new URL(origin);
if(url.origin!==origin || !['http:','https:'].includes(url.protocol) || url.username || url.password || url.protocol==='http:' && url.hostname!=='localhost')throw new Error('Choose an exact HTTPS origin or http://localhost:4100 for local development.');
const secret=()=>randomBytes(32).toString('hex'),password=secret(),shared=secret();
const campus={NODE_ENV:'production',CAMPUS_HOST:'0.0.0.0',CAMPUS_PORT:'4100',CAMPUS_PUBLIC_PORT:String(url.port || 4100),CAMPUS_COOKIE_SECURE:String(url.protocol==='https:'),CAMPUS_ORIGINS:origin,CAMPUS_LINK_KEY:secret(),CAMPUS_SERVICE_KEY:shared,CAMPUS_BRIDGE_ENABLED:'true',ACADEMIC_API_URL:'http://academic:8000/api/v1',MONGODB_URI:`mongodb://campus:${password}@ferretdb:27017/unieve_campus_v1?authSource=postgres`,CAMPUS_MEDIA_DIR:'/app/media',CAMPUS_WEB_DIST:'/app/web',CAMPUS_APK_DIRECTORY:'/app/media/app-releases',CAMPUS_RATE_LIMIT_STORE:'mongo',CAMPUS_MAIL_FROM:'',SMTP_HOST:'',SMTP_PORT:'587',SMTP_REQUIRE_TLS:'true',SMTP_USER:'',SMTP_PASS:''};
if(url.protocol==='https:')campus.CAMPUS_TRUST_PROXY='172.29.240.2/32';
const academic={MONGO_URI:`mongodb://campus:${password}@ferretdb:27017/unieve_campus_attendance_v1?authSource=postgres`,MONGO_DB_NAME:'unieve_campus_attendance_v1',CAMPUS_SERVICE_KEY:shared,JWT_SECRET:secret()+secret(),PORTAL_CREDENTIAL_ENCRYPTION_KEY:randomBytes(32).toString('base64url')+'=',DEFAULT_ADMIN_EMAIL:'local-admin@example.invalid',DEFAULT_ADMIN_NAME:'Academic service administrator',DEFAULT_ADMIN_PASSWORD:secret(),COLLEGE_ADAPTER_MODE:'portal',SYNC_ENABLED:'false',SMS_ENABLED:'false',EMAIL_ENABLED:'false',CORS_ORIGINS:'[]'};
const configs={'postgres.env':{POSTGRES_USER:'campus',POSTGRES_PASSWORD:password,POSTGRES_DB:'postgres'},'ferretdb.env':{FERRETDB_POSTGRESQL_URL:`postgres://campus:${password}@postgres:5432/postgres`},'campus.env':campus,'academic.env':academic};
mkdirSync(dir,{recursive:true,mode:0o700});const created=[];
try{for(const [name,values] of Object.entries(configs)){const f=path.join(dir,name);writeFileSync(f,Object.entries(values).map(([k,v])=>`${k}=${JSON.stringify(v)}`).join('\n')+'\n',{flag:'wx',mode:0o600});created.push(f);}writeFileSync(path.join(dir,'postgres.enabled'),'PostgreSQL + FerretDB\n',{flag:'wx',mode:0o600});}
catch(error){for(const f of created)unlinkSync(f);throw error;}
console.log('Created private PostgreSQL configuration and persistent keys. No credentials were printed. Start with compose.yaml + compose.postgres.yaml.');
