import mongoose from 'mongoose';
const {Schema}=mongoose;
const schema=new Schema({
 department:{type:String,required:true,maxlength:120},courseCode:{type:String,required:true,maxlength:40},courseName:{type:String,required:true,maxlength:180},
 day:{type:String,required:true,enum:['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday']},
 startTime:{type:String,required:true},endTime:{type:String,required:true},date:{type:String,default:''},sourceRoom:{type:String,default:'',maxlength:120},faculty:{type:String,default:'',maxlength:160},
 room:{type:String,required:true,maxlength:120},createdBy:{type:Schema.Types.ObjectId,ref:'User',required:true},updatedBy:{type:Schema.Types.ObjectId,ref:'User',required:true},
},{timestamps:true});
schema.index({department:1,courseCode:1,courseName:1,day:1,startTime:1,endTime:1,date:1,sourceRoom:1,faculty:1},{unique:true});
export const TimetableRoomOverride=mongoose.models.CampusTimetableRoomOverride || mongoose.model('CampusTimetableRoomOverride',schema);
