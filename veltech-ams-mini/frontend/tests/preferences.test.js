import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizePreferences} from '../src/lib/preferences.js';
test('app settings preserve meaningful choices and reject invalid stored options',()=>{
 const settings=normalizePreferences({theme:'dark',textSize:'large',motion:'reduced',refreshSeconds:0,browserAlerts:true});
 assert.equal(settings.theme,'dark');assert.equal(settings.refreshSeconds,0);assert.equal(settings.browserAlerts,true);
 const malformed=normalizePreferences({theme:'bad',refreshSeconds:1,browserAlerts:'true'});
 assert.equal(malformed.theme,'light');assert.equal(malformed.refreshSeconds,60);assert.equal(malformed.browserAlerts,false);
});
test('social device settings accept only explicit supported values',()=>{
 const p=normalizePreferences({autoplayReels:false,showLikeCounts:false,recommendationMode:'following',shareProfileLinks:false});
 assert.equal(p.autoplayReels,false);assert.equal(p.showLikeCounts,false);assert.equal(p.recommendationMode,'following');assert.equal(p.shareProfileLinks,false);
 const invalid=normalizePreferences({autoplayReels:'false',recommendationMode:'tracking',showLikeCounts:0});
 assert.equal(invalid.autoplayReels,true);assert.equal(invalid.showLikeCounts,true);assert.equal(invalid.recommendationMode,'personalized');
});
test('home and opening animation choices are normalized without enabling background tracking',()=>{
 const value=normalizePreferences({showHomeReels:true,backgroundAnimation:false,openingAnimation:false});
 assert.equal(value.showHomeReels,true);assert.equal(value.backgroundAnimation,false);assert.equal(value.openingAnimation,false);
 const invalid=normalizePreferences({showHomeReels:'yes',backgroundAnimation:'no',openingAnimation:0});
 assert.equal(invalid.showHomeReels,false);assert.equal(invalid.backgroundAnimation,true);assert.equal(invalid.openingAnimation,true);
});
test('mobile page swipe can be disabled independently of animations',()=>{
 assert.equal(normalizePreferences({mobilePageSwipe:false}).mobilePageSwipe,false);
 assert.equal(normalizePreferences({}).mobilePageSwipe,true);
});
