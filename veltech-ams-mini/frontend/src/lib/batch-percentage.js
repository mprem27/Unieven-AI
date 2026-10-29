import {normalizeBatch,normalizeProgramme,resolvePercentageRule,projectPercentageRule} from '../../../shared/percentage-rules.mjs';
export {normalizeBatch,normalizeProgramme};
export function batchPercentage(overall={},profile={},policies=[]){
 if(overall?.percentageSource==='published' && typeof overall.percentage==='number' && Number.isFinite(overall.percentage) && overall.percentage>=0 && overall.percentage<=100)return {value:overall.percentage,source:'published',rule:null};
 const resolved=resolvePercentageRule(profile,policies),unavailable={value:null,source:'unavailable',rule:null,status:resolved.status,reason:resolved.reason};
 if(['ambiguous','invalid'].includes(resolved.status))return unavailable;
 const rule=resolved.rule || projectPercentageRule,cgpa=overall?.cgpa;
 if(typeof cgpa!=='number' || !Number.isFinite(cgpa) || cgpa<0 || cgpa>10)return {...unavailable,reason:'A valid cumulative CGPA is not available.'};
 const value=(cgpa-rule.offset)*rule.factor;
 if(value<0 || value>100 || !Number.isFinite(value))return {...unavailable,reason:'The conversion falls outside the valid percentage range.'};
 return {value,source:resolved.rule?resolved.source:'project-rule',rule,status:resolved.status,reason:resolved.rule?resolved.reason:`Project estimate only. ${resolved.reason}`};
}
