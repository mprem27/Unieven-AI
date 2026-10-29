import mongoose from 'mongoose';
const {Schema}=mongoose;
const schema=new Schema({
 batch:{type:String,required:true},programme:{type:String,required:true},programmeKey:{type:String,required:true},
 regulation:{type:String,required:true},regulationKey:String,
 scopeVersion:Number,departmentScope:{type:String,enum:['all','department']},department:{type:String,default:''},departmentKey:String,
 factor:{type:Number,required:true},offset:{type:Number,required:true,default:0},
 sourceUrl:{type:String,required:true},sourceClause:{type:String,required:true},verifiedAt:{type:Date,required:true},verifiedBy:{type:Schema.Types.ObjectId,ref:'User',required:true},
},{timestamps:true});
export const scopedBatchRuleIndex={batch:1,programmeKey:1,regulationKey:1,departmentKey:1};
export const scopedBatchRuleIndexName='academic_rule_scope_unique';
const scopedIndexOptions={unique:true,name:scopedBatchRuleIndexName,partialFilterExpression:{scopeVersion:2}};
// Legacy rows are retained as-is; only explicitly scoped records participate.
// Declaring this index does not retire the pre-existing batch/programme index.
schema.index(scopedBatchRuleIndex,scopedIndexOptions);
export const BatchRule=mongoose.models.CampusBatchRule || mongoose.model('CampusBatchRule',schema);
const sameKeys=(actual,expected)=>JSON.stringify(actual)===JSON.stringify(expected);
export function legacyBatchRuleIndex(index){return index.unique===true && sameKeys(index.key,{batch:1,programmeKey:1});}
/** Create protection first. Dropping the old index requires an explicit operator opt-in. No documents are changed. */
export async function migrateBatchRuleIndexes({retireLegacyIndex=false}={}){
 if(typeof retireLegacyIndex!=='boolean')throw new Error('Legacy index retirement requires an explicit boolean opt-in.');
 await BatchRule.collection.createIndex(scopedBatchRuleIndex,scopedIndexOptions);
 const indexes=await BatchRule.collection.indexes(),strong=indexes.find(index=>index.name===scopedBatchRuleIndexName);
 if(!strong?.unique || !sameKeys(strong.key,scopedBatchRuleIndex) || strong.partialFilterExpression?.scopeVersion!==2)throw new Error('Scoped academic rule uniqueness could not be verified. Legacy index was retained.');
 const legacy=indexes.filter(legacyBatchRuleIndex),retired=[];
 if(retireLegacyIndex){
  for(const index of legacy){await BatchRule.collection.dropIndex(index.name);retired.push(index.name);}
 }
 return {scopedIndex:scopedBatchRuleIndexName,legacyIndexPresent:legacy.length>0,retired};
}
