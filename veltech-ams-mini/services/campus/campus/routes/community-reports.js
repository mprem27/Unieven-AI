import {CampusPost} from '../models.js';
import Post from '../../models/Post.js';
import Reel from '../../models/Reel.js';
import User from '../../models/User.js';
import {CommunityReport,REPORT_REASONS} from '../models/community-report.js';
import {AUTHOR_FIELDS,acceptedAuthors,canReadContent} from '../services/community-policy.js';
import {campusRole} from '../policy.js';
import {fail,validateId} from '../security.js';

async function reportable(type,id,user) {
  validateId(id);
  if(type==='user'){
    if(!await User.exists({_id:id,isActive:{$ne:false}}))fail(404,'Member not found');return;
  }
  let item=type==='reel'?await Reel.findOne({_id:id,isArchived:{$ne:true}}).populate('user',AUTHOR_FIELDS):await CampusPost.findOne({_id:id,isArchived:{$ne:true}}).populate('user',AUTHOR_FIELDS);
  if(type==='post'&&!item)item=await Post.findOne({_id:id,isArchived:{$ne:true}}).populate('user',AUTHOR_FIELDS);
  if(!item?.user)fail(404,'Content not found');
  if(!canReadContent(item,user,await acceptedAuthors(user)))fail(403,'This content is private');
}
const admin=(req,_res,next)=>{if(campusRole(req.user)!=='admin'||req.user.isActive===false)fail(403,'Administrator access required');next();};
const adminView=report=>({id:String(report._id),reporterId:String(report.reporter),targetType:report.targetType,targetId:String(report.targetId),reason:report.reason,details:report.details,status:report.status,createdAt:report.createdAt,reviewedAt:report.reviewedAt,reviewedBy:report.reviewedBy?String(report.reviewedBy):null,reviewNote:report.reviewNote});
export function registerCommunityReports(router,config) {
  router.post('/community/reports',config.auth,async(req,res)=>{
    const {targetType,targetId,reason,details=''}=req.body;
    if(!['post','reel','user'].includes(targetType)||!REPORT_REASONS.includes(reason))fail(400,'Choose a report target and reason');
    if(typeof details!=='string'||details.length>1000)fail(400,'Report details must be at most 1,000 characters');
    await reportable(targetType,targetId,req.user);
    const report=await CommunityReport.create({reporter:req.user._id,targetType,targetId,reason,details:details.trim()});
    res.status(201).json({id:report.id,status:report.status});
  });
  router.get('/community/reports/admin',config.auth,admin,async(req,res)=>{
    const status=req.query.status;if(status!==undefined&&!['pending','reviewed','dismissed'].includes(status))fail(400,'Choose a valid report status');
    const reports=await CommunityReport.find(status?{status}:{}).sort({createdAt:-1}).limit(100).lean();
    // Reviewers receive report metadata, never a copied private post or official student record.
    res.json(reports.map(adminView));
  });
  router.patch('/community/reports/admin/:id',config.auth,admin,async(req,res)=>{
    validateId(req.params.id);const {status,reviewNote=''}=req.body;
    if(!['reviewed','dismissed'].includes(status)||typeof reviewNote!=='string'||reviewNote.length>1000)fail(400,'Choose reviewed or dismissed and a note up to 1,000 characters');
    const report=await CommunityReport.findByIdAndUpdate(req.params.id,{$set:{status,reviewNote:reviewNote.trim(),reviewedBy:req.user._id,reviewedAt:new Date()}},{returnDocument:'after',runValidators:true});
    if(!report)fail(404,'Report not found');res.json({success:true,report:adminView(report)});
  });
}
