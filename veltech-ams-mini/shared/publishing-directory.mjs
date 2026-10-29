// Exact alias normalization only. Similar spellings are suggestions, never authority.
export const scopeKey=value=>String(value ?? '').normalize('NFKC').toUpperCase().replace(/&/g,'AND').replace(/[^A-Z0-9]/g,'');
const groups={CSE:['CSE','Computer Science and Engineering','Computer Science Engineering','Computer Science'],ECE:['ECE','Electronics and Communication Engineering','Electronics Communication Engineering'],EEE:['EEE','Electrical and Electronics Engineering'],MECH:['MECH','Mechanical Engineering'],CIVIL:['CIVIL','Civil Engineering'],IT:['IT','Information Technology']};
export const knownDepartmentOptions=()=>Object.entries(groups).map(([value,aliases])=>({value,label:value,aliases:[...aliases]}));
const bareDepartment=value=>scopeKey(String(value ?? '').replace(/\bB\.?\s*TECH\.?|BACHELOR OF TECHNOLOGY/gi,''));
const baseAliases=new Map(Object.entries(groups).flatMap(([key,names])=>names.map(name=>[bareDepartment(name),key])));
let extraAliases=new Map(),catalogDepartments=[],clubAliases=new Map();
export function configurePublishingAliases(departments=[]){
 catalogDepartments=departments;
 const aliases=new Map();
 for(const row of departments){const key=baseAliases.get(bareDepartment(row.value)) || bareDepartment(row.value);for(const name of [row.value,row.label,...(row.aliases || [])]){const alias=bareDepartment(name);if(alias)aliases.set(alias,aliases.has(alias) && aliases.get(alias)!==key?null:key);}}
 extraAliases=aliases;
}
export function baseDepartmentKey(value){const key=bareDepartment(value);return baseAliases.get(key) || key;}
export function departmentKey(value){const key=bareDepartment(value);return baseAliases.get(key) || extraAliases.get(key) || key;}
export const sameDepartment=(a,b)=>!!departmentKey(a) && departmentKey(a)===departmentKey(b);
export function configurePublishingClubs(clubs=[]){
 const aliases=new Map();
 for(const row of clubs){const department=departmentKey(row.department),value=scopeKey(row.value);for(const name of [row.value,row.label]){const key=department+':'+scopeKey(name);aliases.set(key,aliases.has(key) && aliases.get(key)!==value?null:value);}}
 clubAliases=aliases;
}
export function clubKey(value,department){const key=scopeKey(value);return clubAliases.get(departmentKey(department)+':'+key) || key;}
export const sameClub=(a,b,department)=>!!clubKey(a,department) && clubKey(a,department)===clubKey(b,department);
export function departmentAliases(value){const key=departmentKey(value);return [...new Set([String(value ?? ''),...(groups[key] || []),...catalogDepartments.filter(r=>departmentKey(r.value)===key).flatMap(r=>[r.value,r.label,...(r.aliases || [])])])].filter(Boolean);}
export function departmentQuery(value){
 const patterns=departmentAliases(value).map(name=>{
  const letters=bareDepartment(name).split('AND').map(part=>part.split('').join('[\\s\\W_]*')).join('[\\s\\W_]*(?:A[\\s\\W_]*N[\\s\\W_]*D|&)[\\s\\W_]*');
  return new RegExp(`^(?:B[\\s\\W_]*TECH[\\s\\W_]*|BACHELOR[\\s\\W_]*OF[\\s\\W_]*TECHNOLOGY[\\s\\W_]*)?${letters}[\\s\\W_]*$`,'i');
 });
 return {$in:patterns};
}
function distance(a,b){const row=Array.from({length:b.length+1},(_,i)=>i);for(let i=1;i<=a.length;i++){let previous=row[0];row[0]=i;for(let j=1;j<=b.length;j++){const old=row[j];row[j]=Math.min(row[j]+1,row[j-1]+1,previous+(a[i-1]===b[j-1]?0:1));previous=old;}}return row[b.length];}
export function resolveScope(input,options=[],{kind='department',department}={}){
 const key=kind==='department'?departmentKey:value=>clubKey(value,department),needle=key(input),allowed=kind==='club' && department?options.filter(row=>sameDepartment(row.department,department)):options;
 if(!needle)return {status:'blank',suggestions:[]};
 const matches=allowed.filter(row=>[row.value,row.label,...(row.aliases || [])].some(name=>key(name)===needle));
 if(matches.length===1)return {status:'resolved',value:matches[0].value,option:matches[0],suggestions:[]};
 if(matches.length>1)return {status:'ambiguous',suggestions:matches};
 const suggestions=allowed.map(option=>({option,score:Math.min(...[option.value,option.label,...(option.aliases || [])].map(name=>distance(needle,key(name))))})).sort((a,b)=>a.score-b.score || a.option.label.localeCompare(b.option.label)).filter(row=>row.score<=Math.max(2,Math.ceil(needle.length*.3)) || key(row.option.label).includes(needle)).slice(0,5).map(row=>row.option);
 return {status:'unknown',suggestions};
}
