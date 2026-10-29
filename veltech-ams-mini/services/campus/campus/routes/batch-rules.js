import {BatchRule,migrateBatchRuleIndexes} from '../models/batch-rule.js';
import {Audit} from '../models.js';
import {campusRole} from '../policy.js';
import {duplicateKey,fail,validateId} from '../security.js';
import {normalizeBatch,normalizeProgramme,normalizeRegulation,normalizeDepartment,officialRegulationUrl,validPercentageFormula,legacyPercentagePolicy} from '../../../../shared/percentage-rules.mjs';
const present=row=>({id:String(row._id),batch:row.batch,programme:row.programme,regulation:row.regulation,scopeVersion:row.scopeVersion,departmentScope:row.departmentScope,department:row.department || '',legacy:!!legacyPercentagePolicy(row),factor:row.factor,offset:row.offset,sourceUrl:row.sourceUrl,sourceClause:row.sourceClause,verifiedAt:row.verifiedAt});
const text=(value,max)=>typeof value==='string' && value.trim() && value.length<=max && !/[\u0000-\u001f\u007f]/.test(value)?value.trim():fail(400,'Enter complete academic rule details.');
const admin=user=>{if(campusRole(user)!=='admin')fail(403,'College administrator access is required.');};
export function registerBatchRules(router,config){
 router.get('/academic-rules',config.auth,async(_req,res)=>res.json({rules:(await BatchRule.find({}).sort({batch:-1,programme:1,regulation:1,department:1}).limit(1000).lean()).map(present)}));
 router.post('/academic-rules',config.auth,async(req,res)=>{
  admin(req.user);const b=req.body;
  if(!b || typeof b!=='object' || Array.isArray(b) || Object.keys(b).some(key=>!['id','batch','programme','regulation','departmentScope','department','factor','offset','sourceUrl','sourceClause','confirmed'].includes(key)))fail(400,'Use the academic rule fields.');
  const batch=normalizeBatch(text(b.batch,25)),programme=text(b.programme,100),regulation=text(b.regulation,150),sourceClause=text(b.sourceClause,1000),sourceUrl=text(b.sourceUrl,1500);
  const match=batch.match(/^(20\d{2})-(20\d{2})$/);
  if(!match || +match[2]<=+match[1] || +match[2]-+match[1]>6)fail(400,'Enter the full admission–completion batch, such as 2023-2027.');
  if(!validPercentageFormula(b))fail(400,'Enter a valid numeric multiplier and offset.');
  const url=officialRegulationUrl(sourceUrl);
  if(!url || b.confirmed!==true)fail(400,'Confirm the formula and its scope against the official Vel Tech source.');
  if(!['all','department'].includes(b.departmentScope))fail(400,'Choose the department scope recorded in the official source.');
  let department='';
  if(b.departmentScope==='department')department=text(b.department,120);
  else if(b.department!==undefined && (typeof b.department!=='string' || b.department.trim()))fail(400,'An all-departments rule cannot name a specific department.');
  const programmeKey=normalizeProgramme(programme),regulationKey=normalizeRegulation(regulation),departmentKey=b.departmentScope==='all'?'*':normalizeDepartment(department);
  if(!programmeKey || !regulationKey || !departmentKey)fail(400,'Enter a valid programme, regulation and department scope.');
  const id=b.id===undefined?null:validateId(b.id);
  if(id && !await BatchRule.exists({_id:id}))fail(404,'Academic rule not found.');
  let indexState;
  try{indexState=await migrateBatchRuleIndexes();}catch{fail(503,'Academic rule indexes need administrator review before a policy can be saved. Existing rules remain readable.');}
  let saved;
  try{
   saved=await BatchRule.findOneAndUpdate(id?{_id:id}:{batch,programmeKey,regulationKey,departmentKey,scopeVersion:2},{$set:{batch,programme,programmeKey,regulation,regulationKey,scopeVersion:2,departmentScope:b.departmentScope,department,departmentKey,factor:b.factor,offset:b.offset,sourceUrl:url,sourceClause,verifiedAt:new Date(),verifiedBy:req.user._id}},{upsert:!id,returnDocument:'after',runValidators:true});
  }catch(error){
   if(duplicateKey(error))fail(409,indexState.legacyIndexPresent?'The legacy batch/programme index blocks this additional scope. Ask the deployment administrator to run the documented index migration; existing rules were retained.':'An academic rule already exists for that exact scope. Edit the existing rule.');
   throw error;
  }
  if(!saved)fail(404,'Academic rule not found.');
  await Audit.create({actor:req.user._id,action:'academic-rule.save',target:saved.id,details:`${batch} ${programme} ${regulation} ${b.departmentScope==='all'?'all departments':department}`});res.json(present(saved));
 });
 router.delete('/academic-rules/:id',config.auth,async(req,res)=>{admin(req.user);const row=await BatchRule.findByIdAndDelete(validateId(req.params.id));if(!row)fail(404,'Academic rule not found.');await Audit.create({actor:req.user._id,action:'academic-rule.delete',target:row.id});res.json({deleted:true});});
}
