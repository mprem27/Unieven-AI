import {baseDepartmentKey} from './publishing-directory.mjs';

const text=value=>typeof value==='string'?value.trim():'';
const blankDepartment=value=>value===undefined || typeof value==='string' && !value.trim();
const key=value=>text(value).normalize('NFKC').toLowerCase().replace(/[^a-z0-9]/g,'');
export const normalizeBatch=value=>text(value).replace(/[–—]/g,'-').replace(/\s/g,'');
export function normalizeProgramme(value){
 const valueKey=key(value),label=text(value).normalize('NFKC').toLowerCase();
 // AMS may append the department to a degree label. Recognize an explicit
 // degree prefix, while leaving dual/integrated or unrelated labels unknown.
 if(/\b(?:dual|integrated)\b|b[.\s]*tech.*m[.\s]*tech/.test(label))return valueKey;
 const prefixes=[[/^(?:b[.\s]*tech\b|bachelor\s+of\s+technology\b)/,'btech'],[/^(?:m[.\s]*tech\b|master\s+of\s+technology\b)/,'mtech'],[/^(?:b[.\s]*com\b|bachelor\s+of\s+commerce\b)/,'bcom'],[/^(?:b[.\s]*sc\b|bachelor\s+of\s+science\b)/,'bsc'],[/^(?:b[.\s]*b[.\s]*a\b|bachelor\s+of\s+business\s+administration\b)/,'bba']];
 const named=prefixes.find(([pattern])=>pattern.test(label));if(named)return named[1];
 return ({bacheloroftechnology:'btech',masteroftechnology:'mtech',bachelorofcommerce:'bcom',bachelorofscience:'bsc',bachelorofbusinessadministration:'bba'})[valueKey] || valueKey;
}
export function normalizeRegulation(value){
 const valueKey=key(value);
 return ({uge2025:'vtruge2025',uge2021:'vtruge2021',ugas2026:'vtrugas2026',btechregulations2013:'regulations2013',btech2013:'regulations2013'})[valueKey] || valueKey;
}
export const normalizeDepartment=value=>text(value)?baseDepartmentKey(value):'';
export function officialRegulationUrl(value){
 if(!text(value))return '';
 try{const url=new URL(value);return url.protocol==='https:' && ['veltech.edu.in','www.veltech.edu.in','ams.veltech.edu.in'].includes(url.hostname) && !url.username && !url.password && (!url.port || url.port==='443')?url.href:'';}catch{return '';}
}
const freeze=value=>{if(value && typeof value==='object'){Object.values(value).forEach(freeze);Object.freeze(value);}return value;};
const ug2025='https://veltech.edu.in/wp-content/uploads/2025/08/Regulations-VTR-UGE-2025-1_.pdf';
const ug2021='https://veltech.edu.in/wp-content/uploads/2025/08/B.Tech_._Regulations_VTR_UGE2021_JUNE-2025.pdf';
const ug2013='https://veltech.edu.in/wp-content/uploads/2025/08/A2_UG_Regulations2013.pdf';
const ugas2026='https://www.veltech.edu.in/wp-content/uploads/2026/09/VTR-UGAS-2026.pdf';
// Effective years describe the documents, never an inferred assignment to a student.
export const officialRegulations=freeze([
 {id:'btech-vtr-uge-2025',regulation:'VTR UGE 2025',programmeKeys:['btech'],programme:'B.Tech',departmentScope:'all',scope:'All engineering undergraduate programmes under VTR UGE 2025',effectiveAcademicYear:'2025-26',applicabilityClause:'§25.1.1(a)–(b), printed p1 / PDF p6',applicabilityQuote:'These regulations are applicable to all Engineering Degree Undergraduate level programmes ... with effect from the academic year 2025-26 and they are called VTR UGE - 2025.',sourceUrl:ug2025,sourceClause:'§25.23.3, printed p28 / PDF p33',sourceQuote:'Equivalent Percentage of marks = (CGPA * 10)',factor:10,offset:0,verifiedAt:'2026-10-29',gradeClause:'§25.22.1, Table 8, printed p27 / PDF p32',grades:{O:10,'A+':9,A:8,'B+':7,B:6,C:5,RA:0},nonCreditGrades:['P','F']},
 {id:'btech-vtr-uge-2021',regulation:'VTR UGE 2021',programmeKeys:['btech'],programme:'B.Tech',departmentScope:'all',scope:'Engineering undergraduate programmes under VTR UGE 2021; amended February 22, 2025',effectiveAcademicYear:'2021-22',applicabilityClause:'§1(a)–(b), printed p1 / PDF p6',applicabilityQuote:'Common for Engineering Degree Undergraduate level programmes (B.Tech.) ... with effect from the academic year 2021-22.',sourceUrl:ug2021,sourceClause:'§§6.6–6.7, printed pp6–7 / PDF pp11–12',sourceQuote:'The CGPA is the ratio of sum of product of credit and grade point earned by a student in various courses in all the semesters and total credits earned upto the current semester.',factor:null,offset:null,verifiedAt:'2026-10-29',gradeClause:'§6.5, Table 2, printed p6 / PDF p11',grades:{S:10,A:9,B:8,C:7,D:6,RA:0,AB:0}},
 {id:'btech-regulations-2013',regulation:'Regulations 2013',programmeKeys:['btech'],programme:'B.Tech',departmentScope:'all',scope:'B.Tech programmes governed by Regulations 2013; historical document',effectiveAcademicYear:null,applicabilityClause:'Cover, printed/PDF p1',applicabilityQuote:'Regulations 2013 for B.Tech Programmes; Printed in 2014.',sourceUrl:ug2013,sourceClause:'§16.2.3, printed/PDF p15',sourceQuote:'Example: CGPA of 6.75 on 10 point scale = 6.75/10*0.9*100=60.75%',factor:9,offset:0,verifiedAt:'2026-10-29',gradeClause:'§16.1.2, printed/PDF p15',grades:{S:10,A:9,B:8,C:7,D:6,RA:0}},
 {id:'ugas-vtr-ugas-2026',regulation:'VTR UGAS 2026',programmeKeys:['bba','bcom','bsc'],programme:'B.B.A. / B.Com. / B.Sc.',departmentScope:'all',scope:'Undergraduate B.B.A., B.Com., B.Sc. programmes under VTR UGAS 2026',effectiveAcademicYear:'2026-27',applicabilityClause:'§26.1.1(a), printed p1 / PDF p7',applicabilityQuote:'These regulations are applicable to Under Graduate programmes - B.B.A., B.Com, and B.Sc. ... with effect from the academic year 2026-27.',sourceUrl:ugas2026,sourceClause:'§26.20.3, printed p23 / PDF p29',sourceQuote:'Equivalent Percentage of marks = (CGPA * 10)',factor:10,offset:0,verifiedAt:'2026-10-29',grades:{}},
]);
export const projectPercentageRule=freeze({regulation:'Project estimate',factor:10,offset:.5,sourceUrl:'',sourceClause:'User-requested project formula; applicability is not university-verified.'});

