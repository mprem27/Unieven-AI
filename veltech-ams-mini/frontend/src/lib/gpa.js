// Grade points must be explicit numeric values. Letter grades and reported
// GPA/CGPA summaries are deliberately never converted into course points.
export function academicNumber(value){
 if(typeof value!=='number' && typeof value!=='string')return null;
 if(typeof value==='string' && !/^\d+(?:\.\d+)?$/.test(value.trim()))return null;
 const number=Number(value);return Number.isFinite(number) && number>=0?number:null;
}
export function resultGradePoints(row){return academicNumber(row?.gradePoints ?? row?.gradePoint);}
export function weightedGpa(rows=[]){
 let credits=0,points=0,included=0,excluded=0;
 const attempts=new Map();
 for(const row of rows){const code=row?.courseCode || row?.subjectCode;if(code && resultGradePoints(row)!==null)attempts.set(code,(attempts.get(code) || 0)+1);}
 for(const row of rows){const credit=academicNumber(row?.credits),grade=resultGradePoints(row),code=row?.courseCode || row?.subjectCode;if(credit===null || credit<=0 || grade===null || (code && attempts.get(code)>1)){excluded++;continue;}credits+=credit;points+=credit*grade;included++;}
 return {value:credits?points/credits:null,credits,included,excluded,complete:included>0 && excluded===0};
}
export function semesterGpas(rows=[]){
 const semesters=new Map();
 for(const row of rows){const key=String(row.semester ?? '').trim() || 'Not provided';if(!semesters.has(key))semesters.set(key,[]);semesters.get(key).push(row);}
 return [...semesters].map(([semester,items])=>({semester,...weightedGpa(items)}));
}
export function percentageEstimate(value,factor,offset=0){
 const number=academicNumber(value),multiplier=academicNumber(factor),deduction=academicNumber(offset);
 if(number===null || multiplier===null || deduction===null || multiplier<=0)return null;
 const percentage=(number-deduction)*multiplier;
 return percentage>=0 && percentage<=100?percentage:null;
}
