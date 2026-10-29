import {resolveScope,sameDepartment,sameClub} from '../../../shared/publishing-directory.mjs';
export {departmentKey,sameDepartment} from '../../../shared/publishing-directory.mjs';
export function scopeChoices(options,{kind='department',department}={}){const rows=options?.[kind==='club'?'clubs':'departments'] || [];return kind==='club'?(department?rows.filter(row=>sameDepartment(row.department,department)):[]):rows;}
export function scopeSelection(text,options,{kind='department',department,existingValue='',required=false,allowBlank=true}={}){
 const result=resolveScope(text,scopeChoices(options,{kind,department}),{kind,department});
 if(result.status==='resolved')return {...result,valid:true};
 if(!String(text || '').trim())return {...result,value:'',valid:!required && allowBlank,message:required || !allowBlank?'Choose a known '+kind+'.':''};
 const clubOutsideDepartment=kind==='club' && (options?.clubs || []).some(row=>sameClub(row.value,text,row.department) && !sameDepartment(row.department,department));
 if(text===existingValue && !clubOutsideDepartment)return {...result,value:existingValue,valid:true,legacy:true};
 return {...result,valid:false,message:result.status==='ambiguous'?'Choose the intended '+kind+' from the suggestions.':'Choose a known '+kind+' from the list. Ask an account administrator to add a missing choice.'};
}
