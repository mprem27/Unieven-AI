export {statementStudent} from './statement-student.js';
import {universityJpegHex,universityJpegSize} from './university-mark.js';
import {timesWidths,timesBoldWidths} from './statement-fonts.js';

const college='VEL TECH RANGARAJAN DR. SAGUNTHALA R & D INSTITUTE OF SCIENCE AND TECHNOLOGY';
const scalar=value=>typeof value==='string'||typeof value==='number'?String(value).trim():'';
const semesterKey=value=>scalar(value).replace(/^(?:semester|sem)\s*[-:]?\s*/i,'').toUpperCase();
const semesters=['I','II','III','IV','V','VI','VII','VIII','IX','X','XI','XII'];
const semKey=value=>{const s=semesterKey(value);return semesters.includes(s)?String(semesters.indexOf(s)+1):s;};
const number=value=>value!==null && value!==undefined && String(value).trim()!=='' && /^\d+(?:\.\d+)?$/.test(String(value).trim())?Number(value):null;
const unique=values=>{const valid=[...new Set(values.filter(value=>value!==null && value!==undefined && value!==''))];return valid.length===1?valid[0]:'';};
export function statementSummary(group,summary=[]){
 const rows=group.rows,scoped=summary.filter(row=>semKey(row.semester)===semKey(group.semester) && (!row.examinationSession || row.examinationSession===group.session) && (!row.sourceReport || row.sourceReport===group.sourceReport || row.sourceReport===group.report));
 function published(field,pattern,numeric=true){
  const values=[...rows.map(row=>row[field]),...scoped.map(row=>row[field]),...scoped.filter(row=>pattern.test(scalar(row.label))).map(row=>row.value)];
  return unique(values.map(value=>numeric?number(value):scalar(value)));
 }
 const credits=rows.map(row=>number(row.credits)),points=rows.map(row=>row.gradePointSource==='calculation'?null:number(row.gradePoints));
 const complete=rows.length>0 && credits.every(value=>value!==null);
 const codeCounts=new Map();for(const row of rows)if(row.courseCode)codeCounts.set(row.courseCode,(codeCounts.get(row.courseCode)||0)+1);
 const unambiguous=[...codeCounts.values()].every(value=>value===1);
 const first=(published,fallback)=>published!==''?published:fallback;
 const sum=values=>Number(values.reduce((a,b)=>a+b,0).toFixed(4));
 return {semester:group.semester,cgpa:published('cgpa',/^(?:overall\s+)?(?:cgpa|cumulative grade point average)$/i),sgpa:unique([published('gpa',/^(?:s?gpa|semester grade point average)$/i),published('sgpa',/^(?:s?gpa|semester grade point average)$/i)]),
  totalGrade:published('totalGrade',/^total\s*grade$/i,false),totalGradePoints:published('totalGradePoints',/^total\s*grade\s*points?$/i),
  totalCredits:first(published('totalCredits',/^total\s*credits?$/i),(complete && unambiguous?sum(credits):'')),
  totalCreditPoints:first(published('totalCreditPoints',/^total\s*credit\s*points?$/i),(complete && unambiguous && points.every(value=>value!==null)?sum(credits.map((credit,i)=>credit*points[i])):'')),
  totalMarks:published('totalMarks',/^total\s*marks?$/i),division:published('division',/^division$/i,false),year:published('year',/^(?:examination\s*)?year$/i,false) || (scalar(group.session).match(/\b(?:19|20)\d{2}\b/)||[''])[0]};
}
const latin=value=>scalar(value).normalize('NFKD').replace(/[\u0300-\u036f]/g,'').replace(/[^\x20-\x7e]/g,'?');
const escaped=value=>latin(value).replaceAll('\\','\\\\').replaceAll('(','\\(').replaceAll(')','\\)');
const width=(value,size,bold=false)=>[...latin(value)].reduce((sum,char)=>sum+(bold?timesBoldWidths:timesWidths)[char.charCodeAt(0)-32],0)*size/1000;
function lines(value,maxWidth,size,bold=false){
 const result=[];let line='';
 for(const char of latin(value).slice(0,1200)){
  if(line && width(line+char,size,bold)>maxWidth){const split=line.lastIndexOf(' ');if(split>line.length/2){result.push(line.slice(0,split));line=line.slice(split+1)+char;}else{result.push(line);line=char;}}
  else line+=char;
 }
 result.push(line);return result;
}
const printable=value=>typeof value==='number'?Number.isInteger(value)?String(value):value.toFixed(2):scalar(value);
export function semesterStatementPdf(report){
 if(report.filters.semester==='all')throw new Error('Select a semester before downloading a PDF report.');
 const pages=[];let commands=[],y=0;
 const blue='0.075 0.22 0.37',ink='0.06 0.09 0.13',grid='0.70 0.74 0.79',fill='0.94 0.96 0.98';
 function text(value,x,baseline,size=9,bold=false,color=ink,align='left'){
  const offset=align==='center'?width(value,size,bold)/2:align==='right'?width(value,size,bold):0;
  commands.push(`BT /${bold?'F2':'F1'} ${size} Tf ${color} rg ${(x-offset).toFixed(2)} ${baseline.toFixed(2)} Td (${escaped(value)}) Tj ET`);
 }
 function paragraph(value,x,baseline,maxWidth,size=9,bold=false){const parts=lines(value,maxWidth,size,bold);parts.forEach((part,i)=>text(part,x,baseline-i*(size+3),size,bold));return parts.length*(size+3);}
 function rect(x,top,w,h,color){commands.push(`${color} rg ${x} ${top-h} ${w} ${h} re f`);}
 function rule(x1,y1,x2,y2){commands.push(`${grid} RG 0.45 w ${x1} ${y1} m ${x2} ${y2} l S`);}
 function header(continued=false){
  if(commands.length)pages.push(commands.join('\n'));commands=[];
  const titleLines=['Vel Tech Rangarajan Dr. Sagunthala R & D Institute of Science &','Technology, Chennai'];
  titleLines.forEach((value,i)=>text(value,297.5,816-i*15,13,false,blue,'center'));
  text('(Deemed to be University)',297.5,780,11,false,blue,'center');
  commands.push('q 58 0 0 22.77 26 739 cm /CollegeMark Do Q');
  const student=report.student || {},programme=[student.degree,student.department?`(${student.department})`:''].filter(Boolean).join(' ').toUpperCase();
  const programmeLines=lines(programme || 'PROGRAMME NOT PROVIDED BY SOURCE',445,9);
  programmeLines.forEach((value,i)=>text(value,330,759-i*12,9,false,ink,'center'));
  const titleY=759-programmeLines.length*12-6;
  text('Statement of Marks/Grade',297.5,titleY,11,false,blue,'center');
  const roman=semesters[Number(semKey(report.filters.semester))-1] || report.filters.semester;
  text(`${roman} SEMESTER`,297.5,titleY-18,10,false,blue,'center');
  const sessions=[...new Set(report.groups.map(group=>group.session).filter(Boolean))];
  text(sessions.length===1?`${sessions[0]} Examination`:sessions.length>1?'Source examination sessions shown below':'Examination session not provided',297.5,titleY-36,10,false,ink,'center');
  const regY=titleY-61;
  text('Reg No.',24,regY,9,true);const regHeight=paragraph(student.registrationNumber || '',100,regY,471,9);
  const nameY=regY-Math.max(19,regHeight+5);
  text('Name',24,nameY,9,true);const nameHeight=paragraph(student.name || '',100,nameY,205,9);
  text('Roll No.',320,nameY,9,true);const rollHeight=paragraph(student.rollNumber || '',388,nameY,183,9);
  const collegeY=Math.min(nameY-35,nameY-Math.max(nameHeight,rollHeight)-14);
  text('College/Department Name',24,collegeY,9,true);const collegeHeight=paragraph(student.department?`${college} / ${student.department}`:college,210,collegeY,361,9);
  y=collegeY-collegeHeight-16;
  if(continued){text('Statement continued',26,y,8,false,blue);y-=17;}
  const selection=[report.filters.query?`Subject: ${report.filters.query}`:'',report.filters.report!=='all'?`Report: ${report.filters.report}`:'',report.filters.session!=='all'?`Examination: ${report.filters.session}`:''].filter(Boolean);
  if(selection.length){y-=paragraph(`Filtered selection | ${selection.join(' | ')}`,26,y,543,8)+7;}
 }
 const subjectEdges=[24,52,146,355,414,487,571];
 function tableHead(group,continued=false){
  if(y<180)header(true);
  y-=paragraph(`${group.report}${group.sourceReport && group.sourceReport!==group.report?` | ${group.sourceReport}`:''}${group.session?` | ${group.session}`:''}${continued?' (continued)':''}`,24,y,547,8,true)+7;
  const titles=['S.No.','Sub Code / Course ID','Subject/Papers','Grade','Grade Points','Credit'];
  drawRow(titles,subjectEdges,34,true,8); 
 }
 function drawRow(values,edges,height,heading=false,size=9){
  if(heading)rect(edges[0],y,edges.at(-1)-edges[0],height,fill);
  for(const x of edges)rule(x,y,x,y-height);rule(edges[0],y,edges.at(-1),y);rule(edges[0],y-height,edges.at(-1),y-height);
  values.forEach((value,i)=>{
   const parts=lines(printable(value),edges[i+1]-edges[i]-8,size,heading),left=i===2 && !heading;
   const firstBaseline=y-(height-parts.length*(size+2))/2-size*.9;
   parts.forEach((part,j)=>text(part,left?edges[i]+4:(edges[i]+edges[i+1])/2,firstBaseline-j*(size+2),size,heading,heading?blue:ink,left?'left':'center'));
  });
  y-=height;
 }
 function summary(group){
  if(y<166)header(true);
  y=Math.min(y-32,190);
  text('Semester summary',24,y+12,8,true,blue);
  const summary=statementSummary(group,report.sourceSummary),edges=[24,54,98,142,197,267,317,390,451,512,571];
  const titles=['Sem','CGPA','SGPA','Total Grade','Total Grade Points','Total Credit','Total Credit Points','Total Marks','Division','Year'];
  drawRow(titles,edges,34,true,7);
  drawRow(['semester','cgpa','sgpa','totalGrade','totalGradePoints','totalCredits','totalCreditPoints','totalMarks','division','year'].map(key=>summary[key]),edges,23,false,8);
  y-=15;paragraph('Credit totals use the listed source courses. GPA/CGPA and other summary fields are shown only when published for this semester.',24,y,547,7);y-=27;
 }
 header();
 for(let groupIndex=0;groupIndex<report.groups.length;groupIndex++){
  const group=report.groups[groupIndex];if(groupIndex)header();tableHead(group);
  group.rows.forEach((row,index)=>{
   const values=[index+1,row.courseCode || '',row.courseName || '',row.grade ?? '',row.gradePointSource==='calculation'?'':row.gradePoints ?? '',row.credits ?? ''];
   const height=Math.max(18,...values.map((value,i)=>lines(printable(value),subjectEdges[i+1]-subjectEdges[i]-8,9).length*11+7));
   if(y-height<90){header(true);tableHead(group,true);}
   drawRow(values,subjectEdges,height);
  });
  const total=statementSummary(group,report.sourceSummary);drawRow(['','','TOTAL','','',total.totalCredits],subjectEdges,20);
  summary(group);
 }
 if(!report.groups.length){text('No source records in this selection.',24,y,10);}
 if(commands.length)pages.push(commands.join('\n'));
 const objects=['','<< /Type /Catalog /Pages 2 0 R >>','','<< /Type /Font /Subtype /Type1 /BaseFont /Times-Roman >>','<< /Type /Font /Subtype /Type1 /BaseFont /Times-Bold >>',`<< /Type /XObject /Subtype /Image /Width ${universityJpegSize.width} /Height ${universityJpegSize.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter [/ASCIIHexDecode /DCTDecode] /Length ${universityJpegHex.length} >>\nstream\n${universityJpegHex}\nendstream`],pageIds=[];
 pages.forEach((content,index)=>{
  content+=`\nBT /F1 7 Tf ${blue} rg 24 30 Td (Student-generated copy | ${escaped(report.mode)} | Semester ${escaped(report.filters.semester)} | Page ${index+1} of ${pages.length}) Tj ET`;
  const id=objects.length;pageIds.push(id);objects.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> /XObject << /CollegeMark 5 0 R >> >> /Contents ${id+1} 0 R >>`,`<< /Length ${content.length} >>\nstream\n${content}\nendstream`);
 });
 objects[2]=`<< /Type /Pages /Kids [${pageIds.map(id=>`${id} 0 R`).join(' ')}] /Count ${pages.length} >>`;
 let output='%PDF-1.4\n';const offsets=[0];for(let id=1;id<objects.length;id++){offsets.push(output.length);output+=`${id} 0 obj\n${objects[id]}\nendobj\n`;}
 const start=output.length;output+=`xref\n0 ${objects.length}\n0000000000 65535 f \n${offsets.slice(1).map(offset=>`${String(offset).padStart(10,'0')} 00000 n \n`).join('')}trailer\n<< /Size ${objects.length} /Root 1 0 R >>\nstartxref\n${start}\n%%EOF\n`;
 return new TextEncoder().encode(output);
}
