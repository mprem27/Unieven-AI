import mongoose from 'mongoose';
const {Schema}=mongoose;
const schema=new Schema({title:{type:String,required:true,maxlength:160},kind:{type:String,enum:['semester','examination','academic'],default:'semester'},department:{type:String,default:''},semester:String,section:String,validFrom:{type:String,required:true},validTo:{type:String,required:true},notes:{type:String,maxlength:5000},url:String,publishedBy:{type:Schema.Types.ObjectId,ref:'User',required:true},publishedByName:String,withdrawnAt:{type:Date,default:null}},{timestamps:true});
schema.index({department:1,withdrawnAt:1,validFrom:1});
export const Schedule=mongoose.models.CampusSchedule || mongoose.model('CampusSchedule',schema);
