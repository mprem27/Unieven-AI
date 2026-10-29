// Offline course records are evidence of a previous read, never of a new offer
// or an open registration window. Keep the original source timestamp.
export function savedCourseRegistration(academic={}){
 const registeredCourses=(Array.isArray(academic.courses)?academic.courses:[]).filter(row=>row && row.source==='ams');
 return {registeredCourses,offerings:[],warnings:[],source:registeredCourses.length?'ams':'unavailable',updatedAt:academic.sectionSources?.courses?.updatedAt || academic.updatedAt,submissionSupported:false,saved:true,message:'Saved course records. Connect to check current registration status.'};
}
