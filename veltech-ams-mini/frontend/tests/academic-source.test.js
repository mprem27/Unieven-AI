import test from 'node:test';
import assert from 'node:assert/strict';
import {academicDate,officialAmsUrl,safeAcademicUrl,sectionProvenance,visibleAcademicRows,academicFileUrl,academicModuleStatus,academicTime} from '../src/lib/academic-source.js';
test('official handoff permits only secure exact AMS origin, never lookalikes or credentials',()=>{
 assert.equal(officialAmsUrl('https://ams.veltech.edu.in/CourseRegistration.aspx'),'https://ams.veltech.edu.in/CourseRegistration.aspx');
 for(const value of ['javascript:alert(1)','https://ams.veltech.edu.in.evil.test/','https://user@ams.veltech.edu.in/','http://ams.veltech.edu.in/','https://ams.veltech.edu.in:444/'])assert.equal(officialAmsUrl(value),'');
 assert.equal(safeAcademicUrl('data:text/html,test'),'');
});
test('section provenance is independent for imports, AMS and missing results',()=>{
 const academic={source:'ams',updatedAt:'2026-10-14',courses:[{courseCode:'CS101'}],fees:[{amount:1250,source:'student-import',sourceUpdatedAt:'2026-10-15'}]};
 assert.equal(sectionProvenance(academic,'courses').source,'ams');
 assert.equal(sectionProvenance(academic,'fees').source,'student-import');
 assert.equal(sectionProvenance(academic,'results').source,'unavailable');
 assert.equal(sectionProvenance(academic,'results').status,'unavailable');
 assert.equal(sectionProvenance(academic,'fees','demo').source,'sample-preview');
});
test('unsupported discovered sections stay distinct from missing and available records',()=>{
 const academic={fees:[],sectionSources:{fees:{status:'unsupported',discovered:true,layoutSupported:false,recordCount:99,source:'unavailable'}}};
 const info=sectionProvenance(academic,'fees');assert.equal(info.status,'unsupported');assert.equal(info.recordCount,0);assert.equal(info.discovered,true);
});
test('source text dates survive ambiguous formatting without invented day/month interpretation',()=>{
 assert.equal(academicDate(null,'10/11/2026'),'10/11/2026');
 assert.equal(academicDate(null),'Not provided');
 assert.equal(academicDate('Source pending'),'Source pending');
 assert.match(academicDate('2026-10-15'),/15 Oct 2026/);
});
test('connected grades fees and documents display only AMS source rows; preview remains labeled samples',()=>{
 const academic={fees:[{name:'Import',source:'student-import'},{name:'AMS',source:'ams'},{name:'Unknown'}],courses:[{name:'Course'}]};
 assert.deepEqual(visibleAcademicRows(academic,'fees').map(row=>row.name),['AMS']);
 assert.equal(visibleAcademicRows(academic,'fees','demo').length,3);
 assert.equal(visibleAcademicRows(academic,'courses').length,1);
 assert.deepEqual(visibleAcademicRows(academic,'documents'),[]);
});
test('cached source downloads use only own authenticated API paths with valid IDs',()=>{
 const row={source:'ams',downloadId:'abcdef012345678901234567',url:'https://evil.example/file.pdf'};
 assert.equal(academicFileUrl(row),'/api/campus/academics/documents/abcdef012345678901234567');
 for(const value of [{...row,source:'student-import'},{...row,downloadId:'../other'},{url:row.url}])assert.equal(academicFileUrl(value),'');
 const status={id:'fees',state:'error',lastSuccessAt:'2026-10-15T10:00:00Z',retained:true};
 assert.deepEqual(academicModuleStatus({syncStatus:{modules:[status]}},'fees'),status);
 assert.equal(academicModuleStatus({},'fees'),null);
 assert.match(academicTime(status.lastSuccessAt),/15 Oct 2026/);assert.equal(academicTime(null),'Not yet synced');
});

test('credit summaries and grade definitions in connected views require AMS provenance',()=>{
 for(const key of ['creditSummary','gradeScale']){
  const rows=visibleAcademicRows({[key]:[{source:'student-import',value:'10'},{source:'ams',value:'8.5'}]},key,'connected');
  assert.deepEqual(rows,[{source:'ams',value:'8.5'}]);
 }
});
