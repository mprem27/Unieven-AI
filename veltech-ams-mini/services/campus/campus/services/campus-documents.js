import path from 'node:path';
import {inflateRawSync} from 'node:zlib';
import {hasAdminAction} from '../../../../shared/admin-access.mjs';
import {campusRole} from '../policy.js';
import {fail} from '../security.js';
import {departmentQuery} from '../../../../shared/publishing-directory.mjs';
import {departmentKey,courseKey,matchesPublicationAudience} from './exam-audience.js';
export const DOCUMENT_MAX_BYTES=8*1024*1024;
const limits={title:180,category:80,reference:120,date:10,scope:20,department:120,semester:30,section:30,batch:40};
export function documentStaffScope(user,action='view'){
 if(!user || user.isActive===false)fail(403,'An active academic staff assignment is required.');
 if(campusRole(user)==='admin'){
  if(!hasAdminAction(user,action==='view'?'academics.read':'academics.write',action))fail(403,'This administrator is not assigned that academic action permission.');
  return {};
 }
 if(!(user.role==='faculty' || campusRole(user)==='department_coordinator') || !user.department?.trim())fail(403,'An assigned faculty member or department coordinator is required.');
 return {scope:'department',department:departmentQuery(user.department.trim()),...(campusRole(user)==='department_coordinator'?{}:{createdBy:user._id ?? user.id})};
}
export function documentInput(body,user){
 if(!body || typeof body!=='object' || Array.isArray(body) || Object.keys(body).some(k=>!Object.hasOwn(limits,k) && k!=='courseCodes'))fail(400,'Use the supported document metadata fields.');
 const out={};for(const [key,max] of Object.entries(limits)){const raw=body[key] ?? '';if(typeof raw!=='string' || raw.length>max || /[\x00-\x1f\x7f]/.test(raw))fail(400,`Enter a valid ${key}.`);out[key]=raw.trim();}
 if(!out.title || !out.category || !['college','department'].includes(out.scope))fail(400,'Enter a document title, category and audience.');
 if(out.date){const date=new Date(out.date+'T12:00:00Z');if(!/^\d{4}-\d{2}-\d{2}$/.test(out.date) || !Number.isFinite(+date) || date.toISOString().slice(0,10)!==out.date)fail(400,'Enter a valid document date (YYYY-MM-DD).');}
 if(out.scope==='department' && !out.department || out.scope==='college' && out.department)fail(400,'Choose a department only for a department audience.');
 if(['semester','section','batch','department'].some(k=>out[k].includes('*')))fail(400,'Use an exact audience value or leave the optional restriction blank.');
 const codes=body.courseCodes ?? [];if(!Array.isArray(codes) || codes.length>40 || codes.some(v=>typeof v!=='string' || !/^[A-Za-z0-9][A-Za-z0-9._/-]{0,39}$/.test(v)))fail(400,'Enter up to 40 exact registered course codes.');out.courseCodes=[...new Set(codes.map(courseKey))];
 if(campusRole(user)!=='admin'){
  if(out.scope!=='department' || !user.department?.trim() || departmentKey(out.department)!==departmentKey(user.department))fail(403,'Publish only for your assigned academic department.');
  out.department=user.department.trim();
 }
 return out;
}
export function matchesDocumentAudience(row,audience){
 if(!matchesPublicationAudience(row,audience))return false;
 return !row.courseCodes?.length || !!audience?.verified && row.courseCodes.some(code=>audience.courseCodes?.includes(courseKey(code)));
}
function inspectXlsx(bytes){
 // Parse every central entry, bound expansion, then inspect local payloads. No
 // archive is extracted onto disk and member names never become filesystem paths.
 let end=-1;for(let i=bytes.length-22;i>=Math.max(0,bytes.length-65557);i--)if(bytes.readUInt32LE(i)===0x06054b50){end=i;break;}
 if(end<0 || bytes.readUInt16LE(end+4)!==0 || bytes.readUInt16LE(end+6)!==0)fail(400,'Choose a valid single-part XLSX workbook.');
 const count=bytes.readUInt16LE(end+10),size=bytes.readUInt32LE(end+12),start=bytes.readUInt32LE(end+16),names=new Set();
 if(!count || count>250 || bytes.readUInt16LE(end+8)!==count || start+size!==end || end+22+bytes.readUInt16LE(end+20)!==bytes.length)fail(400,'This workbook archive is invalid or too complex.');
 let at=start,total=0;for(let index=0;index<count;index++){
  if(at+46>end || bytes.readUInt32LE(at)!==0x02014b50)fail(400,'Invalid workbook directory.');
  const flags=bytes.readUInt16LE(at+8),method=bytes.readUInt16LE(at+10),compressed=bytes.readUInt32LE(at+20),expanded=bytes.readUInt32LE(at+24),nameLength=bytes.readUInt16LE(at+28),extra=bytes.readUInt16LE(at+30),comment=bytes.readUInt16LE(at+32),offset=bytes.readUInt32LE(at+42),next=at+46+nameLength+extra+comment;
  if(next>end)fail(400,'Invalid workbook member.');const name=bytes.toString('utf8',at+46,at+46+nameLength);
  if(flags&1 || ![0,8].includes(method) || !name || name.length>240 || /[\\\x00-\x1f]|^\/|^[A-Za-z]:|(?:^|\/)\.\.(?:\/|$)/.test(name) || names.has(name) || !/\.(?:xml|rels)$|\/$/.test(name) || /(?:vba|macros|externalLinks|embeddings|activeX)/i.test(name))fail(400,'Workbook contains unsafe or unsupported members.');
  names.add(name);total+=expanded;if(expanded>16*1024*1024 || total>32*1024*1024 || expanded>Math.max(1024*1024,compressed*100))fail(400,'Workbook expands beyond the document safety limit.');
  if(offset+30>start || bytes.readUInt32LE(offset)!==0x04034b50 || bytes.readUInt16LE(offset+8)!==method || bytes.readUInt16LE(offset+6)!==flags)fail(400,'Invalid workbook file header.');
  const localName=bytes.readUInt16LE(offset+26),payload=offset+30+localName+bytes.readUInt16LE(offset+28);if(bytes.toString('utf8',offset+30,offset+30+localName)!==name || payload+compressed>start)fail(400,'Invalid workbook file bounds.');
  let content;try{content=method===0?bytes.subarray(payload,payload+compressed):inflateRawSync(bytes.subarray(payload,payload+compressed),{maxOutputLength:16*1024*1024});}catch{fail(400,'Workbook member could not be read safely.');}
  if(content.length!==expanded || /<!DOCTYPE|<!ENTITY/i.test(content.toString('utf8')))fail(400,'Invalid or unsafe workbook XML.');at=next;
 }
 if(at!==end || !names.has('[Content_Types].xml') || !names.has('xl/workbook.xml') || ![...names].some(n=>/^xl\/worksheets\/[^/]+\.xml$/.test(n)))fail(400,'Choose an XLSX workbook with a worksheet.');
}
export function inspectDocument(bytes,filename){
 if(!Buffer.isBuffer(bytes) || !bytes.length)fail(400,'Choose a nonempty document.');if(bytes.length>DOCUMENT_MAX_BYTES)fail(413,'Documents are limited to 8 MB.');
 const name=path.basename(String(filename || '').replaceAll('\\','/')).replace(/[^A-Za-z0-9_. -]/g,'_').slice(0,180),ext=name.split('.').at(-1).toLowerCase();let mime;
 if(ext==='pdf' && bytes.subarray(0,5).toString()==='%PDF-' && bytes.subarray(-2048).includes(Buffer.from('%%EOF')))mime='application/pdf';
 else if(ext==='png' && bytes.length>=24 && bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])) && bytes.toString('ascii',12,16)==='IHDR' && bytes.readUInt32BE(16)>0 && bytes.readUInt32BE(20)>0)mime='image/png';
 else if(['jpg','jpeg'].includes(ext) && bytes[0]===255 && bytes[1]===216 && bytes[2]===255 && bytes.at(-2)===255 && bytes.at(-1)===217)mime='image/jpeg';
 else if(ext==='xlsx'){inspectXlsx(bytes);mime='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';}
 else if(ext==='csv'){
  let value;try{value=new TextDecoder('utf-8',{fatal:true}).decode(bytes);}catch{fail(400,'CSV documents must use UTF-8 text.');}
  if(/[\x00-\x08\x0b\x0c\x0e-\x1f]|<\s*(?:!doctype|html|script|svg|iframe|body)\b/i.test(value) || !/[,;\t]/.test(value) || value.split(/\r?\n/).some(line=>line.length>65536))fail(400,'Choose a plain CSV table. HTML and binary files are not supported.');mime='text/csv';
 }else fail(400,'Choose a PDF, XLSX, CSV, PNG or JPEG with matching file contents.');
 return {name,mime,size:bytes.length};
}
export function documentView(row){const id=String(row._id);return {id,...Object.fromEntries(Object.keys(limits).map(k=>[k,row[k] || ''])),courseCodes:row.courseCodes || [],source:'staff-published',publishedBy:row.createdByName || 'Academic staff',publishedAt:row.createdAt,updatedAt:row.updatedAt,file:{name:row.file.name,mime:row.file.mime,size:row.file.size,url:`/api/campus/academics/campus-documents/${id}/file`}};}
