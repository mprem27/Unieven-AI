import crypto from 'node:crypto';
export const hashToken = token => crypto.createHash('sha256').update(String(token)).digest('hex');
export const newToken = () => crypto.randomBytes(32).toString('hex');
export function checkWebhook(rawBody,signature,secret) {
  if (!Buffer.isBuffer(rawBody) || !secret || typeof signature!=='string' || !/^[a-f0-9]{64}$/i.test(signature)) return false;
  const expected=crypto.createHmac('sha256',secret).update(rawBody).digest();
  return crypto.timingSafeEqual(expected,Buffer.from(signature,'hex'));
}
function keyBuffer(key) {
  if (!/^[a-f0-9]{64}$/i.test(key || '')) throw new Error('CAMPUS_LINK_KEY must be a persistent 32-byte hex key');
  return Buffer.from(key,'hex');
}
export function encryptToken(token,key) {
  const iv=crypto.randomBytes(12),cipher=crypto.createCipheriv('aes-256-gcm',keyBuffer(key),iv);
  const body=Buffer.concat([cipher.update(token,'utf8'),cipher.final()]);
  return Buffer.concat([iv,cipher.getAuthTag(),body]).toString('base64');
}
export function decryptToken(sealed,key) {
  const bytes=Buffer.from(sealed,'base64');
  const cipher=crypto.createDecipheriv('aes-256-gcm',keyBuffer(key),bytes.subarray(0,12));
  cipher.setAuthTag(bytes.subarray(12,28));
  return Buffer.concat([cipher.update(bytes.subarray(28)),cipher.final()]).toString('utf8');
}
export function fail(status,message) { const error=new Error(message);error.status=status;throw error; }
export function httpUrl(value) {
  if (!value) return '';
  let parsed;try {parsed=new URL(value);} catch {fail(400,'Enter a valid URL');}
  if (!['http:','https:'].includes(parsed.protocol) || parsed.username || parsed.password) fail(400,'Use an HTTP or HTTPS URL');
  return parsed.toString();
}
export function validateId(value) { if (typeof value!=='string' || !/^[a-f0-9]{24}$/i.test(value)) fail(400,'Invalid record identifier');return value; }

// DocumentDB/FerretDB reports exclusion conflicts from findAndModify as an
// internal error rather than 11000. Match only that exact database error shape;
// callers retain their existing conflict/ownership handling.
export function duplicateKey(error){
 return error?.code===11000 || error?.name==='MongoServerError' && error.code===1 && /^conflicting key value violates exclusion constraint "documents_rum_index_[0-9]+"$/.test(error.message || '');
}
