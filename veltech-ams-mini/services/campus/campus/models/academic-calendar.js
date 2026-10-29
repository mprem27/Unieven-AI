import mongoose from 'mongoose';
const {Schema}=mongoose;
const classSchema=new Schema({
 courseCode:{type:String,required:true,maxlength:40},courseName:{type:String,required:true,maxlength:180},
 startTime:{type:String,required:true},endTime:{type:String,required:true},room:{type:String,default:'',maxlength:120},faculty:{type:String,default:'',maxlength:160},
},{_id:false});
const schema=new Schema({
 date:{type:String,required:true,index:true},mode:{type:String,required:true,enum:['holiday','follow-day','special']},
 label:{type:String,required:true,maxlength:160},reason:{type:String,default:'',maxlength:1000},
 scope:{type:String,required:true,enum:['college','department','students']},department:{type:String,default:'',maxlength:120},
 studentIds:[{type:Schema.Types.ObjectId,ref:'User'}],followDay:{type:String,default:''},classes:{type:[classSchema],default:[]},
 scopeKeys:{type:[String],required:true},createdBy:{type:Schema.Types.ObjectId,ref:'User',required:true},updatedBy:{type:Schema.Types.ObjectId,ref:'User',required:true},
},{timestamps:true});
// One slot per specificity and target on a date. A unique multikey index also
// prevents concurrent overlapping student lists from creating competing entries.
schema.index({date:1,scopeKeys:1},{unique:true});
schema.index({department:1,date:1});
export const AcademicCalendarEntry=mongoose.models.CampusAcademicCalendarEntry || mongoose.model('CampusAcademicCalendarEntry',schema);
