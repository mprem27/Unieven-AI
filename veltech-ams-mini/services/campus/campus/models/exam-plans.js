import mongoose from 'mongoose';
const {Schema}=mongoose;
const documentSchema=new Schema({name:String,key:{type:String,select:false},mime:String,size:Number},{_id:false});
const schema=new Schema({
 title:{type:String,default:'',maxlength:160},examType:{type:String,default:'',maxlength:80},academicYear:{type:String,default:'',maxlength:40},term:{type:String,default:'',maxlength:80},
 department:{type:String,default:'',maxlength:120,index:true},regulation:{type:String,default:'',maxlength:40},batch:{type:String,default:'',maxlength:40},semester:{type:String,default:'',maxlength:30},section:{type:String,default:'',maxlength:30},instructions:{type:String,default:'',maxlength:3000},
 rows:{type:[Schema.Types.Mixed],default:[]},warnings:{type:[String],default:[]},document:documentSchema,publishedDocument:documentSchema,
 revision:{type:Number,default:0},publishedRevision:Number,publishedTitle:String,publishedAt:Date,status:{type:String,enum:['draft','published','withdrawn'],default:'draft'},
 deletedAt:Date,createdBy:{type:Schema.Types.ObjectId,required:true},createdByName:String,jobToken:{type:String,select:false},lockedUntil:Date,
},{timestamps:true,collection:'exam_plans'});
schema.index({status:1,department:1,updatedAt:-1});
export const ExamPlan=mongoose.models.CampusExamPlan || mongoose.model('CampusExamPlan',schema);
