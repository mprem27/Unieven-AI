import test from 'node:test';
import assert from 'node:assert/strict';
import {MEDIA_FILTERS,OVERLAY_FONTS,OVERLAY_STYLES,OVERLAY_DEFAULTS,filterStyle,filterStyles,fontFamilies,normalizedOverlay,mediaStyle,overlayPlacements} from '../src/lib/social-overlay.js';

test('every publishable filter and font has a browser renderer',()=>{
 assert.deepEqual(Object.keys(filterStyles),MEDIA_FILTERS);
 assert.deepEqual(Object.keys(fontFamilies),OVERLAY_FONTS);
 for(const filter of MEDIA_FILTERS)assert.equal(typeof filterStyle(filter),'string');
 assert.equal(filterStyle('blur(999px)'),'none');
 assert.equal(filterStyle('constructor'),'none');
});

test('zero and edge overlay placement survive rendering instead of becoming centred',()=>{
 const zero=mediaStyle({textX:0,textY:0});
 assert.equal(zero.left,'0%');assert.equal(zero.top,'0%');assert.equal(zero.transform,'translate(-0%,-0%)');
 const edge=mediaStyle({textX:1,textY:1});
 assert.equal(edge.left,'100%');assert.equal(edge.top,'100%');assert.equal(edge.transform,'translate(-100%,-100%)');
});

test('old or malformed stored overlays render safe defaults while valid named colors survive',()=>{
 assert.deepEqual(normalizedOverlay({textFont:'unknown',textStyle:'bad',textSize:NaN,textX:Infinity,textY:'0',filter:'drop-shadow(0 0)',textColor:'#12345'}),OVERLAY_DEFAULTS);
 assert.equal(mediaStyle({textColor:'red'}).color,'red');
 assert.equal(normalizedOverlay({textSize:1000,textX:-3,textY:4}).textSize,100);
 assert.equal(mediaStyle({textSize:1000,textX:-3,textY:4}).left,'0%');
 for(const textStyle of OVERLAY_STYLES)assert.equal(normalizedOverlay({textStyle}).textStyle,textStyle);
});

test('nine placement presets remain distinct and within publishable bounds',()=>{
 assert.equal(overlayPlacements.length,9);
 assert.equal(new Set(overlayPlacements.map(x=>`${x.textX},${x.textY}`)).size,9);
 for(const placement of overlayPlacements){assert.ok(placement.textX>=0&&placement.textX<=1);assert.ok(placement.textY>=0&&placement.textY<=1);}
});
