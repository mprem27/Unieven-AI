export const calculationSchemes={
 source:{label:'AMS numeric points only',grades:{}},
 sab:{label:'10-point estimate · S / A / B',grades:{S:10,A:9,B:8,C:7,D:6,E:5,F:0,U:0,RA:0,AB:0}},
 plus:{label:'10-point estimate · S / A+ / A',grades:{S:10,'A+':9,A:8,'B+':7,B:6,C:5,F:0,U:0,RA:0,AB:0}},
 ugc:{label:'10-point estimate · O / A+ / A',grades:{O:10,'A+':9,A:8,'B+':7,B:6,C:5,P:4,F:0,U:0,AB:0}},
};
const defaults=()=>({scheme:'sab',percentageFactor:10});
const key=owner=>`veltech:result-calculation:v1:${owner}`;
function normalize(value){
 if(!value || !Object.hasOwn(calculationSchemes,value.scheme))throw new Error('Choose a calculation scale.');
 const factor=value.percentageFactor==='' || value.percentageFactor===null?null:Number(value.percentageFactor);
 if(factor!==null && (!Number.isFinite(factor) || factor<=0 || factor>100))throw new Error('Enter a positive percentage factor up to 100, or leave it empty.');
 return {scheme:value.scheme,percentageFactor:factor};
}
export function readCalculation(owner,storage=globalThis.localStorage){try{return normalize(JSON.parse(storage.getItem(key(owner))));}catch{return defaults();}}
export function saveCalculation(owner,value,storage=globalThis.localStorage){const saved=normalize(value);storage.setItem(key(owner),JSON.stringify(saved));return saved;}
export function calculationScale(value){return Object.entries(calculationSchemes[value.scheme]?.grades || {}).map(([grade,points])=>({grade,points}));}
