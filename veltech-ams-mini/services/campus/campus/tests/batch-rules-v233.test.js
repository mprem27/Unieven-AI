import test,{before,after,beforeEach} from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import bcrypt from 'bcrypt';
import {createCampusApp} from '../server.js';
import User from '../../models/User.js';
import {Session,Audit} from '../models.js';
import * as model from '../models/batch-rule.js';
const {BatchRule}=model;
const origin='http://localhost:5173';
let server,base,admin,student;
const fixture=()=>({batch:'2023-2027',programme:'B.Tech',regulation:'VTR UGE 2021',departmentScope:'department',department:'CSE',factor:9,offset:0,sourceUrl:'https://www.veltech.edu.in/fixture.pdf',sourceClause:'Fictional isolated test clause',confirmed:true});
before(async()=>{
 await mongoose.connect(`mongodb://127.0.0.1:27017/campus_test_batch_rules_v233_${process.pid}`);
 await Promise.all([User.init(),Session.init(),BatchRule.init()]);
 server=createCampusApp({origins:[origin],loginLimit:1000}).listen(0);await new Promise(resolve=>server.once('listening',resolve));base=`http://127.0.0.1:${server.address().port}/api/campus`;
});
after(async()=>{if(server)await new Promise(resolve=>server.close(resolve));await mongoose.connection.dropDatabase();await mongoose.disconnect();});
beforeEach(async()=>{
 await Promise.all([User.deleteMany({}),Session.deleteMany({}),BatchRule.deleteMany({}),Audit.deleteMany({})]);
 const password=await bcrypt.hash('Fixture-password-42',4);
 admin=await User.create({username:'fixture-admin',email:'admin@example.test',password,name:'Fixture Admin',role:'admin',campusRole:'admin'});
 student=await User.create({username:'fixture-student',email:'student@example.test',password,name:'Fixture Student'});
});
async function call(path,method='GET',body,cookie='',csrf=''){
 const response=await fetch(base+path,{method,headers:{Origin:origin,'Content-Type':'application/json',...(cookie?{Cookie:cookie}:{}),...(csrf?{'X-CSRF-Token':csrf}:{})},body:method==='GET'?undefined:JSON.stringify(body)});
 return {status:response.status,body:await response.json(),cookie:response.headers.getSetCookie().map(value=>value.split(';')[0]).join('; ')};
}
const login=user=>call('/login','POST',{identity:user.email,password:'Fixture-password-42'});
const write=(body,signed)=>call('/academic-rules','POST',body,signed.cookie,signed.body.csrfToken);

