// Names here must come exclusively from verified, eligible AMS records, never
// editable campus display names. A supplied invalid VTU cannot trigger fallback.
const courseKey=value=>String(value || '').toUpperCase().replace(/[^A-Z0-9]/g,'');
const nameKey=value=>String(value || '').normalize('NFKC').trim().replace(/\s+/g,' ').toLocaleUpperCase('en');
const numberKey=value=>String(value || '').trim().toUpperCase();
export function matchImportedSeats(candidates,courseCode,eligibleRoster=[]){
 const names=new Map();
 for(const student of eligibleRoster){const key=nameKey(student.name),number=numberKey(student.vtuNumber);if(!key || !/^VTU\d{3,12}$/.test(number))continue;const list=names.get(key) || new Set();list.add(number);names.set(key,list);}
 const matched=[],issues=[];
 for(const candidate of candidates){
  const {sourceRow,name,courseCode:subject,...seat}=candidate;
  const issue=message=>issues.push({sourceRow,message});
  if(!subject || courseKey(subject)!==courseKey(courseCode)){issue('Missing or different Course Code. Supply the exact examination subject.');continue;}
  let number=numberKey(seat.vtuNumber),method='Exact VTU';
  if(number && !/^VTU\d{3,12}$/.test(number)){issue('Invalid supplied VTU; name fallback was not attempted.');continue;}
  if(!number){const matches=names.get(nameKey(name));if(matches?.size!==1){issue('Name is unmatched or ambiguous in the verified eligible AMS roster. Supply an exact VTU.');continue;}number=[...matches][0];method='Unique eligible AMS name';}
  matched.push({seat:{...seat,vtuNumber:number},sourceRow,method});
 }
 const counts=new Map();for(const row of matched)counts.set(row.seat.vtuNumber,(counts.get(row.seat.vtuNumber) || 0)+1);
 const rows=[],review=[];
 for(const row of matched){if(counts.get(row.seat.vtuNumber)>1){issues.push({sourceRow:row.sourceRow,message:'Duplicate student identity; every conflicting row was excluded.'});continue;}rows.push(row.seat);review.push({sourceRow:row.sourceRow,vtuNumber:row.seat.vtuNumber,method:row.method});}
 return {rows,review,issues};
}
