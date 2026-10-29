import test from 'node:test';
import assert from 'node:assert/strict';
import {evaluateProductionConfig} from '../../../../scripts/production-check.mjs';
const key='0123456789abcdef'.repeat(4),secret='0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMN';
function fixture() {
  return {services:{
    campus:{environment:{NODE_ENV:'production',CAMPUS_COOKIE_SECURE:'true',CAMPUS_ORIGINS:'https://campus.college.edu',CAMPUS_LINK_KEY:key,CAMPUS_SERVICE_KEY:key,MONGODB_URI:'mongodb+srv://campus:secret@cluster.mongodb.net/unieve_campus_v1',CAMPUS_RATE_LIMIT_STORE:'mongo',CAMPUS_TRUST_PROXY:'172.29.240.2/32',ACADEMIC_API_URL:'http://academic:8000/api/v1',CAMPUS_MEDIA_DIR:'/app/media',CAMPUS_MAIL_FROM:'Campus <no-reply@college.edu>',SMTP_HOST:'smtp.college.edu',SMTP_PORT:'587',SMTP_REQUIRE_TLS:'true',SMTP_USER:'campus',SMTP_PASS:'private-password'},volumes:[{type:'volume',source:'campus-media',target:'/app/media'}]},
    academic:{environment:{CAMPUS_SERVICE_KEY:key,JWT_SECRET:secret,PORTAL_CREDENTIAL_ENCRYPTION_KEY:Buffer.from('0123456789abcdef'.repeat(2)).toString('base64url')+'=',WEB_CONCURRENCY:'1',MONGO_URI:'mongodb+srv://academic:secret@cluster.mongodb.net/unieve_campus_attendance_v1'},command:['python','-m','uvicorn','app.main:app','--workers','1']},
    proxy:{environment:{CAMPUS_SERVER_NAME:'campus.college.edu'},networks:{edge:{ipv4_address:'172.29.240.2'}},volumes:[{type:'bind',read_only:true,source:'/certs',target:'/etc/nginx/tls'}]},
  }};
}
test('production config checks accept a configured HTTPS/Atlas topology without exposing values',()=>{
  const config=fixture(),checks=evaluateProductionConfig(config);assert.ok(checks.every(value=>value.ok),JSON.stringify(checks.filter(value=>!value.ok)));assert.doesNotMatch(JSON.stringify(checks),/private-password|mongodb\+srv:\/\/|0123456789/);
});
test('unsafe public ports, wildcard trust, independent limits, SMTP and origins are rejected',()=>{
  const config=fixture();Object.assign(config.services.campus.environment,{CAMPUS_ORIGINS:'http://campus.college.edu',CAMPUS_TRUST_PROXY:'true',CAMPUS_RATE_LIMIT_STORE:'memory',SMTP_REQUIRE_TLS:'false'});config.services.academic.ports=[{target:8000,published:'8000'}];
  const failures=evaluateProductionConfig(config).filter(value=>!value.ok);assert.equal(failures.length,6);
});
test('MongoDB TLS bypass and extra academic workers are rejected',()=>{
  const config=fixture();config.services.campus.environment.MONGODB_URI+='?tlsAllowInvalidCertificates=true';config.services.academic.command=['uvicorn','app.main:app','--workers','2'];
  assert.equal(evaluateProductionConfig(config).filter(value=>!value.ok).length,2);
});
test('self-hosted database must be private, authenticated and persistent with distinct credentials',()=>{
  const config=fixture();config.services.mongo={environment:{MONGO_INITDB_ROOT_PASSWORD:secret+'root',MONGO_CAMPUS_PASSWORD:secret+'campus',MONGO_ACADEMIC_PASSWORD:secret+'academic'},volumes:[{type:'volume',target:'/data/db'}]};
  config.services.campus.environment.MONGODB_URI='mongodb://campus:secret@mongo:27017/unieve_campus_v1';config.services.academic.environment.MONGO_URI='mongodb://academic:secret@mongo:27017/unieve_campus_attendance_v1';
  assert.ok(evaluateProductionConfig(config).every(value=>value.ok));
  config.services.mongo.ports=[{target:27017,published:'27017'}];assert.ok(evaluateProductionConfig(config).some(value=>!value.ok && value.message.startsWith('Both database')));
});
test('production email checks reject invalid ports, broken credentials and unsafe mail headers',()=>{
 for(const changed of [{SMTP_PORT:'bad'},{SMTP_USER:'',SMTP_PASS:'private-password'},{SMTP_PORT:'587',SMTP_SECURE:'true'},{CAMPUS_MAIL_FROM:'Campus <sender@college.edu>\r\nBcc: other@college.edu'},{CAMPUS_PUBLIC_URL:'http://campus.college.edu'}]){
  const config=fixture();Object.assign(config.services.campus.environment,changed);
  assert.ok(evaluateProductionConfig(config).some(value=>!value.ok && value.message.startsWith('Real email delivery')),Object.keys(changed).join(','));
 }
});

test('PostgreSQL production topology requires private gateway, paired credentials and durable storage',()=>{
 const config=fixture();config.networks={private:{internal:true}};
 config.services.postgres={environment:{POSTGRES_USER:'campus',POSTGRES_PASSWORD:secret},networks:{private:{}},volumes:[{type:'volume',target:'/var/lib/postgresql/data'}]};
 config.services.ferretdb={environment:{FERRETDB_POSTGRESQL_URL:'postgres://campus:'+secret+'@postgres:5432/postgres'},networks:{private:{}}};
 for(const service of ['campus','academic'])config.services[service].environment[service==='campus'?'MONGODB_URI':'MONGO_URI']='mongodb://campus:'+secret+'@ferretdb:27017/campus?authSource=postgres';
 assert.ok(evaluateProductionConfig(config).every(c=>c.ok));config.services.postgres.ports=[{published:'5432',target:5432}];assert.ok(evaluateProductionConfig(config).some(c=>!c.ok));
 delete config.services.postgres.ports;config.services.ferretdb.environment.FERRETDB_POSTGRESQL_URL='postgres://campus:wrong@postgres:5432/postgres';assert.ok(evaluateProductionConfig(config).some(c=>!c.ok));
});
