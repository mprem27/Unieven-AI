import test from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import {overlayInput,overlayView} from '../services/community-policy.js';
import Story from '../../models/Story.js';
import StoryArchive from '../../models/StoryArchive.js';
import Reel from '../../models/Reel.js';
import {OVERLAY_FONTS,OVERLAY_STYLES,MEDIA_FILTERS} from '../../../../shared/social-overlay.mjs';

test('new composer fonts, styles and filters survive API validation and DTO output',()=>{
 for(const textFont of ['serif','rounded','editorial'])for(const textStyle of ['shadow','caption','label'])for(const filter of ['fade','dramatic','bright','ink']){
  const input={overlayText:'Campus showcase',textFont,textStyle,filter,textX:0,textY:1,textSize:100,textColor:'#102a43'};
  const value=overlayInput(input);
  for(const key of Object.keys(input))assert.equal(overlayView(value)[key],input[key]);
 }
});

test('overlay validation rejects arbitrary CSS and non-finite placement values',()=>{
 for(const fields of [{textFont:'url(x)'},{textStyle:'arbitrary'},{filter:'blur(2px)'},{textColor:'#12345'},{textColor:'url(x)'},{textX:NaN},{textY:Infinity},{textSize:101},{textX:-0.01},{textY:1.01}]){
  assert.throws(()=>overlayInput(fields),error=>error.status===400,JSON.stringify(fields));
 }
});

test('story, archive and reel schemas preserve expanded overlays with the same size limit',async()=>{
 const user=new mongoose.Types.ObjectId();
 for(const Model of [Story,StoryArchive,Reel]){
  const fields={user,text:'Campus showcase',overlayText:'Campus showcase',video:'/api/campus/media/x',textFont:'editorial',textStyle:'caption',filter:'ink',textSize:100,textX:0,textY:1,originalCreatedAt:new Date(),expiredAt:new Date()};
  const document=new Model(fields);await document.validate();
  assert.equal(document.textFont,'editorial');assert.equal(document.textStyle,'caption');assert.equal(document.filter,'ink');
  await assert.rejects(new Model({...fields,textSize:101}).validate());
 }
});

test('all media schemas use the complete shared persisted overlay contract',()=>{
 for(const Model of [Story,StoryArchive,Reel]){
  assert.deepEqual(Model.schema.path('textFont').enumValues,[...OVERLAY_FONTS]);
  assert.deepEqual(Model.schema.path('textStyle').enumValues,[...OVERLAY_STYLES]);
  assert.deepEqual(Model.schema.path('filter').enumValues,['',...MEDIA_FILTERS]);
 }
});
