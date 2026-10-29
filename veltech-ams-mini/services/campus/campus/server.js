import {ExamPublicationLock} from './models/exam-publication-lock.js';
import {CampusDocument} from './models/campus-documents.js';
import {PublishingDirectory} from './models/publishing-directory.js';
import {registerCampusDocuments} from './routes/campus-documents.js';
import {registerPublishingOptions,publishingScopeGuard} from './routes/publishing-directory.js';
import {duplicateKey} from './security.js';
import {CampusPost,Placement} from './models.js';
import {AppPolicy} from './models/app-policy.js';
import {Schedule} from './models/schedules.js';
import {registerAppRelease} from './routes/app-release.js';
import {registerSchedules} from './routes/schedules.js';
import {AdminAccount,AdminLoginEvent,AccountAccessEvent} from './models/admin-records.js';
import {AdminMessage,AdminDelivery,ModerationAction} from './models/admin-messages.js';
import {EventStaffGrant} from './models/event-staff.js';
import {ExamSeatingRelease,ExamSeatingEntry} from './models/exam-seating.js';
import {ExamPlan} from './models/exam-plans.js';
import {FacultyExam} from './models/faculty-exams.js';
import {registerExamPlans} from './routes/exam-plans.js';
import {registerExamSeating} from './routes/exam-seating.js';
import {registerAdminMessages} from './routes/admin-messages.js';
import {registerAdminCommunity} from './routes/admin-community.js';
import {processAdminDeliveries} from './services/admin-messages.js';
import {registerEventOperations} from './routes/event-operations.js';
import {registerAdminDirectory} from './routes/admin-directory.js';
import {registerBatchRules} from './routes/batch-rules.js';
import {adminAccessGuard} from './services/admin-access.js';
import express from 'express';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'node:path';
import fs from 'node:fs';
import {fileURLToPath} from 'node:url';
import {createCampusTrafficControls} from './services/traffic-controls.js';
import User from '../models/User.js';
import Follow from '../models/Follow.js';
import Event from '../models/Event.js';
import Registration from '../models/EventRegistration.js';
import {Session,AcademicLink} from './models.js';
import {fail} from './security.js';
import {academicClient} from './services/academic.js';
import {razorpayProvider} from './services/payment.js';
import {registerAuth} from './routes/auth.js';
import {sessionMiddleware} from './services/sessions.js';
import {registerActivity} from './routes/activity.js';
import {registerAcademics} from './routes/academics.js';
import {registerEvents} from './routes/events.js';
import {registerSocial} from './routes/social.js';
import {registerPlacements} from './routes/placements.js';
import {registerManagement} from './routes/management.js';
import {registerIdentity} from './routes/identity.js';
import {registerMedia} from './routes/media.js';
import {registerMediaSocial,initializeMediaSocialIndexes,expireAndArchiveStories} from './routes/media-social.js';
import {registerCommunityExtras} from './routes/community-extra.js';
import {registerRecommendations} from './routes/recommendations.js';
import {registerEventExtras} from './routes/event-extra.js';
import {initializeEventExtraModels} from './models/event-extra.js';
import {processEventReceipts,processEventReminders} from './services/event-reminders.js';
import {IdentityChallenge,IdentityProof} from './models/identity.js';
import {CampusMedia} from './services/media-store.js';
import {createMailProvider} from './services/mail.js';
import {registerPortalLogin} from './routes/portal-login.js';
import {registerDownloads} from './routes/downloads.js';
import {registerForms} from './routes/forms.js';
import {registerCommunityReports} from './routes/community-reports.js';
import {registerFacultyExams} from './routes/faculty-exams.js';
import {initializeFormModels} from './form-models.js';
import {registerAcademicCalendar} from './routes/academic-calendar.js';
import {AcademicCalendarEntry} from './models/academic-calendar.js';
import {registerTimetableRooms} from './routes/timetable-rooms.js';
import {TimetableRoomOverride} from './models/timetable-room.js';
import {registerNotifications,initializeNotificationModels} from './routes/notifications.js';
import {registerAppFeedback} from './routes/app-feedback.js';
import {AppFeedback} from './models/app-feedback.js';

