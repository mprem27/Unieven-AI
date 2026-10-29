import test from 'node:test';
import assert from 'node:assert/strict';
import {ownActivityExport} from '../src/lib/data-downloads.js';
test('community data export excludes author identity, credentials, private attachments and source student records',()=>{
 const source={posts:[{id:'own',text:'My project',createdAt:'2026-10-16',author:{email:'private'},password:'secret',studentId:'official',proofUrl:'/private',comments:[{text:'another student'}]}],reels:[{id:'reel',caption:'Demo',video:'blob:private-session'}],profile:{name:'Official student'}};
 const result=ownActivityExport(source,'2026-10-16');assert.equal(result.posts[0].text,'My project');assert.doesNotMatch(JSON.stringify(result),/official|secret|private|another student|profile/);
});
