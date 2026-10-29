import mongoose from 'mongoose';
const {Schema}=mongoose;
const schema=new Schema({event:{type:Schema.Types.ObjectId,ref:'Event',required:true},user:{type:Schema.Types.ObjectId,ref:'User',required:true},grantedBy:{type:Schema.Types.ObjectId,ref:'User',required:true},capabilities:{qr:{type:Boolean,default:false},manual:{type:Boolean,default:false},email:{type:Boolean,default:false}},active:{type:Boolean,default:true}},{timestamps:true,collection:'event_staff_grants'});
schema.index({event:1,user:1},{unique:true});
export const EventStaffGrant=mongoose.models.CampusEventStaffGrant || mongoose.model('CampusEventStaffGrant',schema);
