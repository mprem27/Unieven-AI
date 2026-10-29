import {AdminAccount,AdminLoginEvent,AccountAccessEvent} from '../models/admin-records.js';
import {adminPermissionsFor,isAdminOwner} from '../../../../shared/admin-access.mjs';
export async function syncAdminAccount(user){
 if(user?.role!=='admin')return null;
 return AdminAccount.findOneAndUpdate({user:user._id},{$set:{permissions:adminPermissionsFor(user),actions:user.adminActionPermissions,accessRole:user.adminAccessRole || 'custom',owner:isAdminOwner(user),active:user.isActive!==false,createdBy:user.adminCreatedBy}},{upsert:true,returnDocument:'after'});
}
export async function recordAdminAccess(user,action,session){
 if(user && ['student','faculty','admin'].includes(user.role))await AccountAccessEvent.create({user:user._id,role:user.role,action});
 if(user?.role!=='admin')return;
 await syncAdminAccount(user);await AdminLoginEvent.create({user:user._id,action,...(session?{session}:{})});
 if(action==='login')await AdminAccount.updateOne({user:user._id},{$set:{lastLoginAt:new Date()}});
}