test('scoped writes reject missing scope, malformed evidence and extra fields without saving',async()=>{
 const signed=await login(admin);
 for(const change of [{departmentScope:undefined},{departmentScope:'department',department:''},{departmentScope:'all',department:'CSE'},{factor:'9'},{offset:null},{sourceUrl:'https://www.veltech.edu.in:444/fixture.pdf'},{confirmed:false},{regulation:''},{scopeVersion:2}]){
  const result=await write({...fixture(),...change},signed);assert.equal(result.status,400,JSON.stringify(change));
 }
 assert.equal(await BatchRule.countDocuments(),0);
});
test('same cohort can retain separate departments and regulations with exact edit identities',async()=>{
 const signed=await login(admin),one=await write(fixture(),signed),two=await write({...fixture(),department:'ECE',factor:10},signed),three=await write({...fixture(),regulation:'VTR UGE 2025',factor:10},signed);
 for(const result of [one,two,three])assert.equal(result.status,200,JSON.stringify(result.body));
 assert.equal(await BatchRule.countDocuments(),3);assert.equal(one.body.scopeVersion,2);assert.equal(one.body.departmentScope,'department');
 const edited=await write({...fixture(),id:one.body.id,departmentScope:'all',department:'',sourceClause:'Reviewed fixture scope'},signed);assert.equal(edited.status,200);assert.equal(edited.body.id,one.body.id);assert.equal(await BatchRule.countDocuments(),3);
 const read=await call('/academic-rules','GET',undefined,signed.cookie);assert.equal(read.body.rules.length,3);assert.equal(read.body.rules.find(row=>row.id===two.body.id).department,'ECE');
 assert.equal(await Audit.countDocuments({action:'academic-rule.save'}),4);
});
test('academic rules retain authentication, administrator, CSRF, deletion and audit boundaries',async()=>{
 assert.equal((await call('/academic-rules')).status,401);
 const learner=await login(student),owner=await login(admin);
 assert.equal((await write(fixture(),learner)).status,403);
 assert.equal((await call('/academic-rules','POST',fixture(),owner.cookie)).status,403);
 const saved=await write(fixture(),owner);assert.equal(saved.status,200);
 assert.equal((await call('/academic-rules/'+saved.body.id,'DELETE',{},learner.cookie,learner.body.csrfToken)).status,403);
 assert.equal((await call('/academic-rules/'+saved.body.id,'DELETE',{},owner.cookie)).status,403);
 assert.equal((await call('/academic-rules/'+saved.body.id,'DELETE',{},owner.cookie,owner.body.csrfToken)).status,200);
 assert.equal(await BatchRule.countDocuments(),0);assert.equal(await Audit.countDocuments({action:'academic-rule.delete'}),1);
});
test('old unique index keeps legacy records readable and blocks new scope safely until explicit migration',async()=>{
 assert.equal(typeof model.migrateBatchRuleIndexes,'function');
 await BatchRule.collection.createIndex({batch:1,programmeKey:1},{unique:true,name:'batch_1_programmeKey_1'});
 const legacy={...fixture(),programmeKey:'btech',verifiedAt:new Date('2026-10-21'),verifiedBy:admin._id};delete legacy.confirmed;delete legacy.department;delete legacy.departmentScope;
 const inserted=await BatchRule.collection.insertOne(legacy),signed=await login(admin);
 const read=await call('/academic-rules','GET',undefined,signed.cookie);assert.equal(read.body.rules[0].legacy,true);assert.equal(read.body.rules[0].id,String(inserted.insertedId));
 const blocked=await write(fixture(),signed);assert.equal(blocked.status,409);assert.match(blocked.body.message,/legacy.*index.*migration/i);assert.equal(await BatchRule.countDocuments(),1);
 const checked=await model.migrateBatchRuleIndexes();assert.equal(checked.legacyIndexPresent,true);assert.deepEqual(checked.retired,[]);
 assert.ok((await BatchRule.collection.indexes()).some(row=>row.name==='batch_1_programmeKey_1'));
 await assert.rejects(()=>model.migrateBatchRuleIndexes({retireLegacyIndex:'true'}));
 assert.ok((await BatchRule.collection.indexes()).some(row=>row.name==='batch_1_programmeKey_1'));
 const migrated=await model.migrateBatchRuleIndexes({retireLegacyIndex:true});assert.deepEqual(migrated.retired,['batch_1_programmeKey_1']);
 const indexes=await BatchRule.collection.indexes();assert.ok(indexes.some(row=>row.name==='academic_rule_scope_unique' && row.unique));assert.ok(!indexes.some(row=>row.name==='batch_1_programmeKey_1'));
 assert.equal(await BatchRule.countDocuments(),1);assert.ok(await BatchRule.findById(inserted.insertedId));
 assert.equal((await write(fixture(),signed)).status,200);assert.equal((await write({...fixture(),department:'ECE'},signed)).status,200);assert.equal(await BatchRule.countDocuments(),3);
});
test('migration never retires the old protection if creating the stronger index fails',async()=>{
 assert.equal(typeof model.migrateBatchRuleIndexes,'function');
 await BatchRule.collection.createIndex({batch:1,programmeKey:1},{unique:true,name:'batch_1_programmeKey_1'});
 await BatchRule.collection.dropIndex('academic_rule_scope_unique');
 await BatchRule.collection.createIndex({batch:1},{name:'academic_rule_scope_unique'});
 try{
  await assert.rejects(()=>model.migrateBatchRuleIndexes({retireLegacyIndex:true}));
  const indexes=await BatchRule.collection.indexes();assert.ok(indexes.some(row=>row.name==='batch_1_programmeKey_1' && row.unique));
 }finally{
  await BatchRule.collection.dropIndex('academic_rule_scope_unique');await model.migrateBatchRuleIndexes({retireLegacyIndex:true});
 }
});