function profileKeys(profile){
 const value=profile && typeof profile==='object' && !Array.isArray(profile)?profile:{};
 return {batch:normalizeBatch(value.batch),programme:normalizeProgramme(value.degree || value.programme),regulation:normalizeRegulation(value.regulation),department:normalizeDepartment(value.department || value.branch)};
}
function catalogueFor(profile){const p=profileKeys(profile);return p.programme && p.regulation?officialRegulations.find(rule=>rule.programmeKeys.includes(p.programme) && normalizeRegulation(rule.regulation)===p.regulation) || null:null;}
export function officialGradeScale(profile={}){
 const rule=catalogueFor(profile);return rule?Object.entries(rule.grades).map(([grade,points])=>({grade,points,regulation:rule.regulation,sourceUrl:rule.sourceUrl,sourceClause:rule.gradeClause,source:'official-regulation'})):[];
}
export function validPercentageFormula(rule){return typeof rule?.factor==='number' && Number.isFinite(rule.factor) && rule.factor>0 && rule.factor<=100 && typeof rule.offset==='number' && Number.isFinite(rule.offset) && Math.abs(rule.offset)<=10;}
export function legacyPercentagePolicy(rule){return rule && rule.scopeVersion===undefined && rule.departmentScope===undefined && blankDepartment(rule.department);}
function confirmed(rule){return typeof rule?.verifiedAt==='string' && !!rule.verifiedAt.trim() && Number.isFinite(Date.parse(rule.verifiedAt));}
function matchingPolicy(rule,p){
 if(!rule || typeof rule!=='object' || Array.isArray(rule) || !confirmed(rule))return false;
 if(!p.batch || !p.programme || normalizeBatch(rule.batch)!==p.batch || normalizeProgramme(rule.programme)!==p.programme)return false;
 const regulation=normalizeRegulation(rule.regulation);
 if(legacyPercentagePolicy(rule))return !p.regulation || !!regulation && regulation===p.regulation;
 // Narrow rules never match absent official profile keys.
 if(!p.regulation || !regulation || regulation!==p.regulation)return false;
 if(rule.departmentScope==='department')return !normalizeDepartment(rule.department) || !!p.department && normalizeDepartment(rule.department)===p.department;
 return true; // Includes malformed scope: reject it explicitly rather than falling back.
}
function validPolicy(rule){
 if(!validPercentageFormula(rule) || !officialRegulationUrl(rule.sourceUrl) || !text(rule.sourceClause) || !normalizeRegulation(rule.regulation))return false;
 if(legacyPercentagePolicy(rule))return true;
 return rule.scopeVersion===2 && (rule.departmentScope==='all' && blankDepartment(rule.department) || rule.departmentScope==='department' && !!normalizeDepartment(rule.department));
}
export function resolvePercentageRule(profile={},policies=[]){
 const p=profileKeys(profile),regulation=catalogueFor(profile);
 const result=(status,reason,rule=null,source='unavailable')=>({status,reason,rule,source,regulation});
 if(!Array.isArray(policies))return result('invalid','Academic policies could not be read safely.');
 const matches=policies.filter(rule=>matchingPolicy(rule,p));
 if(matches.some(rule=>!validPolicy(rule)))return result('invalid','A matching administrator rule has incomplete or invalid evidence. Ask an administrator to review it.');
 if(matches.length>1)return result('ambiguous','Multiple administrator rules apply. Percentage conversion is unavailable until their scopes are resolved.');
 const publicRule=regulation && validPercentageFormula(regulation)?regulation:null,admin=matches[0];
 if(admin && publicRule && (admin.factor!==publicRule.factor || admin.offset!==publicRule.offset))return result('ambiguous','The administrator rule conflicts with the documented regulation. Percentage conversion is unavailable pending review.');
 if(admin)return result('matched',legacyPercentagePolicy(admin)?'Administrator-confirmed legacy cohort rule; department scope was not recorded.':'Administrator-confirmed rule for this exact academic scope.',admin,legacyPercentagePolicy(admin)?'legacy-rule':'batch-rule');
 if(publicRule)return result('matched','Calculated using the documented programme and regulation.',publicRule,'official-rule');
 if(regulation)return result('unverified','Percentage conversion remains unverified in the inspected regulation.');
 return result('unknown',p.regulation?'No documented conversion matches the reported programme and regulation.':'Your official regulation is not available. A batch year does not establish its rules.');
}
export function academicRuleContext(profile={},options={}){return resolvePercentageRule(profile,options.policies ?? []);}
