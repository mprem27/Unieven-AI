import mongoose from 'mongoose';
const {Schema}=mongoose;
const schema=new Schema({
 courseMatchKey:{type:String,default:function(){return String(this.courseCode || '').toUpperCase().replace(/[^A-Z0-9]/g,'');}},
 title:{type:String,required:true,maxlength:160},courseCode:{type:String,required:true,maxlength:40},courseName:{type:String,required:true,maxlength:180},
 date:{type:String,required:true},startTime:{type:String,required:true},endTime:{type:String,required:true},room:{type:String,maxlength:120,default:''},
 department:{type:String,required:true,maxlength:120,index:true},semester:{type:String,maxlength:30,default:''},section:{type:String,maxlength:30,default:''},
 planId:{type:Schema.Types.ObjectId,index:true},planRevision:Number,regulation:{type:String,default:''},batch:{type:String,default:''},
 seatingRelease:{type:Schema.Types.ObjectId},seatingRevision:{type:Number,default:0},seatingInstructions:String,seatingAllowDownload:Boolean,seatingPublishedAt:Date,seatingJobToken:String,seatingLockedUntil:Date,
 notes:{type:String,maxlength:3000,default:''},url:{type:String,default:''},publishedBy:{type:Schema.Types.ObjectId,ref:'User',required:true},
 publishedByName:{type:String,required:true},isPublished:{type:Boolean,default:true,index:true},
},{timestamps:true});
schema.index({department:1,isPublished:1,date:1});
schema.index({planId:1,planRevision:1,date:1});
schema.index({courseCode:1,isPublished:1,date:1});
schema.index({courseMatchKey:1,isPublished:1,date:1});
export const FacultyExam=mongoose.models.CampusFacultyExamination || mongoose.model('CampusFacultyExamination',schema);
