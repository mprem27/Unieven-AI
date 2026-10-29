// One column order for completed-seat templates and reviewed preview exports.
export const seatingExportColumns=Object.freeze([
 ['courseCode','Course Code'],['vtuNumber','VTU Number'],['name','Name'],
 ['hall','Hall'],['room','Room'],['seat','Seat'],
 ['reportingTime','Reporting Time'],['notes','Notes'],
].map(column=>Object.freeze(column)));
export function seatingExportRows(courseCode,rows){
 return [seatingExportColumns.map(([,label])=>label),...rows.map(row=>seatingExportColumns.map(([key])=>key==='courseCode'?courseCode:row[key] ?? ''))];
}
