import test,{before,after} from 'node:test';
import assert from 'node:assert/strict';
import {registerSocial} from '../routes/social.js';
import {registerMediaSocial} from '../routes/media-social.js';
import {harness,member} from './support/social-harness.js';
import {CampusMedia,mediaUrl} from '../services/media-store.js';

let app,owner;
before(async()=>{
 app=await harness('overlay_v16',(router,config)=>{registerSocial(router,config);registerMediaSocial(router,config);});
 owner=await member('overlay-owner');
});
after(async()=>app.close());

test('post, reel, story and private archive publish and read the same expanded overlay values',async()=>{
 const image=await CampusMedia.create({owner:owner._id,key:'overlay-image',mime:'image/png',kind:'image',size:30});
 const video=await CampusMedia.create({owner:owner._id,key:'overlay-video',mime:'video/webm',kind:'video',size:30});
 const overlay={overlayText:'Made on campus',textFont:'editorial',textStyle:'caption',filter:'ink',textX:0,textY:1,textSize:100,textColor:'#123456'};
 const call=(path,method='GET',body)=>app.call(path,{user:owner,method,body});
 const post=await call('/feed','POST',{...overlay,text:'A new campus project',image:mediaUrl(image._id)});
 assert.equal(post.status,201);
 const reel=await call('/reels','POST',{...overlay,caption:'A new campus reel',videoId:video.id});
 assert.equal(reel.status,201);
 const story=await call('/stories','POST',{...overlay,text:overlay.overlayText,type:'image',mediaId:image.id});
 assert.equal(story.status,201);
 const published=[(await call(`/feed/${post.body.id}`)).body,(await call('/reels')).body[0],(await call('/stories')).body[0]];
 for(const value of published)for(const [key,expected] of Object.entries(overlay)){
  if(key==='overlayText' && value.type==='image')assert.equal(value.text,expected);
  else assert.equal(value[key],expected,`${key} changed during publication`);
 }
 const archived=await call(`/stories/${story.body.id}/archive`,'POST',{});assert.equal(archived.status,200);
 const archive=(await call('/stories/archive')).body[0];
 for(const key of ['textFont','textStyle','filter','textX','textY','textSize','textColor'])assert.equal(archive[key],overlay[key]);
});
