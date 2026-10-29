import {prepareResults,overallResultOverview} from './academic-results.js';
import {calculationScale} from './result-calculation.js';
import {officialStudentProfile} from './social-profile.js';
import {batchPercentage} from './batch-percentage.js';
import {academicNumber} from './gpa.js';
import {academicRuleContext,officialGradeScale} from '../../../shared/percentage-rules.mjs';

// All academic entry points consume the same source-first summary. The caller's
// detail filters never affect an overall value, and editable profile fields do
// not select a connected student's regulation.
export function academicSummary({results=[],credits=[],gradeScale=[],creditSummary=[],mode='connected',studentProfile={},rules=[],policyStatus='available',calculation={scheme:'sab',percentageFactor:10}}={}){
 const official=officialStudentProfile(studentProfile,mode),sourceCredits=mode==='connected'?credits.filter(row=>row.source==='ams'):credits;
 const missingProgramme=mode==='connected' && !!official.regulation && !(official.degree || official.programme);
 const sourceLetters=new Set(gradeScale.map(row=>String(row.grade || '').trim().toUpperCase()));
 const nonCreditGrades=new Set(academicRuleContext(official).regulation?.nonCreditGrades || []);
 const verifiedScale=officialGradeScale(official).filter(row=>!sourceLetters.has(String(row.grade).trim().toUpperCase()));
 const sourcePrepared=prepareResults(results,sourceCredits,gradeScale);
 const prepared=prepareResults(results,sourceCredits,[...gradeScale,...verifiedScale],(missingProgramme?[]:calculationScale(calculation)).filter(row=>!nonCreditGrades.has(String(row.grade).trim().toUpperCase()) && !sourceLetters.has(String(row.grade).trim().toUpperCase()) && !verifiedScale.some(official=>official.grade===row.grade)));
 const officialLetters=new Set(verifiedScale.map(row=>String(row.grade).trim().toUpperCase()));
 // Preserve the provenance of a documented conversion even when its numeric
 // value happens to equal the selected project scale.
 prepared.grades=prepared.grades.map((row,index)=>row.gradePointSource!=='calculation' && officialLetters.has(String(row.grade).trim().toUpperCase()) && sourcePrepared.grades[index]?.gradePoints===undefined && row.gradePoints!==undefined?{...row,gradePointSource:'official-regulation'}:row);
 prepared.grades=prepared.grades.map(row=>nonCreditGrades.has(String(row.grade).trim().toUpperCase()) && academicNumber(row.credits)>0?{...row,creditClassificationConflict:true}:row);
 const contextIncomplete=missingProgramme && prepared.grades.some(row=>academicNumber(row.gradePoints)===null);
 const creditConflict=prepared.grades.some(row=>row.creditClassificationConflict);
 const overall=overallResultOverview([...prepared.grades,...prepared.publishedRows],creditSummary,{percentageFactor:null});
 const percentage=mode==='connected' && policyStatus!=='available' && overall.percentageSource!=='published'?{value:null,source:'unavailable',rule:null,status:policyStatus==='loading'?'policy-pending':'policy-unavailable',reason:policyStatus==='loading'?'Checking conversion rules…':'Conversion rules could not be checked. Connect to verify your percentage.'}:batchPercentage(overall,official,rules),estimatedPoints=prepared.grades.some(row=>row.gradePointSource==='calculation');
 return {prepared,sourcePrepared,overall,percentage,official,estimatedPoints,creditConflict,contextIncomplete};
}
