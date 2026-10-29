import test from 'node:test';
import assert from 'node:assert/strict';
import {unzipSync,strFromU8} from 'fflate';
import {
 attendancePlan,subjectAttendance,attendanceSubjectPath,findAttendanceSubject,
 subjectRecords,filterAttendanceRecords,attendanceCalendar,attendancePeriod,shiftAttendanceMonth,
 createAttendanceReport,attendanceXlsx,attendancePdf,recordMark,
} from '../src/lib/attendance-tools.js';

test('planning returns the largest safe absence allowance and smallest recovery count',()=>{
 assert.deepEqual(attendancePlan(23,25,75),{valid:true,present:23,total:25,target:75,percent:92,needed:0,canMiss:5});
 const recovery=attendancePlan(7,10,75);assert.equal(recovery.needed,2);assert.equal(recovery.canMiss,0);
 for(let total=1;total<=60;total++)for(let present=0;present<=total;present++)for(const target of [1,50,66.7,75,80,99]){
  const plan=attendancePlan(present,total,target);
  if(present*100>=total*target){
   assert.ok(present*100>=(total+plan.canMiss)*target-1e-8);
   assert.ok(present*100<(total+plan.canMiss+1)*target);
  }else{
   assert.ok((present+plan.needed)*100>=(total+plan.needed)*target-1e-8);
   assert.ok((present+plan.needed-1)*100<(total+plan.needed-1)*target);
  }
 }
});
test('planning validates counts and handles empty totals and endpoint targets explicitly',()=>{
 for(const [present,total,target] of [['',10,75],[null,10,75],[true,10,75],[1.5,10,75],[2,1,75],[NaN,10,75],[1,Infinity,75],[1,10,''],[1,10,-1],[1,10,101]])assert.equal(attendancePlan(present,total,target).valid,false);
 assert.equal(attendancePlan('8','10','75').canMiss,0);
 assert.equal(attendancePlan(0,0,75).percent,null);assert.equal(attendancePlan(0,0,75).needed,1);
 assert.equal(attendancePlan(0,10,0).canMiss,Infinity);
 assert.equal(attendancePlan(9,10,100).needed,Infinity);
 assert.equal(attendancePlan(10,10,100).canMiss,0);
 assert.equal(attendancePlan(0,0,100).needed,1);
});
test('subject summary never invents absences or trusts rounded source percentages',()=>{
 const summary=subjectAttendance({present:2,total:3,percent:100});
 assert.equal(summary.percent,66.7);assert.equal(summary.other,1);assert.equal(summary.absent,undefined);
 assert.equal(subjectAttendance({present:'bad',total:3}).valid,false);
});
test('subject routes encode course identifiers and record matching never mixes different subjects',()=>{
 const course={id:'s1',code:'CS/A & B',name:'Networks'};
 assert.equal(attendanceSubjectPath(course),'/attendance/subjects/CS%2FA%20%26%20B');
 assert.equal(findAttendanceSubject([course],course.code),course);
 assert.equal(findAttendanceSubject([{id:'no-code'}],'no-code').id,'no-code');
 assert.deepEqual(subjectRecords([{subjectId:'s1'},{subjectCode:course.code},{subjectId:'s2'},{subjectName:'Networks'},{}],course),[{subjectId:'s1'},{subjectCode:course.code}]);
});
test('calendar preserves repeated periods, marks missing days as no records, and handles leap months',()=>{
 const records=[{date:'2028-02-29',period:'1',status:'present'},{date:'2028-02-29',period:'2',status:'absent'},{date:'2028-02-29',period:'3',status:'od'},{date:'2028-02-29',period:'4'},{date:'2028-02-30',status:'absent'}];
 const calendar=attendanceCalendar('2028-02',records,'2028-03-01');
 assert.equal(calendar.days.length,29);assert.equal(calendar.leading,1);
 assert.deepEqual(calendar.days.at(-1).counts,{present:1,absent:1,'on-duty':1,unknown:1,upcoming:0});
 assert.equal(calendar.days[0].records.length,0);
 assert.equal(shiftAttendanceMonth('2028-01',-1),'2027-12');
 assert.equal(shiftAttendanceMonth('2028-12',1),'2029-01');
 assert.equal(attendanceCalendar('nonsense',records,'2028-03-01'),null);
 assert.equal(recordMark({date:'2028-03-02',status:'absent'},'2028-03-01'),'upcoming');
});
test('record filters combine exact date, range, subject query and canonical status without mutation',()=>{
 const records=[{id:'p2',date:'2026-10-14',period:'2',subjectCode:'CS1',subjectName:'Networks',status:'a'},{id:'p1',date:'2026-10-14',period:'1',subjectCode:'CS1',subjectName:'Networks',status:'p'},{id:'other',date:'2026-10-13',subjectCode:'MA1',subjectName:'Maths',status:'present'}];
 assert.deepEqual(filterAttendanceRecords(records,{date:'2026-10-14',status:'absent',query:'cs1'},'2026-10-14').map(r=>r.id),['p2']);
 assert.equal(filterAttendanceRecords(records,{from:'2026-10-14',to:'2026-10-14'},'2026-10-14').length,2);
 assert.equal(filterAttendanceRecords(records,{from:'2026-10-15',to:'2026-10-13'},'2026-10-14').length,0);
 assert.deepEqual(records.map(r=>r.id),['p2','p1','other']);
});
test('report whitelists attendance fields and exported workbook is real OOXML with safe text cells',()=>{
 const report=createAttendanceReport({mode:'demo',subjects:[{id:'x',code:'=CMD()',name:'<Networks> & 日本語',present:8,total:10,phone:'DO-NOT-EXPORT'}],records:[{subjectCode:'=CMD()',subjectName:'<Networks> & 日本語',date:'2026-10-14',period:'1',status:'present',studentId:'PRIVATE-IDENTITY'}],target:75,today:'2026-10-14',scope:'All attendance',generatedAt:'2026-10-15T10:00:00Z',profile:{name:'OFFICIAL-NAME'}});
 assert.doesNotMatch(JSON.stringify(report),/DO-NOT-EXPORT|PRIVATE-IDENTITY|OFFICIAL-NAME/);
 const bytes=attendanceXlsx(report);assert.equal(bytes[0],0x50);assert.equal(bytes[1],0x4b);
 const files=unzipSync(bytes);
 for(const name of ['[Content_Types].xml','_rels/.rels','xl/workbook.xml','xl/_rels/workbook.xml.rels','xl/worksheets/sheet1.xml','xl/worksheets/sheet2.xml'])assert.ok(files[name],name);
 const sheets=strFromU8(files['xl/worksheets/sheet1.xml'])+strFromU8(files['xl/worksheets/sheet2.xml']);
 assert.match(sheets,/&lt;Networks&gt; &amp; 日本語/);assert.match(sheets,/Fictional demo/);assert.match(sheets,/t="inlineStr"/);assert.doesNotMatch(sheets,/<f[ >]/);assert.match(sheets,/=CMD\(\)/);
});
test('PDF has valid byte offsets, paginates all attendance records, and escapes PDF text',()=>{
 const report=createAttendanceReport({mode:'connected',subjects:[{code:'CS(1)',name:'Network \\ Tools',present:8,total:10}],records:Array.from({length:160},(_,i)=>({date:'2026-10-14',period:String(i+1),subjectCode:'CS(1)',status:'present'})),target:75,today:'2026-10-14',generatedAt:'2026-10-15T10:00:00Z'});
 const bytes=attendancePdf(report),pdf=new TextDecoder().decode(bytes);
 assert.ok(pdf.startsWith('%PDF-1.4'));assert.ok(pdf.endsWith('%%EOF\n'));
 assert.match(pdf,/CS\\\(1\\\)/);assert.match(pdf,/160/);
 const start=Number(pdf.match(/startxref\n(\d+)/)[1]);assert.equal(pdf.slice(start,start+4),'xref');
 const xref=pdf.slice(start).split('\n');const count=Number(xref[1].split(' ')[1]);
 for(let i=1;i<count;i++){const offset=Number(xref[i+2].slice(0,10));assert.ok(pdf.slice(offset).startsWith(`${i} 0 obj`));}
 assert.ok((pdf.match(/\/Type \/Page\b/g)||[]).length>1);
});

