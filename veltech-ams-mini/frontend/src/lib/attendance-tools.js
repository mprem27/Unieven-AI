import {zipSync,strToU8} from 'fflate';

const count=value=>((typeof value==='number' || (typeof value==='string' && value.trim()!=='')) && Number.isSafeInteger(Number(value)) && Number(value)>=0)?Number(value):null;
const targetNumber=value=>((typeof value==='number' || (typeof value==='string' && value.trim()!=='')) && Number.isFinite(Number(value)) && Number(value)>=0 && Number(value)<=100)?Number(value):null;
export function attendancePlan(presentValue,totalValue,targetValue=75) {
 const present=count(presentValue),total=count(totalValue),target=targetNumber(targetValue);
 if(present===null || total===null || target===null || present>total)return {valid:false};
 const percent=total?Math.round(present/total*1000)/10:null;
 let needed=0,canMiss=0;
 if(target===0)canMiss=Infinity;
 else if(total===0)needed=1;
 else if(present*100<total*target){
  needed=target===100?Infinity:Math.ceil((total*target-present*100)/(100-target));
  if(Number.isFinite(needed)){
   if((present+needed)*100<(total+needed)*target)needed++;
   if(needed>0 && (present+needed-1)*100>=(total+needed-1)*target)needed--;
  }
 }else{
  canMiss=Math.max(0,Math.floor((present*100-total*target)/target));
  if(present*100<(total+canMiss)*target)canMiss--;
  if(present*100>=(total+canMiss+1)*target)canMiss++;
 }
 return {valid:true,present,total,target,percent,needed,canMiss};
}
export function subjectAttendance(subject) {
 const plan=attendancePlan(subject.present,subject.total);
 return plan.valid?{valid:true,present:plan.present,total:plan.total,percent:plan.percent,other:plan.total-plan.present}:{valid:false,present:null,total:null,percent:null,other:null};
}
export const attendanceSubjectPath=subject=>`/attendance/subjects/${encodeURIComponent(subject.code || subject.id || '')}`;
export const findAttendanceSubject=(subjects,identifier)=>subjects.find(subject=>subject.code && subject.code===identifier) || subjects.find(subject=>String(subject.id)===identifier);
export function subjectRecords(records,subject) {
 return records.filter(record=>(subject.id!=null && record.subjectId!=null && String(record.subjectId)===String(subject.id)) || (subject.code && record.subjectCode && record.subjectCode===subject.code));
}
export function validAttendanceDate(value) {
 if(typeof value!=='string' || !/^\d{4}-\d{2}-\d{2}$/.test(value) || Number(value.slice(0,4))<1000)return false;
 const date=new Date(`${value}T12:00:00Z`);
 return Number.isFinite(date.getTime()) && date.toISOString().slice(0,10)===value;
}
export function recordMark(record,today) {
 if(validAttendanceDate(today) && validAttendanceDate(record.date) && record.date>today)return 'upcoming';
 const status=String(record.status || '').toLowerCase().trim().replaceAll('_','-');
 if(['p','present'].includes(status))return 'present';
 if(['a','absent'].includes(status))return 'absent';
 if(['od','on-duty','on duty'].includes(status))return 'on-duty';
 if(status==='upcoming')return 'upcoming';
 return 'unknown';
}
export const markLabel=mark=>({'present':'Present','absent':'Absent','on-duty':'On duty','unknown':'Unmarked','upcoming':'Upcoming'}[mark] || 'Unmarked');
export function attendancePeriod(record) {
 const period=record.period;
 if(period!=null && String(period).trim())return String(period);
 return record.startTime?`${record.startTime}${record.endTime?`–${record.endTime}`:''}`:'Data not available';
}
export function filterAttendanceRecords(records,filters={},today) {
 const query=String(filters.query || '').trim().toLowerCase();
 return records.filter(record=>{
  if(filters.date && record.date!==filters.date)return false;
  if((filters.from || filters.to) && !validAttendanceDate(record.date))return false;
  if(filters.from && record.date<filters.from)return false;
  if(filters.to && record.date>filters.to)return false;
  if(filters.status && filters.status!=='all' && recordMark(record,today)!==filters.status)return false;
  return !query || `${record.subjectName || ''} ${record.subjectCode || ''}`.toLowerCase().includes(query);
 }).toSorted((a,b)=>String(b.date || '').localeCompare(String(a.date || '')) || attendancePeriod(a).localeCompare(attendancePeriod(b),undefined,{numeric:true}));
}
export function shiftAttendanceMonth(month,delta) {
 if(!/^\d{4}-\d{2}$/.test(month) || !validAttendanceDate(`${month}-01`))return null;
 const date=new Date(`${month}-01T12:00:00Z`);date.setUTCMonth(date.getUTCMonth()+delta);
 const next=date.toISOString().slice(0,7);
 return /^\d{4}-\d{2}$/.test(next) && Number(next.slice(0,4))>=1000?next:null;
}
export function attendanceCalendar(month,records,today) {
 if(typeof month!=='string' || !validAttendanceDate(`${month}-01`))return null;
 const first=new Date(`${month}-01T12:00:00Z`),last=new Date(first);last.setUTCMonth(last.getUTCMonth()+1,0);
 const grouped=new Map();
 for(const record of records){if(validAttendanceDate(record.date) && record.date.startsWith(month)){if(!grouped.has(record.date))grouped.set(record.date,[]);grouped.get(record.date).push(record);}}
 const leading=(first.getUTCDay()+6)%7;
 return {month,leading,trailing:(7-(leading+last.getUTCDate())%7)%7,days:Array.from({length:last.getUTCDate()},(_,index)=>{
  const date=`${month}-${String(index+1).padStart(2,'0')}`,dayRecords=grouped.get(date) || [],counts={present:0,absent:0,'on-duty':0,unknown:0,upcoming:0};
  for(const record of dayRecords)counts[recordMark(record,today)]++;
  return {date,day:index+1,records:dayRecords.toSorted((a,b)=>attendancePeriod(a).localeCompare(attendancePeriod(b),undefined,{numeric:true})),counts};
 })};
}

