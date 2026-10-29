import mongoose from 'mongoose';
export const REPORT_REASONS=['spam','harassment','hate','sexual','violence','misinformation','privacy','other'];
const schema=new mongoose.Schema({
  reporter:{type:mongoose.Schema.Types.ObjectId,ref:'User',required:true},
  targetType:{type:String,enum:['post','reel','user'],required:true},
  targetId:{type:mongoose.Schema.Types.ObjectId,required:true},
  reason:{type:String,enum:REPORT_REASONS,required:true},
  details:{type:String,trim:true,maxlength:1000,default:''},
  status:{type:String,enum:['pending','reviewed','dismissed'],default:'pending',required:true},
  reviewedBy:{type:mongoose.Schema.Types.ObjectId,ref:'User',default:null},
  reviewedAt:{type:Date,default:null},
  reviewNote:{type:String,trim:true,maxlength:1000,default:''}
},{timestamps:true});
schema.index({status:1,createdAt:-1});schema.index({reporter:1,createdAt:-1});
export const CommunityReport=mongoose.models.CampusCommunityReport || mongoose.model('CampusCommunityReport',schema);
