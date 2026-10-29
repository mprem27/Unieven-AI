import test from 'node:test';
import assert from 'node:assert/strict';
import {buildAcademicReminders} from '../src/lib/reminder-policy.js';
const now='2026-10-26T09:00:00+05:30';
const exam={id:'exam',courseCode:'CS101',courseName:'Programming',date:'2026-11-10',startTime:'10:00',endTime:'11:00',publishedAt:'2026-10-01T09:00:00+05:30'};
const own={id:'release',exam,ownSeat:{vtuNumber:'VTU123',room:'A101',seat:'S2'},publishedAt:'2026-10-26T08:00:00+05:30'};
test('new own seating announces an old far-away exam for 24h as one actionable row',()=>{
 const rows=buildAcademicReminders({examinations:[exam],seating:[own],now,ownerVtu:'VTU123'});
 assert.equal(rows.length,1);assert.equal(rows[0].seat.ownSeat.seat,'S2');assert.equal(rows[0].urgency,'new');
 assert.equal(buildAcademicReminders({examinations:[exam],seating:[own],now:'2026-10-27T08:00:00+05:30'}).length,0);
});
test('own seating is independently actionable when the matched exam read is unavailable',()=>{
 const rows=buildAcademicReminders({seating:[own],now});assert.equal(rows.length,1);assert.equal(rows[0].item.courseCode,'CS101');
});
test('a known owner mismatch, missing own seat and withdrawn seat cannot announce or attach a seat',()=>{
 for(const seat of [{...own,ownSeat:{...own.ownSeat,vtuNumber:'VTU999'}},{...own,ownSeat:null},{...own,state:'withdrawn'}]){
  assert.equal(buildAcademicReminders({examinations:[exam],seating:[seat],now,ownerVtu:'VTU123'}).length,0);
 }
});
test('canonical duplicate exam sessions and seating publications collapse into the latest own assignment',()=>{
 const rows=buildAcademicReminders({examinations:[exam,{...exam,id:'duplicate',courseCode:'CS-101'}],seating:[own,{...own,id:'new-release',publishedAt:'2026-10-26T08:30:00+05:30',ownSeat:{...own.ownSeat,seat:'S3'}}],now});
 assert.equal(rows.length,1);assert.equal(rows[0].seat.ownSeat.seat,'S3');
});
test('recent audience-filtered notices appear once and expired or old staff news stays out of the hub',()=>{
 const fresh={id:'notice',title:'Staff publication',createdAt:'2026-10-26T08:00:00+05:30'};
 const rows=buildAcademicReminders({notices:[fresh,fresh,{...fresh,id:'old',createdAt:'2026-10-24T08:00:00+05:30'},{...fresh,id:'expired',expiresAt:'2026-10-25T08:00:00+05:30'}],now});
 assert.equal(rows.length,1);assert.equal(rows[0].kind,'notice');
});

// Schedule helpers deliberately accept timestamps rather than the browser zone.
const loadClassStatus=()=>import('../src/lib/live-reminders.js');
const monday={id:'mon',day:'Monday',subjectName:'Networks',startTime:'09:00',endTime:'10:00'};
test('hub class status follows IST across the UTC midnight boundary',async()=>{
 const {liveClassStatus}=await loadClassStatus();
 const result=liveClassStatus({clock:'2026-10-25T23:45:00Z',timetable:[{...monday,startTime:'05:00',endTime:'06:00'}]});
 assert.equal(result.today,'2026-10-26');assert.equal(result.current.subjectName,'Networks');assert.equal(result.time,'05:15');
});
test('holiday override removes even stale current classes and finds the next working day',async()=>{
 const {liveClassStatus}=await loadClassStatus();
 const result=liveClassStatus({clock:now,classes:[{...monday,date:'2026-10-26'}],timetable:[monday,{...monday,id:'tue',day:'Tuesday'}],policies:[{date:'2026-10-26',mode:'holiday',label:'College holiday'}]});
 assert.equal(result.current,null);assert.equal(result.day.label,'College holiday');assert.equal(result.next.date,'2026-10-27');
});
test('follow-day uses actual date and the next class switches exactly at class end',async()=>{
 const {liveClassStatus}=await loadClassStatus();
 const timetable=[monday,{...monday,id:'second',startTime:'10:00',endTime:'11:00'}];
 const result=liveClassStatus({clock:'2026-10-31T10:00:00+05:30',timetable,policies:[{date:'2026-10-31',mode:'follow-day',followDay:'Monday'}]});
 assert.equal(result.current.id,'second');assert.equal(result.current.date,'2026-10-31');assert.equal(result.day.sourceDay,'Monday');
});
test('unknown timetable times stay unknown and demo uses its explicit sample date',async()=>{
 const {liveClassStatus}=await loadClassStatus();
 const result=liveClassStatus({mode:'demo',today:'2026-10-26',time:'09:30',clock:'2030-01-01T12:00:00Z',classes:[{...monday,startTime:''}]});
 assert.equal(result.today,'2026-10-26');assert.equal(result.current,null);assert.equal(result.next,null);assert.equal(result.unknown.length,1);
});

