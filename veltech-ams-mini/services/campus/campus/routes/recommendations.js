import {CampusPost} from '../models.js';
import Post from '../../models/Post.js';
import Reel from '../../models/Reel.js';
import User from '../../models/User.js';
import {acceptedAuthors,canReadContent,hasId,AUTHOR_FIELDS,authorView} from '../services/community-policy.js';
import {RECOMMENDATION_MODEL,RECOMMENDATION_DESCRIPTION,rankCandidates,contentTokens,refreshKeyQuery,refreshWeight} from '../services/recommendations.js';
import {postView} from './community-extra.js';
import {reelView} from './media-social.js';
import {fail,validateId} from '../security.js';

export function registerRecommendations(router,config) {
  router.get('/recommendations',config.auth,async(req,res)=>{
    const refreshKey=refreshKeyQuery(req.query);
    const kind=req.query.kind;if(kind && !['post','reel'].includes(kind))fail(400,'Choose post or reel recommendations');
    const limit=req.query.limit===undefined?30:Number(req.query.limit);if(!Number.isInteger(limit)||limit<1||limit>50)fail(400,'Choose a recommendation limit from 1 to 50');
    const eventId=req.query.eventId;if(eventId)validateId(eventId);
    const following=await acceptedAuthors(req.user);
    const [campus,legacy,reels]=await Promise.all([
      kind==='reel'||eventId?[]:CampusPost.find({isArchived:{$ne:true}}).sort({createdAt:-1}).limit(200).populate('user',AUTHOR_FIELDS).populate('comments.user',AUTHOR_FIELDS),
      kind==='reel'||eventId?[]:Post.find({isArchived:{$ne:true}}).sort({createdAt:-1}).limit(200).populate('user',AUTHOR_FIELDS).populate({path:'comments',populate:{path:'user',select:AUTHOR_FIELDS}}),
      kind==='post'?[]:Reel.find({isArchived:{$ne:true},...(eventId?{eventId}:{})}).sort({createdAt:-1}).limit(200).populate('user',AUTHOR_FIELDS).populate({path:'comments',populate:{path:'user',select:AUTHOR_FIELDS}})
    ]);
    const candidates=[],interests=new Set();
    for(const [type,items,isLegacy] of [['post',campus,false],['post',legacy,true],['reel',reels,false]])for(const source of items) {
      if(!canReadContent(source,req.user,following))continue;
      const text=source.text || source.caption || '',tokens=contentTokens(`${text} ${source.category || ''} ${(source.hashtags || []).join(' ')}`);
      const liked=hasId(source.likes,req.user._id),saved=type==='reel'?hasId(req.user.savedReels,source._id):isLegacy?hasId(req.user.savedPosts,source._id):hasId(source.savedBy,req.user._id);
      if(liked||saved)for(const token of tokens)interests.add(token);
      candidates.push({kind:type,item:type==='reel'?reelView(source,req.user):postView(source,req.user,{legacy:isLegacy}),authorId:String(source.user._id),department:source.user.socialDepartment || '',tokens,createdAt:source.createdAt,likes:source.likes?.length || 0,comments:source.comments?.length || 0,views:type==='reel'?source.views:source.views?.length || 0,viewed:hasId(source.viewedBy || source.views,req.user._id)});
    }
    const items=rankCandidates(candidates,{userId:req.user.id,following,interests,department:req.user.socialDepartment,limit,refreshKey});
    const people=await User.find({_id:{$nin:[req.user._id,...following]},isPrivate:false,isActive:{$ne:false}}).select(AUTHOR_FIELDS).sort({createdAt:-1}).limit(60).lean();
    const sharedDepartment=person=>!!req.user.socialDepartment && person.socialDepartment===req.user.socialDepartment;
    people.sort((a,b)=>Number(sharedDepartment(b))-Number(sharedDepartment(a)) || refreshWeight(refreshKey,b._id)-refreshWeight(refreshKey,a._id));
    res.json({model:RECOMMENDATION_MODEL,description:RECOMMENDATION_DESCRIPTION,items,suggestedMembers:people.slice(0,6).map(person=>({...authorView(person),reasons:[sharedDepartment(person)?'Shared social profile department':'Discover a campus member']}))});
  });
}
