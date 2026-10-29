import mongoose from 'mongoose';
const {Schema}=mongoose;
const department=new Schema({value:{type:String,required:true,maxlength:120},label:{type:String,required:true,maxlength:120},aliases:[String]},{_id:false});
const club=new Schema({value:{type:String,required:true,maxlength:120},label:{type:String,required:true,maxlength:120},department:{type:String,required:true,maxlength:120}},{_id:false});
export const PublishingDirectory=mongoose.models.CampusPublishingDirectory || mongoose.model('CampusPublishingDirectory',new Schema({key:{type:String,unique:true,default:'campus'},departments:[department],clubs:[club],updatedBy:{type:Schema.Types.ObjectId,ref:'User'}},{timestamps:true}));