test('hub renders one bounded reminder area with exact own seat and retained data during background refresh',async()=>{
 const fs=await import('node:fs/promises'),{transformWithOxc}=await import('vite'),{createElement}=await import('react'),{renderToStaticMarkup}=await import('react-dom/server');
 const stub=source=>'data:text/javascript;base64,'+Buffer.from(source).toString('base64');
 const file=new URL('../src/components/LiveReminderHub.jsx',import.meta.url);
 let source=await fs.readFile(file,'utf8');
 const replacements={
  '../context/CampusContext':stub('export const useCampus=()=>globalThis.__hubFixture.campus'),
  '../hooks/useLiveResource':stub('export const useLiveResource=(path,enabled)=>enabled?globalThis.__hubFixture.resources[path]:({value:null})'),
 };
 source=source.replace(/^import\s+['"][^'"]+\.css['"];?$/gm,'').replace(/from\s+(['"])([^'"]+)\1/g,(_match,_quote,path)=>`from ${JSON.stringify(replacements[path] || (path.startsWith('.')?new URL(path+(/\.(?:m?js|jsx)$/.test(path)?'':'.js'),file).href:import.meta.resolve(path)))}`);
 const {code}=await transformWithOxc(source,file.pathname,{jsx:{runtime:'automatic'}});
 const component=await import(stub(code.replace(/from "react\/jsx-runtime"/g,`from ${JSON.stringify(import.meta.resolve('react/jsx-runtime'))}`)));
 const notices=Array.from({length:10},(_,i)=>({id:String(i),title:`Staff notice ${i}`,createdAt:'2026-10-26T08:00:00+05:30'}));
 globalThis.__hubFixture={campus:{mode:'connected',clock:new Date(now),data:{profile:{id:'owner',accountRole:'student',officialProfile:{vtuNumber:'VTU123'}},classes:[{...monday,date:'2026-10-26'}],timetable:[monday],notices,calendarPolicies:[]}},resources:{'/academics/faculty-exams':{value:{examinations:[exam]},refreshing:true},'/academics/exam-seating':{value:{seating:[own]},refreshing:true},'/schedules':{value:{schedules:[]},refreshing:true}}};
 const html=renderToStaticMarkup(createElement(component.default,{navigate(){},openNotice(){}}));
 assert.match(html,/Live reminders/);assert.match(html,/Networks/);assert.match(html,/Room A101/);assert.match(html,/Updating/);assert.doesNotMatch(html,/Checking campus publications/);
 assert.equal((html.match(/class="live-hub-reminder /g) || []).length,1);assert.match(html,/3 more reminders/);
 globalThis.__hubFixture.campus.data.notices=[];
 const seatHtml=renderToStaticMarkup(createElement(component.default,{navigate(){}}));assert.match(seatHtml,/Room A101/);assert.match(seatHtml,/Seat S2/);
 globalThis.__hubFixture.campus.data.profile.officialProfile.vtuNumber='VTU999';
 const changed=renderToStaticMarkup(createElement(component.default,{navigate(){}}));assert.doesNotMatch(changed,/Seat S2/);
});
test('staff special-class overrides cannot be replaced by retained timetable fields with the same id',async()=>{
 const {liveClassStatus}=await loadClassStatus();
 const result=liveClassStatus({clock:now,classes:[{...monday,date:'2026-10-26',room:'OLD'}],timetable:[monday],policies:[{id:'override',date:'2026-10-26',mode:'special',classes:[{id:'mon',courseName:'Published lab',startTime:'09:00',endTime:'10:00',room:'NEW'}]}]});
 assert.equal(result.current.subjectName,'Published lab');assert.equal(result.current.room,'NEW');
});
test('expired exams and seats stay hidden even if a staff member republished seating today',()=>{
 assert.equal(buildAcademicReminders({examinations:[{...exam,date:'2026-10-25'}],seating:[{...own,exam:{...exam,date:'2026-10-25'}}],now}).length,0);
});
