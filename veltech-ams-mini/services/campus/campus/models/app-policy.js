import mongoose from 'mongoose';
const schema=new mongoose.Schema({key:{type:String,unique:true,required:true},eventExpiryMonths:{type:Number,default:6,min:1,max:120},updatedBy:{type:mongoose.Schema.Types.ObjectId,ref:'User'}},{timestamps:true});
export const AppPolicy=mongoose.models.CampusAppPolicy || mongoose.model('CampusAppPolicy',schema);