export function createCampusApp(options={}) {
  const production=options.production ?? process.env.NODE_ENV==='production';
  const cookieSecure=options.cookieSecure ?? (process.env.CAMPUS_COOKIE_SECURE===undefined?production:process.env.CAMPUS_COOKIE_SECURE==='true');
  const config={production,cookieSecure,mail:createMailProvider(),bridgeEnabled:process.env.CAMPUS_BRIDGE_ENABLED==='true',origins:(process.env.CAMPUS_ORIGINS || 'http://localhost:5173,http://127.0.0.1:5173,http://localhost:4100,http://127.0.0.1:4100').split(','),linkKey:process.env.CAMPUS_LINK_KEY,webhookSecret:process.env.RAZORPAY_WEBHOOK_SECRET,payment:razorpayProvider(process.env.RAZORPAY_KEY_ID,process.env.RAZORPAY_KEY_SECRET),academic:academicClient(process.env.ACADEMIC_API_URL || 'http://127.0.0.1:8000/api/v1',process.env.CAMPUS_SERVICE_KEY),...options};
  if(production && !cookieSecure && config.origins.some(origin=>!['localhost','127.0.0.1','[::1]'].includes(new URL(origin).hostname))) throw new Error('HTTP session cookies are allowed only for localhost development origins. Use secure cookies for hosted deployment.');
  const app=express();app.disable('x-powered-by');
  if(process.env.CAMPUS_TRUST_PROXY){const trusted=process.env.CAMPUS_TRUST_PROXY.split(',').map(v=>v.trim());if(trusted.some(v=>!v || ['true','*','0.0.0.0/0','::/0'].includes(v)))throw new Error('Configure only the trusted proxy IP/subnet');app.set('trust proxy',trusted);}
  app.use((req,res,next)=>{res.set({'X-Content-Type-Options':'nosniff','Referrer-Policy':'same-origin','X-Frame-Options':'DENY'});if(req.path.startsWith('/api/')) res.set('Cache-Control','no-store');next();});
  app.use('/api/campus/payments/webhook',express.raw({type:'application/json',limit:'256kb'}));
  app.use('/api/campus/academics/import',express.json({limit:'6mb'}));
  app.use('/api/campus/faculty-exams',express.json({limit:'4mb'}));
  app.use('/api/campus/exam-plans',express.json({limit:'4mb'}));
  app.use(express.json({limit:'1mb'}));
  const router=express.Router();
  config.trafficControls=createCampusTrafficControls({production,loginLimit:options.loginLimit,identityRateLimit:options.identityRateLimit});
  config.auth=(req,_res,next)=>{if(!req.user || req.user.isActive===false || !req.session) fail(401,'Sign in to your campus account');next();};
  router.use(sessionMiddleware(config));
  router.use(adminAccessGuard);
  router.use(publishingScopeGuard);
  router.use(config.trafficControls.general);
  router.use('/portal',config.trafficControls.portal);
  router.use('/login',config.trafficControls.login);
  router.use('/portal/sign-in',config.trafficControls.login);
  registerNotifications(router,config);
  registerAppFeedback(router,config);
  router.get('/health',async(_req,res)=>{await mongoose.connection.db.command({ping:1});res.json({status:'ok',database:'connected'});});
  registerPublishingOptions(router,config);registerCampusDocuments(router,config);registerExamPlans(router,config);registerExamSeating(router,config);registerAdminMessages(router,config);registerAdminCommunity(router,config);registerEventOperations(router,config);registerAdminDirectory(router,config);registerBatchRules(router,config);registerAuth(router,config);registerIdentity(router,config);registerPortalLogin(router,config);registerMedia(router,config);registerAcademics(router,config);registerEvents(router,config);registerEventExtras(router,config);registerSocial(router,config);registerMediaSocial(router,config);registerCommunityExtras(router,config);registerCommunityReports(router,config);registerActivity(router,config);registerRecommendations(router,config);registerPlacements(router,config);registerManagement(router,config);registerForms(router,config);registerFacultyExams(router,config);
  registerAppRelease(router,{directory:config.apkDirectory});
  registerSchedules(router,config);
  registerAcademicCalendar(router,config);
  registerTimetableRooms(router,config);
  app.use('/api/campus',router);
  registerDownloads(router,{directory:options.downloadDirectory,dist:process.env.CAMPUS_WEB_DIST || path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../../../frontend/dist')});
  app.use('/api',(_req,res)=>res.status(404).json({message:'Endpoint not found'}));
  const dist=process.env.CAMPUS_WEB_DIST || path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../../../frontend/dist');
  app.get('/.well-known/assetlinks.json',async(_req,res)=>{
    const file=path.join(dist,'.well-known','assetlinks.json');
    try{
      const stat=await fs.promises.lstat(file);
      if(!stat.isFile() || stat.isSymbolicLink() || stat.size>65536)throw new Error('Invalid public association');
      const rows=JSON.parse(await fs.promises.readFile(file,'utf8'));
      if(!Array.isArray(rows) || !rows.length || rows.length>10)throw new Error('Invalid public association');
      const associations=rows.map(row=>{
        const target=row?.target,fingerprints=target?.sha256_cert_fingerprints;
        if(!Array.isArray(row?.relation) || !row.relation.includes('delegate_permission/common.handle_all_urls') || target?.namespace!=='android_app' || typeof target.package_name!=='string' || !/^[a-z][a-z0-9_]*(?:\.[a-z][a-z0-9_]*)+$/.test(target.package_name) || !Array.isArray(fingerprints) || !fingerprints.length || fingerprints.length>5 || fingerprints.some(v=>typeof v!=='string' || !/^[a-f0-9]{2}(?::[a-f0-9]{2}){31}$/i.test(v)))throw new Error('Invalid public association');
        return {relation:['delegate_permission/common.handle_all_urls'],target:{namespace:'android_app',package_name:target.package_name,sha256_cert_fingerprints:fingerprints}};
      });
      res.set('Cache-Control','public, max-age=3600').json(associations);
    }catch(error){res.status(error.code==='ENOENT'?404:503).json({message:error.code==='ENOENT'?'Android domain association is not configured.':'Android domain association is unavailable.'});}
  });
  if(fs.existsSync(path.join(dist,'index.html'))) {app.use(express.static(dist));app.get('/{*path}',(_req,res)=>res.sendFile(path.join(dist,'index.html')));}
  app.use((error,_req,res,_next)=>{
    const status=error.status || (duplicateKey(error)?409:error.name==='ValidationError'?400:500);
    if(Number.isInteger(error.retryAfter) && error.retryAfter>0 && error.retryAfter<=3600)res.set('Retry-After',String(error.retryAfter));
    if(status>=500) console.error('Campus API error:',error.name);
    res.status(status).json({message:status===500?'The request could not be completed. Please retry.':duplicateKey(error)?'This record already exists':error.message});
  });
  return app;
}
if(process.argv[1] && path.resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  dotenv.config({path:process.env.CAMPUS_ENV_FILE || path.resolve(path.dirname(fileURLToPath(import.meta.url)),'.env')});
  const mongoUri=process.env.MONGODB_URI;if(!mongoUri) throw new Error('Set MONGODB_URI in campus/.env');
  await mongoose.connect(mongoUri);
  // Enforce uniqueness before accepting registrations or account links.
  await Promise.all([User.init(),Event.init(),Registration.init(),Session.init(),AcademicLink.init(),IdentityChallenge.init(),IdentityProof.init(),CampusMedia.init(),Follow.init(),AcademicCalendarEntry.init(),TimetableRoomOverride.init(),AppFeedback.init(),initializeNotificationModels()]);
  // Initialize absent counters for pre-existing events without changing their source fields.
  for(const e of await Event.collection.find({registrationCount:{$exists:false}}).toArray()) {
    const count=await Registration.countDocuments({event:e._id,status:{$in:['registered','attended','payment_pending']}});
    await Event.updateOne({_id:e._id,registrationCount:{$exists:false}},{$set:{registrationCount:count}});
  }
  await Promise.all([CampusDocument.init(),PublishingDirectory.init(),ExamPublicationLock.init(),ExamPlan.init(),FacultyExam.init(),AccountAccessEvent.init(),CampusPost.init(),Placement.init(),AppPolicy.init(),Schedule.init(),AdminAccount.init(),AdminLoginEvent.init(),AdminMessage.init(),AdminDelivery.init(),ModerationAction.init(),EventStaffGrant.init(),ExamSeatingRelease.init(),ExamSeatingEntry.init()]);
  await initializeMediaSocialIndexes();await initializeEventExtraModels();await initializeFormModels();
  const mail=createMailProvider();let jobsRunning=false;
  const jobs=async()=>{if(jobsRunning)return;jobsRunning=true;try{await processAdminDeliveries({mail});await expireAndArchiveStories();if(mail.configured){await processEventReceipts({mail});await processEventReminders({mail});}}catch(error){console.error('Campus scheduled job failed:',error.name);}finally{jobsRunning=false;}};
  const timer=setInterval(jobs,60000);timer.unref();void jobs();
  const app=createCampusApp({mail});app.listen(Number(process.env.CAMPUS_PORT || 4100),process.env.CAMPUS_HOST || '127.0.0.1',()=>console.log('veltech-ams-mini API started'));
}