test('month cells preserve source periods in order, with complete weeks and no inferred marks',()=>{
 const records=[{id:'two',date:'2026-10-14',period:'2',status:'present'},{id:'ten',date:'2026-10-14',period:'10',status:'absent'},{id:'one',date:'2026-10-14',period:'1',status:'od'},{id:'repeat',date:'2026-10-14',period:'2'},{id:'invalid',date:'2026-10-32',status:'absent'}];
 const month=attendanceCalendar('2026-10',records,'2026-10-15'),day=month.days[13];
 assert.deepEqual(day.records.map(record=>record.id),['one','two','repeat','ten']);
 assert.deepEqual(day.counts,{present:1,absent:1,'on-duty':1,unknown:1,upcoming:0});
 assert.equal((month.leading+month.days.length+month.trailing)%7,0);
 assert.deepEqual(month.days[0].counts,{present:0,absent:0,'on-duty':0,unknown:0,upcoming:0});
 assert.equal(month.days[0].records.length,0);
 assert.deepEqual(records.map(record=>record.id),['two','ten','one','repeat','invalid']);
 assert.equal(attendancePeriod({period:0,startTime:'09:00'}),'0');
 assert.equal(attendancePeriod({startTime:'09:00',endTime:'09:50'}),'09:00–09:50');
 assert.equal(attendancePeriod({}),'Data not available');
});