// Keep the report schema explicit: profile and identity fields are never copied.
export function createAttendanceReport({subjects=[],records=[],mode='connected',target=75,today,scope='All attendance',generatedAt=new Date().toISOString()}) {
 return {mode:mode==='demo'?'Fictional demo':'Connected attendance snapshot',scope:String(scope),generatedAt:String(generatedAt),target:targetNumber(target),notes:'Summary totals are source aggregates. Other / unmarked is not an absence count. Daily records may cover only part of the summary. On duty is shown separately; no attendance credit is inferred.',subjects:subjects.map(subject=>{
  const summary=subjectAttendance(subject),plan=attendancePlan(subject.present,subject.total,target);
  return {code:String(subject.code || ''),name:String(subject.name || 'Subject'),present:summary.present,total:summary.total,other:summary.other,percent:summary.percent,needed:plan.valid?(plan.needed===Infinity?'Not reachable with finite classes':plan.needed):'Invalid counts',canMiss:plan.valid?(plan.canMiss===Infinity?'No minimum at 0%':plan.canMiss):'Invalid counts'};
 }),records:records.map(record=>({date:validAttendanceDate(record.date)?record.date:'Data not available',code:String(record.subjectCode || subjects.find(s=>s.id!=null && String(s.id)===String(record.subjectId))?.code || ''),name:String(record.subjectName || subjects.find(s=>s.id!=null && String(s.id)===String(record.subjectId))?.name || ''),period:attendancePeriod(record),status:markLabel(recordMark(record,today))}))};
}
const xml=value=>String(value ?? '').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g,'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&apos;');
function sheetXml(rows) {
 const letters=index=>{let value=index+1,result='';while(value){result=String.fromCharCode(65+(value-1)%26)+result;value=Math.floor((value-1)/26);}return result;};
 return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><cols><col min="1" max="10" width="23" customWidth="1"/></cols><sheetData>${rows.map((row,index)=>`<row r="${index+1}">${row.map((value,column)=>{const address=letters(column)+(index+1);return typeof value==='number' && Number.isFinite(value)?`<c r="${address}"><v>${value}</v></c>`:`<c r="${address}" t="inlineStr"><is><t xml:space="preserve">${xml(value)}</t></is></c>`;}).join('')}</row>`).join('')}</sheetData></worksheet>`;
}
export function attendanceXlsx(report) {
 const details=[['UniEve attendance export',report.mode],['Scope',report.scope],['Generated (UTC)',report.generatedAt],['Target (%)',report.target],['Notes',report.notes],[]];
 const summary=[...details,['Subject code','Subject','Attended','Total','Other / unmarked','Attendance (%)','Consecutive classes needed','Classes you can miss'],...report.subjects.map(s=>[s.code,s.name,s.present,s.total,s.other,s.percent,s.needed,s.canMiss])];
 const records=[...details,['Date','Subject code','Subject','Period / time','Source mark'],...report.records.map(r=>[r.date,r.code,r.name,r.period,r.status])];
 const files={
  '[Content_Types].xml':'<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/worksheets/sheet2.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>',
  '_rels/.rels':'<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>',
  'xl/workbook.xml':'<?xml version="1.0" encoding="UTF-8"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Attendance summary" sheetId="1" r:id="rId1"/><sheet name="Daily records" sheetId="2" r:id="rId2"/></sheets></workbook>',
  'xl/_rels/workbook.xml.rels':'<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet2.xml"/></Relationships>',
  'xl/worksheets/sheet1.xml':sheetXml(summary),'xl/worksheets/sheet2.xml':sheetXml(records),
 };
 return zipSync(Object.fromEntries(Object.entries(files).map(([path,content])=>[path,strToU8(content)])),{level:6});
}
const pdfText=value=>String(value ?? '').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').replace(/[^\x20-\x7e]/g,'?');
const escapePdf=value=>pdfText(value).replaceAll('\\','\\\\').replaceAll('(','\\(').replaceAll(')','\\)');
function wrapPdf(value,width=91) {
 const text=pdfText(value),lines=[];for(let offset=0;offset<text.length;offset+=width)lines.push(text.slice(offset,offset+width));return lines.length?lines:[''];
}
export function attendancePdf(report) {
 const lines=['UNIEVE | ATTENDANCE',report.mode,`Generated (UTC): ${report.generatedAt}`,`Scope: ${report.scope}`,`Planning target: ${report.target}%`,'',...wrapPdf(report.notes),'PDF uses Latin text; Excel preserves subject names in every script.','','SUBJECT SUMMARY'];
 for(const subject of report.subjects){
  lines.push(...wrapPdf(`${subject.code} | ${subject.name}`),`Attended ${subject.present ?? '?'} / ${subject.total ?? '?'} | ${subject.percent ?? '?'}% | Other / unmarked ${subject.other ?? '?'}`,...wrapPdf(`Consecutive classes needed: ${subject.needed} | Classes you can miss: ${subject.canMiss}`),'');
 }
 lines.push(`DAILY RECORDS (${report.records.length})`,'Date | Subject code | Period / time | Mark | Subject');
 for(const record of report.records)lines.push(...wrapPdf(`${record.date} | ${record.code} | ${record.period} | ${record.status} | ${record.name}`));
 if(!report.records.length)lines.push('No daily records in this export.');
 const pages=[];for(let index=0;index<lines.length;index+=45)pages.push(lines.slice(index,index+45));
 const objects=['','<< /Type /Catalog /Pages 2 0 R >>','', '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>'];
 const pageIds=[];
 pages.forEach((page,index)=>{
  const pageId=objects.length,contentId=pageId+1;pageIds.push(pageId);
  const content=`BT /F1 10 Tf 14 TL 40 797 Td ${page.map((line,i)=>`${i?'T* ':''}(${escapePdf(line)}) Tj`).join('\n')} ET\nBT /F1 9 Tf 40 28 Td (UniEve attendance | Page ${index+1} of ${pages.length}) Tj ET`;
  objects.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 3 0 R >> >> /Contents ${contentId} 0 R >>`,`<< /Length ${content.length} >>\nstream\n${content}\nendstream`);
 });
 objects[2]=`<< /Type /Pages /Kids [${pageIds.map(id=>`${id} 0 R`).join(' ')}] /Count ${pages.length} >>`;
 let output='%PDF-1.4\n';const offsets=[0];
 for(let index=1;index<objects.length;index++){offsets.push(output.length);output+=`${index} 0 obj\n${objects[index]}\nendobj\n`;}
 const start=output.length;output+=`xref\n0 ${objects.length}\n0000000000 65535 f \n${offsets.slice(1).map(offset=>`${String(offset).padStart(10,'0')} 00000 n \n`).join('')}trailer\n<< /Size ${objects.length} /Root 1 0 R >>\nstartxref\n${start}\n%%EOF\n`;
 return new TextEncoder().encode(output);
}
