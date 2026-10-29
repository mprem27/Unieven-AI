import {CampusPost} from '../models.js';
import {ModerationAction} from '../models/admin-messages.js';
import Post from '../../models/Post.js';
import Reel from '../../models/Reel.js';
import StoryArchive from '../../models/StoryArchive.js';
import {fail,validateId} from '../security.js';
import {AUTHOR_FIELDS,acceptedAuthors,canReadContent} from '../services/community-policy.js';
import {postView} from './community-extra.js';
import {reelView,storyView,expireAndArchiveStories} from './media-social.js';

const populate=(query,embedded=false)=>{
  query.populate('user',AUTHOR_FIELDS);
  return embedded?query.populate('comments.user',AUTHOR_FIELDS):query.populate({path:'comments',populate:{path:'user',select:AUTHOR_FIELDS}});
};
export function registerActivity(router,config) {
  router.get('/community/activity',config.auth,async(req,res)=>{
    const tab=req.query.tab ?? 'own';
    if(!['own','saved','liked','archive'].includes(tab))fail(400,'Choose own, saved, liked, or archive activity');
    const owner=req.user._id,archived=tab==='archive',base={isArchived:archived?true:{$ne:true}};
    const campusQuery={...base},postQuery={...base},reelQuery={...base};
    if(tab==='own'||archived){campusQuery.user=owner;postQuery.user=owner;reelQuery.user=owner;}
    else if(tab==='liked'){campusQuery.likes=owner;postQuery.likes=owner;reelQuery.likes=owner;}
    else {campusQuery.savedBy=owner;postQuery._id={$in:req.user.savedPosts || []};reelQuery._id={$in:req.user.savedReels || []};}
    if(archived)await expireAndArchiveStories();
    const [campus,original,reels,stories,accepted]=await Promise.all([
      populate(CampusPost.find(campusQuery).sort({createdAt:-1}).limit(100),true),
      populate(Post.find(postQuery).sort({createdAt:-1}).limit(100)),
      populate(Reel.find(reelQuery).sort({createdAt:-1}).limit(100)),
      archived?StoryArchive.find({user:owner}).sort({originalCreatedAt:-1}).limit(100).populate('user',AUTHOR_FIELDS):[],
      acceptedAuthors(req.user)
    ]);
    const visible=rows=>rows.filter(row=>canReadContent(row,req.user,accepted));
    const posts=[...visible(campus).map(row=>({...postView(row,req.user),isArchived:archived})),...visible(original).map(row=>({...postView(row,req.user,{legacy:true}),isArchived:archived}))].sort((a,b)=>new Date(b.createdAt)-new Date(a.createdAt)).slice(0,100);
    res.json({tab,posts,reels:visible(reels).map(row=>({...reelView(row,req.user),isArchived:archived})),stories:stories.map(row=>({...storyView(row,req.user,{archive:true}),isArchived:true}))});
  });
  router.patch('/community/activity/:kind/:id',config.auth,async(req,res)=>{
    const {kind,id}=req.params;validateId(id);
    if(!['post','reel'].includes(kind))fail(400,'Archive a post or reel; stories have their own archive controls');
    const body=req.body;
    if(!body||typeof body!=='object'||Array.isArray(body)||Object.keys(body).some(key=>key!=='archived')||typeof body.archived!=='boolean')fail(400,'Archive state must be true or false');
    const query={_id:id,user:req.user._id};
    let Model=kind==='reel'?Reel:CampusPost,item=await Model.findOne(query);
    if(!item&&kind==='post'){Model=Post;item=await Model.findOne(query);}
    if(!item)fail(404,'Your content was not found');
    if(!body.archived && (item.moderationLocked || await ModerationAction.exists({targetType:kind,targetId:id})))fail(403,'Content removed by moderation cannot be restored. Contact campus support.');
    const changed=await Model.updateOne({...query,...(!body.archived?{moderationLocked:{$ne:true}}:{})},{$set:{isArchived:body.archived}});
    if(!changed.matchedCount)fail(403,'This content cannot be restored. Contact campus support.');
    res.json({success:true,kind,id,archived:body.archived});
  });
}
