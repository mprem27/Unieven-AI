import {mkdirSync,existsSync,writeFileSync,unlinkSync} from 'node:fs';
import {randomBytes} from 'node:crypto';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

// Creates a fresh optional self-hosted configuration; never rewrites existing
// encryption keys, credentials or operator configuration.
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const args=process.argv.slice(2),originArg=args.find(value=>value.startsWith('--origin='));
if(args.some(value=>!value.startsWith('--origin=')) || !originArg) {
  console.error('Usage: node scripts/prepare-self-hosted.mjs --origin=https://campus.your-domain.edu');process.exit(1);
}
let origin;
try {
  const parsed=new URL(originArg.slice('--origin='.length));
  if(parsed.protocol!=='https:' || parsed.username || parsed.password || parsed.pathname!=='/' || parsed.search || parsed.hash || !/^[a-z0-9.-]+$/i.test(parsed.hostname) || parsed.port || ['localhost','127.0.0.1'].includes(parsed.hostname))throw new Error();
  origin=parsed.origin;
}catch{console.error('Supply the exact public HTTPS origin with a DNS hostname and no path or custom port.');process.exit(1);}
const targets=['.private/campus.env','.private/academic.env','.private/mongo.env','.env.production'];
if(targets.some(file=>existsSync(path.join(root,file)))) {
  console.error('Existing configuration found. Nothing was changed. Preserve its keys and follow docs/storage.md to migrate manually.');process.exit(1);
}
const hex=()=>randomBytes(32).toString('hex'),bridge=hex(),rootPassword=hex(),campusPassword=hex(),academicPassword=hex();
const campus={NODE_ENV:'production',CAMPUS_HOST:'0.0.0.0',CAMPUS_PORT:'4100',CAMPUS_COOKIE_SECURE:'true',CAMPUS_ORIGINS:origin,CAMPUS_LINK_KEY:hex(),CAMPUS_SERVICE_KEY:bridge,CAMPUS_BRIDGE_ENABLED:'true',ACADEMIC_API_URL:'http://academic:8000/api/v1',MONGODB_URI:`mongodb://campus:${campusPassword}@mongo:27017/unieve_campus_v1?authSource=unieve_campus_v1`,CAMPUS_MEDIA_DIR:'/app/media',CAMPUS_RATE_LIMIT_STORE:'mongo',CAMPUS_TRUST_PROXY:'172.29.240.2/32',CAMPUS_MAIL_FROM:'',SMTP_HOST:'',SMTP_PORT:'587',SMTP_REQUIRE_TLS:'true',SMTP_USER:'',SMTP_PASS:''};
const academic={MONGO_URI:`mongodb://academic:${academicPassword}@mongo:27017/unieve_campus_attendance_v1?authSource=unieve_campus_attendance_v1`,MONGO_DB_NAME:'unieve_campus_attendance_v1',CAMPUS_SERVICE_KEY:bridge,JWT_SECRET:hex()+hex(),PORTAL_CREDENTIAL_ENCRYPTION_KEY:randomBytes(32).toString('base64url')+'=',DEFAULT_ADMIN_EMAIL:'local-admin@example.invalid',DEFAULT_ADMIN_NAME:'Academic service administrator',DEFAULT_ADMIN_PASSWORD:hex(),COLLEGE_ADAPTER_MODE:'portal',SYNC_ENABLED:'false',SMS_ENABLED:'false',EMAIL_ENABLED:'false',CORS_ORIGINS:'[]'};
const mongo={MONGO_INITDB_ROOT_USERNAME:'operator',MONGO_INITDB_ROOT_PASSWORD:rootPassword,MONGO_CAMPUS_USER:'campus',MONGO_CAMPUS_PASSWORD:campusPassword,MONGO_ACADEMIC_USER:'academic',MONGO_ACADEMIC_PASSWORD:academicPassword};
const serialize=values=>Object.entries(values).map(([key,value])=>`${key}=${JSON.stringify(value)}`).join('\n')+'\n';
mkdirSync(path.join(root,'.private'),{recursive:true,mode:0o700});
const written=[];
try {
  for(const [file,values] of [[targets[0],campus],[targets[1],academic],[targets[2],mongo]]) {
    writeFileSync(path.join(root,file),serialize(values),{flag:'wx',mode:0o600});written.push(file);
  }
  writeFileSync(path.join(root,targets[3]),`CAMPUS_SERVER_NAME=${new URL(origin).hostname}\nCAMPUS_TLS_DIR=/absolute/path/to/tls\n`,{flag:'wx',mode:0o600});written.push(targets[3]);
}catch {
  // Remove only files created by this attempt; preserve any concurrent operator file.
  for(const file of written)unlinkSync(path.join(root,file));
  console.error('Configuration could not be created safely. No existing files were overwritten.');process.exit(1);
}
console.log('Created fresh private self-hosted configuration without printing secrets. Configure TLS, real email delivery, filesystem permissions and backups using docs/deployment.md.');
