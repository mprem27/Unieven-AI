import {ExamPlan} from '../models/exam-plans.js';
export async function currentPublishedExams(rows){
 const ids=[...new Set(rows.filter(r=>r.planId).map(r=>String(r.planId)))];
 if(!ids.length)return rows.filter(r=>r.isPublished);
 const plans=await ExamPlan.find({_id:{$in:ids},status:'published'}).select('publishedRevision').lean(),active=new Map(plans.map(p=>[String(p._id),p.publishedRevision]));
 return rows.filter(r=>r.isPublished && (!r.planId || active.get(String(r.planId))===r.planRevision));
}
export const examView=row=>({id:String(row._id),name:row.title,title:row.title,courseCode:row.courseCode,courseName:row.courseName,date:row.date,time:`${row.startTime}–${row.endTime}`,startTime:row.startTime,endTime:row.endTime,room:row.room,department:row.department==='*'?'':row.department,semester:row.semester,section:row.section,regulation:row.regulation,batch:row.batch,notes:row.notes,url:row.url,isPublished:row.isPublished,publishedBy:row.publishedByName,source:'faculty-published',sourceUpdatedAt:row.updatedAt,publishedAt:row.createdAt,planId:row.planId?String(row.planId):undefined});
