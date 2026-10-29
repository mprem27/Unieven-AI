import mongoose from 'mongoose';
const schema=new mongoose.Schema({_id:String,token:String,expiresAt:Date},{versionKey:false});
export const ExamPublicationLock=mongoose.models.CampusExamPublicationLock || mongoose.model('CampusExamPublicationLock',schema);
