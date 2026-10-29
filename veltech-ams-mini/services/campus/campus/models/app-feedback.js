import mongoose from 'mongoose';
const {Schema}=mongoose;
export const AppFeedback=mongoose.models.AppFeedback || mongoose.model('AppFeedback',new Schema({
 owner:{type:Schema.Types.ObjectId,ref:'User',required:true,index:true},
 clientRequestId:{type:String,required:true,maxlength:80},
 category:{type:String,enum:['bug','idea','experience'],required:true},
 subject:{type:String,required:true,maxlength:120},message:{type:String,required:true,maxlength:3000},
 rating:{type:Number,min:1,max:5},status:{type:String,enum:['new','reviewing','planned','resolved','closed'],default:'new',index:true},
 reply:{type:String,default:'',maxlength:2000},replyAt:Date,respondedBy:{type:Schema.Types.ObjectId,ref:'User'},
 archivedAt:{type:Date,default:null},notificationEventKey:String,notificationPending:{type:Boolean,default:false}
},{timestamps:true}));
AppFeedback.schema.index({owner:1,clientRequestId:1},{unique:true});
AppFeedback.schema.index({owner:1,createdAt:-1});
