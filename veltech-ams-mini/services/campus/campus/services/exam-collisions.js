import crypto from 'node:crypto';
import {ExamPublicationLock} from '../models/exam-publication-lock.js';
import {FacultyExam} from '../models/faculty-exams.js';
import {currentPublishedExams} from './exam-publications.js';
import {courseKey,departmentKey,fieldKey} from './exam-audience.js';
import {fail} from '../security.js';
const blank=value=>!value || value==='*';
export function examAudiencesOverlap(a,b){return ['department','semester','section','regulation','batch'].every(key=>blank(a[key]) || blank(b[key]) || (key==='department'?departmentKey(a[key])===departmentKey(b[key]):fieldKey(a[key],key)===fieldKey(b[key],key)));}
export function examSessionsConflict(a,b){return courseKey(a.courseCode)===courseKey(b.courseCode) && a.date===b.date && a.startTime<b.endTime && a.endTime>b.startTime && examAudiencesOverlap(a,b);}
export async function assertNoPublishedExamCollision(rows,{excludePlan,excludeExam}={}){
 const codes=[...new Set(rows.map(r=>courseKey(r.courseCode)))],dates=[...new Set(rows.map(r=>r.date))];
 const candidates=await FacultyExam.find({isPublished:true,date:{$in:dates},$or:[{courseMatchKey:{$in:codes}},{courseMatchKey:{$exists:false}}],...(excludePlan?{planId:{$ne:excludePlan}}:{}),...(excludeExam?{_id:{$ne:excludeExam}}:{})}).lean();
 const active=await currentPublishedExams(candidates),slots=new Map();for(const row of active){const key=courseKey(row.courseCode)+'|'+row.date;slots.set(key,[...(slots.get(key) || []),row]);}
 for(const row of rows)if((slots.get(courseKey(row.courseCode)+'|'+row.date) || []).some(other=>examSessionsConflict(row,other)))fail(409,'An overlapping examination is already published for this course and audience. Edit or withdraw the existing publication first.');
}
// One short database lease covers every publishing route, across API instances.
// Imports and document parsing happen outside this lease.
export async function withExamPublicationLock(work){
 const token=crypto.randomUUID(),id='campus-exam-publication',now=new Date(),expiresAt=new Date(+now+120000);
 let lock=await ExamPublicationLock.findOneAndUpdate({_id:id,expiresAt:{$lte:now}},{$set:{token,expiresAt}},{returnDocument:'after'});
 if(!lock){try{lock=await ExamPublicationLock.create({_id:id,token,expiresAt});}catch(error){if(error.code!==11000)throw error;fail(409,'Another examination publication is in progress. Retry shortly.');}}
 const checkpoint=async()=>{const kept=await ExamPublicationLock.updateOne({_id:id,token,expiresAt:{$gt:new Date()}},{$set:{expiresAt:new Date(Date.now()+120000)}});if(!kept.matchedCount)fail(409,'Publication timed out. Reload the schedule and retry.');};
 try{return await work(checkpoint);}finally{await ExamPublicationLock.deleteOne({_id:id,token});}
}
