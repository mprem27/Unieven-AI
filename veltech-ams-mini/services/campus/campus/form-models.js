import mongoose from 'mongoose';
const {Schema}=mongoose;
const model=(name,schema)=>mongoose.models[name] || mongoose.model(name,schema);
export const CampusForm=model('CampusForm',new Schema({
 archivedAt:{type:Date,default:null},createdBy:{type:Schema.Types.ObjectId,ref:'User',required:true},title:{type:String,required:true,maxlength:150},description:{type:String,maxlength:5000,default:''},
 scope:{type:String,enum:['department','club','college'],required:true},department:{type:String,default:''},club:{type:String,default:''},
 state:{type:String,enum:['draft','published','closed'],default:'published'},fields:{type:[new Schema({id:String,label:String,type:String,required:Boolean,choices:[String]},{_id:false})],required:true},
 eventId:{type:Schema.Types.ObjectId,ref:'Event',default:null},opensAt:Date,closesAt:Date,requireProof:{type:Boolean,default:false},requireRegistration:{type:Boolean,default:false},checkIn:{type:Boolean,default:false},
 geofence:{type:new Schema({latitude:Number,longitude:Number,radiusMeters:Number},{_id:false}),default:null},responseCount:{type:Number,default:0},revision:{type:Number,default:0}
},{timestamps:true}));
CampusForm.schema.index({scope:1,department:1,state:1,createdAt:-1});
export const FormResponse=model('CampusFormResponse',new Schema({
 form:{type:Schema.Types.ObjectId,ref:'CampusForm',required:true},user:{type:Schema.Types.ObjectId,ref:'User',required:true},answers:{type:Schema.Types.Mixed,required:true},proof:{type:Schema.Types.ObjectId,ref:'CampusFormProof',default:null},
 registration:{type:Schema.Types.ObjectId,ref:'EventRegistration',default:null},location:{type:new Schema({latitude:Number,longitude:Number,accuracy:Number,capturedAt:Date,distanceMeters:Number,verifiedAt:Date},{_id:false}),default:null},
 status:{type:String,enum:['pending','reviewing','approved','rejected'],default:'pending'},reviewNote:{type:String,maxlength:1000,default:''},reviewedBy:{type:Schema.Types.ObjectId,ref:'User'},reviewedAt:Date
},{timestamps:true}));
FormResponse.schema.index({form:1,user:1},{unique:true});
export const FormProof=model('CampusFormProof',new Schema({
 form:{type:Schema.Types.ObjectId,ref:'CampusForm',required:true,index:true},owner:{type:Schema.Types.ObjectId,ref:'User',required:true},key:{type:String,required:true,unique:true},mime:{type:String,required:true},size:{type:Number,required:true},response:{type:Schema.Types.ObjectId,ref:'CampusFormResponse',default:null},
 source:{type:String,enum:['upload','camera'],default:'upload'},captureChallenge:{type:Schema.Types.ObjectId,ref:'CampusFormChallenge',default:null},capturedAt:Date,captureExpiresAt:Date
},{timestamps:true}));
export const FormChallenge=model('CampusFormChallenge',new Schema({
 form:{type:Schema.Types.ObjectId,ref:'CampusForm',required:true},user:{type:Schema.Types.ObjectId,ref:'User',required:true},tokenHash:{type:String,required:true,unique:true},purpose:{type:String,enum:['location','camera'],default:'location'},expiresAt:{type:Date,required:true,index:{expires:0}},consumedAt:{type:Date,default:null}
},{timestamps:true}));
export async function initializeFormModels(){await Promise.all([CampusForm.init(),FormResponse.init(),FormProof.init(),FormChallenge.init()]);}
