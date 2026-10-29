import mongoose from 'mongoose';
import {hasAdminAction} from '../../../../shared/admin-access.mjs';
import {canManageEvent,canCheckInEvent,campusRole} from '../policy.js';
import {EventStaffGrant} from '../models/event-staff.js';
import {fail} from '../security.js';
export async function eventCapability(user,event,capability){
 if(!user || user.isActive===false || !event)return false;
 if(campusRole(user)==='admin')return capability==='email'?hasAdminAction(user,'events','view') && hasAdminAction(user,'communications','create'):hasAdminAction(user,'events',capability==='view'?'view':'update');
 if(canManageEvent(user,event))return true;
 if(['qr','manual','view'].includes(capability) && canCheckInEvent(user,event))return true;
 if(!['faculty','admin'].includes(user.role))return false;
 if(!mongoose.Types.ObjectId.isValid(user._id ?? user.id))return false;
 const grant=await EventStaffGrant.findOne({event:event._id ?? event.id,user:user._id ?? user.id,active:true}).lean();
 if(!grant)return false;
 return capability==='view'?Object.values(grant.capabilities || {}).some(value=>value===true):grant.capabilities?.[capability]===true;
}
export function eventRulesInput(body){
 const result={};
 if(body.rules!==undefined){if(!Array.isArray(body.rules) || body.rules.length>20 || body.rules.some(value=>typeof value!=='string' || !value.trim() || value.length>300))fail(400,'Add up to 20 event rules, each under 300 characters.');result.rules=body.rules.map(value=>value.trim());}
 for(const [key,max] of Object.entries({registrationInstructions:2000,eligibility:1000,contactEmail:254}))if(body[key]!==undefined){if(typeof body[key]!=='string' || body[key].length>max)fail(400,'An event instruction is too long.');result[key]=body[key].trim();}
 if(result.contactEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(result.contactEmail))fail(400,'Enter a valid event contact email.');
 return result;
}
