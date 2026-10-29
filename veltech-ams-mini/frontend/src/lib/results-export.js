import {zipSync,strToU8} from 'fflate';
import {academicSemesterKey} from './academic-marks.js';
import {semesterStatementPdf} from './semester-statement.js';
import {resultAssessmentFields,resultReportGroups,publishedResultSummary,resultMetrics,hasResultMark} from './academic-results.js';

const columns={courseCode:'Course code',courseName:'Course name',semester:'Semester',resultType:'Result type',sourceReport:'Source report',examinationSession:'Examination session',grade:'Grade',credits:'Credits',gradePoints:'Grade points',status:'Result',gpa:'GPA',sgpa:'SGPA',cgpa:'CGPA',overallPercentage:'Overall percentage',...resultAssessmentFields,source:'Source'};
export function createResultsReport({rows=[],filters={},view='grades',summary=[],mode='connected',student={},generatedAt=new Date().toISOString()}){
 const selection={semester:String(filters.semester || 'all'),report:String(filters.report || 'all'),session:String(filters.session || 'all'),assessment:String(filters.assessment || 'all'),query:String(filters.query || '').trim()};
 if(selection.semester!=='all' && rows.some(row=>academicSemesterKey(row.semester)!==academicSemesterKey(selection.semester)))throw new Error('A record falls outside the selected semester.');
 const records=rows.map(row=>Object.fromEntries(Object.keys(columns).filter(key=>row[key]!==undefined && (!Object.hasOwn(resultAssessmentFields,key) || selection.assessment==='all' || key===selection.assessment)).map(key=>[key,row[key]])));
 const identity=Object.fromEntries(['name','registrationNumber','rollNumber','degree','department'].filter(key=>typeof student[key]==='string' && student[key].trim()).map(key=>[key,student[key].trim().slice(0,250)]));
 return {student:identity,sourceSummary:summary.map(row=>Object.fromEntries(['semester','label','value','sourceReport','examinationSession','cgpa','gpa','sgpa','totalGrade','totalGradePoints','totalCredits','totalCreditPoints','totalMarks','division','year'].filter(key=>row[key]!==undefined).map(key=>[key,row[key]]))),mode:mode==='demo'?'Fictional preview':'AMS source snapshot',view,generatedAt:String(generatedAt),filters:selection,recordCount:records.length,groups:resultReportGroups(records),summary:publishedResultSummary(summary),metrics:view==='grades'?resultMetrics(records):null,notes:'Source reports and examination attempts are retained separately. Official transcript remains authoritative. Overall CGPA and percentage appear only when explicitly published. No grade scale or percentage conversion is assumed.'};
}
const xml=value=>String(value ?? '').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g,'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&apos;');
const letters=index=>{let value=index+1,result='';while(value){result=String.fromCharCode(65+(value-1)%26)+result;value=Math.floor((value-1)/26);}return result;};
function worksheet(rows){
 return `<?xml version="1.0" encoding="UTF-8"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><cols><col min="1" max="20" width="24" customWidth="1"/></cols><sheetData>${rows.map((row,index)=>`<row r="${index+1}">${row.map((value,column)=>{const address=letters(column)+(index+1);return typeof value==='number' && Number.isFinite(value)?`<c r="${address}"><v>${value}</v></c>`:`<c r="${address}" t="inlineStr"><is><t xml:space="preserve">${xml(value)}</t></is></c>`;}).join('')}</row>`).join('')}</sheetData></worksheet>`;
}
const scope=report=>report.filters.semester==='all'?'All source semesters':`Semester ${report.filters.semester}`;
const metadata=report=>[['veltech ams mini | Academic results',report.mode],['Scope',scope(report)],['Category',report.view==='grades'?'Final results':'Assessment & internal'],['Generated (UTC)',report.generatedAt],['Source report filter',report.filters.report],['Examination session filter',report.filters.session],['Assessment filter',resultAssessmentFields[report.filters.assessment] || 'All assessment fields'],['Subject search',report.filters.query || 'All subjects'],['Selected records',report.recordCount],['Overall CGPA (source)',report.summary.cgpa ?? 'Not published'],['Overall percentage (source)',report.summary.percentage ?? 'Not published'],['Notes',report.notes]];
export function resultsXlsx(report){
 const sheets=[{name:'Selection summary',rows:metadata(report)}],names=new Set(['selection summary']);
 for(const group of report.groups){
  const base=`${group.semester || 'Unknown'} ${group.report}`.replace(/[\[\]:*?/\\]/g,' ').replace(/^'+|'+$/g,'').trim().slice(0,26) || 'Results';
  let name=base,index=2;while(names.has(name.toLowerCase()))name=`${base.slice(0,26)} ${index++}`;names.add(name.toLowerCase());
  const fields=Object.keys(columns).filter(field=>group.rows.some(row=>row[field]!==undefined));
  sheets.push({name,rows:[['Source report',group.sourceReport || group.report],['Semester',group.semester || 'Not provided'],['Examination session',group.session || 'Not provided'],[],fields.map(field=>columns[field]),...group.rows.map(row=>fields.map(field=>row[field]))]});
 }
 const files={
  '[Content_Types].xml':`<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>${sheets.map((_,i)=>`<Override PartName="/xl/worksheets/sheet${i+1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('')}</Types>`,
  '_rels/.rels':'<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>',
  'xl/workbook.xml':`<?xml version="1.0" encoding="UTF-8"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${sheets.map((sheet,i)=>`<sheet name="${xml(sheet.name)}" sheetId="${i+1}" r:id="rId${i+1}"/>`).join('')}</sheets></workbook>`,
  'xl/_rels/workbook.xml.rels':`<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${sheets.map((_,i)=>`<Relationship Id="rId${i+1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i+1}.xml"/>`).join('')}</Relationships>`,
 };
 sheets.forEach((sheet,index)=>{files[`xl/worksheets/sheet${index+1}.xml`]=worksheet(sheet.rows);});
 return zipSync(Object.fromEntries(Object.entries(files).map(([path,content])=>[path,strToU8(content)])),{level:6});
}
// Standard PDF fonts support Latin text. Every script is retained in Excel.
const latin=value=>String(value ?? '').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').replace(/[^\x20-\x7e]/g,'?');
const escape=value=>latin(value).replaceAll('\\','\\\\').replaceAll('(','\\(').replaceAll(')','\\)');
function wrap(value,width){const text=latin(value),lines=[];for(let index=0;index<text.length;index+=width)lines.push(text.slice(index,index+width));return lines.length?lines:[''];}
export function resultsPdf(report){
 if(report.view==='grades')return semesterStatementPdf(report);
 if(report.filters.semester==='all')throw new Error('Select a semester before downloading a PDF report.');
 const pages=[];let commands=[],position=0;
 const text=(value,x,y,size=10,bold=false,color='0.18 0.29 0.40')=>commands.push(`BT /${bold?'F2':'F1'} ${size} Tf ${color} rg ${x} ${y} Td (${escape(value)}) Tj ET`);
 const rectangle=(x,y,width,height,color)=>commands.push(`${color} rg ${x} ${y} ${width} ${height} re f`);
 const line=y=>commands.push(`0.87 0.91 0.95 RG 0.5 w 38 ${y} m 557 ${y} l S`);
 function page(){
  if(commands.length)pages.push(commands.join('\n'));commands=[];
  rectangle(0,754,595,88,'0.035 0.31 0.59');text('veltech',38,801,22,true,'1 1 1');text('AMS MINI | ACADEMIC RESULTS',38,777,10,false,'0.82 0.91 1');
  text(scope(report),370,802,15,true,'1 1 1');text(report.view==='grades'?'Final result report':'Assessment & internal',370,780,10,false,'0.82 0.91 1');
  text(report.mode,38,731,9);text(`Generated (UTC): ${report.generatedAt.slice(0,19).replace('T',' ')}`,285,731,8);
  text('Selected source records | Official transcript remains authoritative',38,708,9);
  position=684;
 }
 const space=height=>{if(position-height<72)page();};
 function paragraph(value,size=9,width=100){for(const part of wrap(value,width)){space(14);text(part,38,position,size);position-=14;}}
 function tableHeader(group,continued=false){
  space(75);rectangle(38,position-27,519,34,'0.94 0.97 0.99');text(`${group.report}${continued?' (continued)':''}`,47,position-5,11,true);position-=44;
  paragraph(`${group.sourceReport && group.sourceReport!==group.report?`${group.sourceReport} | `:''}${scope(report)}${group.session?` | ${group.session}`:''}`,8,107);
  text('COURSE / SUBJECT',44,position-3,8,true);
  if(report.view==='grades'){text('GRADE',344,position-3,8,true);text('CREDITS',410,position-3,8,true);text('POINTS',485,position-3,8,true);}else text('SOURCE ASSESSMENT MARKS',310,position-3,8,true);
  position-=15;line(position);position-=18;
 }
 page();
 paragraph(`Source report: ${report.filters.report} | Examination: ${report.filters.session}`);
 if(report.filters.query)paragraph(`Subject search: ${report.filters.query}`);
 if(report.filters.assessment!=='all')paragraph(`Assessment: ${resultAssessmentFields[report.filters.assessment] || report.filters.assessment}`);
 paragraph(`Selected records: ${report.recordCount} | Overall CGPA: ${report.summary.cgpa ?? 'Not published'} | Overall percentage: ${report.summary.percentage===null?'Not published':`${report.summary.percentage}%`}`);
 paragraph('CGPA and percentage are explicit source values. No conversion formula is assumed.',8);position-=10;
 for(const group of report.groups){
  tableHeader(group);
  for(const row of group.rows){
   const name=wrap(row.courseName || 'Course name not provided',report.view==='grades'?49:42),markFields=Object.entries(resultAssessmentFields).filter(([key])=>hasResultMark(row,key) && (report.filters.assessment==='all' || report.filters.assessment===key));
   const markLines=markFields.length?markFields.flatMap(([key,label])=>wrap(`${label}: ${row[key]}`,45)):['No source marks provided'];
   const rowHeight=Math.max(name.length+2,report.view==='grades'?3:markLines.length+1)*13+8;
   if(position-rowHeight<72){page();tableHeader(group,true);}
   text(row.courseCode || 'Code not provided',44,position,9,true);
   name.forEach((part,index)=>text(part,44,position-14-index*12,8));
   if(report.view==='grades'){text(row.grade ?? '-',350,position,11,true);text(row.credits ?? '-',425,position,10);text(row.gradePoints ?? '-',500,position,10);if(row.status)text(row.status,344,position-17,8);}else markLines.forEach((part,index)=>text(part,310,position-index*13,8));
   position-=rowHeight;line(position+8);
  }
  position-=8;
 }
 paragraph('PDF uses Latin text; Excel preserves names in every script.',8);paragraph(report.notes,8,111);
 if(commands.length)pages.push(commands.join('\n'));
 const objects=['','<< /Type /Catalog /Pages 2 0 R >>','','<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>','<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>'],pageIds=[];
 pages.forEach((content,index)=>{
  const pageId=objects.length,contentId=pageId+1;pageIds.push(pageId);
  content+=`\n0.87 0.91 0.95 RG 38 53 m 557 53 l S\nBT /F1 8 Tf 0.42 0.51 0.61 rg 38 36 Td (veltech ams mini | ${escape(scope(report))} | Page ${index+1} of ${pages.length}) Tj ET`;
  objects.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${contentId} 0 R >>`,`<< /Length ${content.length} >>\nstream\n${content}\nendstream`);
 });
 objects[2]=`<< /Type /Pages /Kids [${pageIds.map(id=>`${id} 0 R`).join(' ')}] /Count ${pages.length} >>`;
 let output='%PDF-1.4\n';const offsets=[0];for(let index=1;index<objects.length;index++){offsets.push(output.length);output+=`${index} 0 obj\n${objects[index]}\nendobj\n`;}
 const start=output.length;output+=`xref\n0 ${objects.length}\n0000000000 65535 f \n${offsets.slice(1).map(offset=>`${String(offset).padStart(10,'0')} 00000 n \n`).join('')}trailer\n<< /Size ${objects.length} /Root 1 0 R >>\nstartxref\n${start}\n%%EOF\n`;
 return new TextEncoder().encode(output);
}
