import Notification from '../../models/Notification.js';
import {NotificationState} from '../models/notification-state.js';
import {listInbox} from '../services/notifications.js';
import {fail,validateId} from '../security.js';

export async function initializeNotificationModels(){await Promise.all([Notification.init(),NotificationState.init()]);}
export function registerNotifications(router,config){
  const inbox=async(req,res)=>res.json(await listInbox(req.user));
  router.get('/notifications/inbox',config.auth,inbox);
  router.get('/social/notifications',config.auth,inbox);
  for(const prefix of ['/notifications','/social/notifications']){
    router.patch(`${prefix}/read-all`,config.auth,async(req,res)=>{const result=await Notification.updateMany({toUser:req.user._id,isRead:false,dismissedAt:null},{$set:{isRead:true}});res.json({success:true,modified:result.modifiedCount});});
    router.patch(`${prefix}/:id/read`,config.auth,async(req,res)=>{validateId(req.params.id);const result=await Notification.updateOne({_id:req.params.id,toUser:req.user._id,dismissedAt:null},{$set:{isRead:true}});if(!result.matchedCount)fail(404,'Notification not found');res.json({success:true,id:req.params.id,read:true});});
    router.delete(`${prefix}/:id`,config.auth,async(req,res)=>{validateId(req.params.id);const result=await Notification.updateOne({_id:req.params.id,toUser:req.user._id,dismissedAt:null},{$set:{dismissedAt:new Date()}});if(!result.matchedCount)fail(404,'Notification not found');res.json({success:true});});
  }
}
