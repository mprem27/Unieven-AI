import test from 'node:test';
import assert from 'node:assert/strict';
import {notificationCategory,notificationLink} from '../src/lib/notifications.js';
test('real seating campaign defaults classify as academic and open the examinations section',()=>{
 const update={source:'social',type:'exam_update',category:'system',link:'/notifications',title:'Exam seating: Mid term'};
 assert.equal(notificationCategory(update),'academic');assert.equal(notificationLink(update),'/academics?section=examinations');
});
test('campus messages stay out of community conversations and explicit exam document destinations survive',()=>{
 assert.equal(notificationCategory({source:'social',type:'campus_message',category:'system'}),'app');
 assert.equal(notificationCategory({source:'social',type:'placement_update',category:'system'}),'app');
 assert.equal(notificationLink({type:'exam_update',link:'/schedules'}),'/schedules');
 assert.equal(notificationLink({type:'comment',postId:'post'}),'/community/posts/post');
});
