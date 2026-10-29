import mongoose from 'mongoose';
const schema=new mongoose.Schema({owner:{type:mongoose.Schema.Types.ObjectId,ref:'User',required:true},key:{type:String,required:true},value:String},{timestamps:true});
schema.index({owner:1,key:1},{unique:true});
export const NotificationState=mongoose.models.CampusNotificationState || mongoose.model('CampusNotificationState',schema);
