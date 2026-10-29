import {duplicateKey} from '../security.js';
import {hasAdminPermission} from '../../../../shared/admin-access.mjs';
import User from '../../models/User.js';
import {TimetableRoomOverride} from '../models/timetable-room.js';
import {Audit} from '../models.js';
import {campusRole} from '../policy.js';
import {fail,validateId} from '../security.js';

const days=['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];
const selectorKeys=['department','courseCode','courseName','day','startTime','endTime','date','sourceRoom','faculty'];
const validTime=value=>typeof value==='string' && /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value);
export function canManageTimetableRooms(user){return !!user && user.isActive!==false && campusRole(user)==='admin' && hasAdminPermission(user,'calendar');}
function requireAdmin(user){if(!canManageTimetableRooms(user))fail(403,'An active college administrator is required to update rooms.');}
function text(value,label,max,required=false){
 if(typeof value!=='string' || value.length>max || /[\u0000-\u001f\u007f]/.test(value) || required && !value.trim())fail(400,`Enter a valid ${label} (up to ${max} characters).`);
 return value.trim();
}
function present(row){
 return {id:String(row._id),...Object.fromEntries(selectorKeys.map(key=>[key,row[key] || ''])),room:row.room,source:'administrator',updatedAt:row.updatedAt};
}
async function input(body){
 if(!body || typeof body!=='object' || Array.isArray(body) || Object.keys(body).some(key=>![...selectorKeys,'room'].includes(key)))fail(400,'Use the exact source timetable selector and room fields.');
 const department=text(body.department,'assigned academic department',120,true),courseCode=text(body.courseCode,'course code',40,true),courseName=text(body.courseName,'course name',180,true),day=text(body.day,'source weekday',12,true),room=text(body.room,'room',120,true),sourceRoom=text(body.sourceRoom,'source room',120),faculty=text(body.faculty,'source faculty',160),date=text(body.date,'source date',10);
 if(!/^[A-Za-z0-9][A-Za-z0-9._/-]*$/.test(courseCode) || !days.includes(day) || !validTime(body.startTime) || !validTime(body.endTime) || body.endTime<=body.startTime)fail(400,'Choose an exact course, source weekday and HH:mm interval with end after start.');
 if(date){const parsed=new Date(`${date}T12:00:00Z`);if(!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(+parsed) || parsed.toISOString().slice(0,10)!==date)fail(400,'Choose a valid source date or an empty recurring date.');}
 if(!await User.exists({department,isActive:{$ne:false}}))fail(400,'Choose an existing assigned academic department.');
 return {department,courseCode,courseName,day,startTime:body.startTime,endTime:body.endTime,date,sourceRoom,faculty,room};
}
export function registerTimetableRooms(router,config){
 router.get('/timetable-rooms',config.auth,async(req,res)=>{
  if(Object.keys(req.query).length)fail(400,'Room updates use your assigned academic department; target filters are not supported.');
  const department=req.user.department?.trim();
  const rows=department?await TimetableRoomOverride.find({department}).sort({day:1,startTime:1,courseCode:1}).lean():[];
  res.json({entries:rows.map(present),canManage:canManageTimetableRooms(req.user),source:'administrator'});
 });
 router.post('/timetable-rooms',config.auth,async(req,res)=>{
  requireAdmin(req.user);const value=await input(req.body),{room,...selector}=value;
  await TimetableRoomOverride.init();
  const update={$set:{room,updatedBy:req.user._id},$setOnInsert:{...selector,createdBy:req.user._id}};
  let row;
  try{row=await TimetableRoomOverride.findOneAndUpdate(selector,update,{upsert:true,returnDocument:'after',runValidators:true});}
  catch(error){if(!duplicateKey(error))throw error;row=await TimetableRoomOverride.findOneAndUpdate(selector,{$set:{room,updatedBy:req.user._id}},{returnDocument:'after',runValidators:true});if(!row)throw error;}
  await Audit.create({actor:req.user._id,action:'timetable-room.update',target:row.id,details:`${value.department} ${value.day} ${value.courseCode} ${value.startTime}`});
  res.json(present(row));
 });
 router.delete('/timetable-rooms/:id',config.auth,async(req,res)=>{
  requireAdmin(req.user);const id=validateId(req.params.id),row=await TimetableRoomOverride.findByIdAndDelete(id);
  if(!row)fail(404,'Room update not found.');
  await Audit.create({actor:req.user._id,action:'timetable-room.delete',target:id,details:`${row.department} ${row.day} ${row.courseCode} ${row.startTime}`});
  res.json({id,deleted:true});
 });
}
