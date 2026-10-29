import mongoose from 'mongoose';
const {Schema}=mongoose;
const accountSchema=new Schema({user:{type:Schema.Types.ObjectId,ref:'User',required:true,unique:true},permissions:[String],actions:Schema.Types.Mixed,accessRole:{type:String,default:'custom'},owner:Boolean,active:Boolean,createdBy:{type:Schema.Types.ObjectId,ref:'User'},lastLoginAt:Date},{timestamps:true,collection:'admin_accounts'});
const loginSchema=new Schema({user:{type:Schema.Types.ObjectId,ref:'User',required:true,index:true},action:{type:String,enum:['login','logout','failed-login'],required:true},session:{type:Schema.Types.ObjectId},at:{type:Date,default:Date.now,index:true}},{collection:'admin_login_events'});
export const AdminAccount=mongoose.models.CampusAdminAccount || mongoose.model('CampusAdminAccount',accountSchema);
export const AdminLoginEvent=mongoose.models.CampusAdminLoginEvent || mongoose.model('CampusAdminLoginEvent',loginSchema);
const accountAccessSchema=new Schema({user:{type:Schema.Types.ObjectId,ref:'User',required:true},role:{type:String,enum:['student','faculty','admin'],required:true},action:{type:String,enum:['login','logout','failed-login'],required:true},at:{type:Date,default:Date.now}},{collection:'account_access_events'});
accountAccessSchema.index({user:1,at:-1});
export const AccountAccessEvent=mongoose.models.CampusAccountAccessEvent || mongoose.model('CampusAccountAccessEvent',accountAccessSchema);
