import mongoose from 'mongoose';
const {Schema}=mongoose;
const model=(name,schema)=>mongoose.models[name] || mongoose.model(name,schema);
export const IdentityChallenge=model('CampusIdentityChallenge',new Schema({
 scopeHash:{type:String,required:true,unique:true},purpose:{type:String,enum:['signup','reset','recovery'],required:true},
 challengeHash:{type:String,index:true},browserHash:String,codeHash:String,email:String,user:{type:Schema.Types.ObjectId,ref:'User'},
 payload:{name:String,username:String,passwordHash:String},attempts:{type:Number,default:0},
 expiresAt:Date,consumedAt:Date,issuedAt:Date,issueWindowAt:Date,issueCount:{type:Number,default:0},
 purgeAt:{type:Date,index:{expires:0}}
},{timestamps:true}));
export const IdentityProof=model('CampusIdentityProof',new Schema({
 tokenHash:{type:String,unique:true,required:true},browserHash:{type:String,required:true},
 user:{type:Schema.Types.ObjectId,ref:'User',required:true,unique:true},consumedAt:Date,
 expiresAt:{type:Date,required:true,index:{expires:0}}
},{timestamps:true}));
