import mongoose from 'mongoose';
const {Schema}=mongoose;
const schema=new Schema({
 title:{type:String,required:true,maxlength:180},category:{type:String,required:true,maxlength:80},reference:{type:String,default:'',maxlength:120},date:{type:String,default:''},
 scope:{type:String,enum:['college','department'],required:true},department:{type:String,default:'',maxlength:120},semester:{type:String,default:'',maxlength:30},section:{type:String,default:'',maxlength:30},batch:{type:String,default:'',maxlength:40},courseCodes:{type:[String],default:[]},
 file:{name:{type:String,required:true},key:{type:String,required:true,select:false},mime:{type:String,required:true},size:{type:Number,required:true}},
 createdBy:{type:Schema.Types.ObjectId,ref:'User',required:true,index:true},createdByName:{type:String,default:''},updatedBy:{type:Schema.Types.ObjectId,ref:'User',required:true},
},{timestamps:true});
schema.index({scope:1,department:1,createdAt:-1});
export const CampusDocument=mongoose.models.CampusDocument || mongoose.model('CampusDocument',schema);
