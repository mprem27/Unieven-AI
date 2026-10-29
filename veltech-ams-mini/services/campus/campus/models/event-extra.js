import mongoose from 'mongoose';
const {Schema}=mongoose;
const waitlistSchema=new Schema({event:{type:Schema.Types.ObjectId,ref:'Event',required:true},user:{type:Schema.Types.ObjectId,ref:'User',required:true},status:{type:String,enum:['waiting','cancelled','registered'],default:'waiting'}},{timestamps:true});
waitlistSchema.index({event:1,user:1},{unique:true});waitlistSchema.index({event:1,status:1,createdAt:1});
const deliverySchema=new Schema({registration:{type:Schema.Types.ObjectId,ref:'EventRegistration',required:true},event:{type:Schema.Types.ObjectId,ref:'Event',required:true},kind:{type:String,enum:['receipt','reminder'],required:true},status:{type:String,enum:['queued','sending','sent','failed','cancelled'],default:'queued'},attempts:{type:Number,default:0},nextAttemptAt:{type:Date,default:Date.now},lockedUntil:{type:Date,default:null},sentAt:Date,lastError:{type:String,default:''}},{timestamps:true});
deliverySchema.index({registration:1,kind:1},{unique:true});deliverySchema.index({status:1,nextAttemptAt:1,lockedUntil:1});
export const EventWaitlist=mongoose.models.CampusEventWaitlist || mongoose.model('CampusEventWaitlist',waitlistSchema);
export const EventDelivery=mongoose.models.CampusEventDelivery || mongoose.model('CampusEventDelivery',deliverySchema);
export async function initializeEventExtraModels(){await Promise.all([EventWaitlist.init(),EventDelivery.init()]);}
export async function cancelEventWaitlist(user,event){await EventWaitlist.updateOne({user,event,status:'waiting'},{$set:{status:'registered'}});}
