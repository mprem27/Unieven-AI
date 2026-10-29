import test from 'node:test';
import assert from 'node:assert/strict';
import {createFollowController,followState,createRelationshipReads,canDisplayCachedSocialContent} from '../src/lib/social-follow.js';
test('private follow is a request; authoritative result wins without workspace reads',async()=>{
 let state={id:'p',isPrivate:true,following:false},resolve,calls=0;
 const controller=createFollowController({read:()=>state,patch:value=>{state={...state,...value};},isCurrent:()=>true,send:()=>{calls++;return new Promise(r=>resolve=r);}});
 const a=controller.act(),b=controller.act();assert.equal(a,b);assert.equal(state.requestStatus,'requested');assert.equal(state.following,false);assert.equal(calls,1);
 resolve({following:true,status:'accepted'});await a;assert.equal(state.following,true);assert.equal(state.requestStatus,'accepted');
});
test('failure rolls back relationship only and stale owner cannot patch',async()=>{
 let state={following:true,requestStatus:'accepted',bio:'old'},reject,current=true;
 const controller=createFollowController({read:()=>state,patch:value=>{state={...state,...value};},isCurrent:()=>current,send:()=>new Promise((_,r)=>reject=r)});
 const action=controller.act();state.bio='new';reject(new Error('offline'));await assert.rejects(action,/offline/);assert.equal(state.following,true);assert.equal(state.bio,'new');
 const stale=controller.act();current=false;reject(new Error('expired'));await assert.rejects(stale);assert.equal(state.following,false);
});
test('cancel clears pending and authoritative delete does not invent accepted status',()=>{
 assert.deepEqual(followState({following:false,requestStatus:'requested'}),{following:false,requestStatus:null});
});

test('connected Follow changes only relationship state and makes no workspace GETs',async()=>{
 const axios=(await import('axios')).default;
 const {createElement,act}=await import('react'),{create}=await import('react-test-renderer');
 const {loadJsx,moduleUrl,browserFixture,settle}=await import('./helpers/jsx.js');
 const {setApiOwner,setApiReadOnly}=await import('../src/lib/api.js');
 globalThis.IS_REACT_ACT_ENVIRONMENT=true;
 const context=await loadJsx(new URL('../src/context/CampusContext.jsx',import.meta.url),{'./AppPreferences':moduleUrl('export const useAppPreferences=()=>({preferences:{refreshSeconds:0}})')});
 const browser=browserFixture(),adapter=axios.defaults.adapter,calls=[];let campus,renderer;
 axios.defaults.adapter=async config=>{calls.push([config.method,config.url]);return {data:config.url==='/session'?{user:{id:'a',name:'Own student',accountRole:'student'},csrfToken:'fixture'}:config.url==='/academics/overview'?{profile:{name:'Own student'},summary:[],academic:{},syncStatus:{state:'idle',modules:[]}}:config.url==='/connections/p'?{following:true,status:'accepted'}:config.url==='/people'?[{id:'p',following:false}]:config.url.startsWith('/academic-calendar') || config.url==='/timetable-rooms'?{entries:[]}:[],status:200,headers:{},config};};
 try{
  function Probe(){campus=context.useCampus();return null;}
  await act(async()=>{renderer=create(createElement(context.CampusProvider,null,createElement(Probe)));await settle();});
  for(let i=0;i<50 && !campus.data.workspaceReady;i++)await act(async()=>{await settle();});
  const posts=campus.data.posts,academic=campus.data.academic;calls.length=0;
  await act(async()=>{await campus.follow({id:'p',following:false});await settle();});
  assert.deepEqual(calls,[['post','/connections/p']]);assert.equal(campus.data.people[0].following,true);assert.equal(campus.data.posts,posts);assert.equal(campus.data.academic,academic);assert.equal(campus.loading,false);
 }finally{if(renderer)await act(async()=>renderer.unmount());setApiOwner('');setApiReadOnly(false);browser.restore();axios.defaults.adapter=adapter;}
});

test('an old people refresh cannot undo unfollow, expose private content or change the next write; later reads remain fresh',async()=>{
 const axios=(await import('axios')).default;
 const {createElement,act}=await import('react'),{create}=await import('react-test-renderer');
 const {loadJsx,moduleUrl,browserFixture,settle}=await import('./helpers/jsx.js');
 const {setApiOwner,setApiReadOnly}=await import('../src/lib/api.js');
 globalThis.IS_REACT_ACT_ENVIRONMENT=true;
 const context=await loadJsx(new URL('../src/context/CampusContext.jsx',import.meta.url),{'./AppPreferences':moduleUrl('export const useAppPreferences=()=>({preferences:{refreshSeconds:0}})')});
 const browser=browserFixture(),adapter=axios.defaults.adapter,calls=[];let campus,renderer,holdPeople=false,releasePeople;
 axios.defaults.adapter=async config=>{calls.push([config.method,config.url]);if(config.url==='/people' && holdPeople)await new Promise(resolve=>{releasePeople=resolve;});return {data:config.url==='/session'?{user:{id:'a',name:'Own student',accountRole:'student'},csrfToken:'fixture'}:config.url==='/academics/overview'?{profile:{name:'Own student'},summary:[],academic:{},syncStatus:{state:'idle',modules:[]}}:config.url==='/connections/p'?config.method==='delete'?{following:false}:{following:false,status:'requested'}:config.url==='/people'?[{id:'p',following:true,isPrivate:true,requestStatus:'accepted'}]:config.url.startsWith('/academic-calendar') || config.url==='/timetable-rooms'?{entries:[]}:[],status:200,headers:{},config};};
 try{
  function Probe(){campus=context.useCampus();return null;}
  await act(async()=>{renderer=create(createElement(context.CampusProvider,null,createElement(Probe)));await settle();});
  for(let i=0;i<50 && !campus.data.workspaceReady;i++)await act(async()=>{await settle();});
  holdPeople=true;let refresh;
  await act(async()=>{refresh=campus.refresh();await settle();});assert.equal(typeof releasePeople,'function');
  await act(async()=>{await campus.follow(campus.data.people[0]);await settle();});
  assert.equal(campus.data.people[0].following,false);
  await act(async()=>{releasePeople();await refresh;await settle();});
  assert.equal(campus.data.people[0].following,false,'old GET must preserve the successful unfollow');
  assert.equal(campus.data.people[0].isPrivate,true);
  assert.equal(campus.data.people[0].requestStatus,null);
  assert.equal(canDisplayCachedSocialContent({text:'private text'}, {id:'p',isPrivate:true},campus.data.people,'a'),false);
  assert.equal(canDisplayCachedSocialContent({text:'followers text',visibility:'followers'}, {id:'p'},campus.data.people,'a'),false);
  calls.length=0;
  await act(async()=>{await campus.follow(campus.data.people[0]);await settle();});
  assert.deepEqual(calls,[['post','/connections/p']],'next toggle must request, not delete again');
  holdPeople=false;
  await act(async()=>{await campus.refresh();await settle();});
  assert.equal(campus.data.people[0].following,true,'a fresh later read remains authoritative');

 }finally{if(renderer)await act(async()=>renderer.unmount());setApiOwner('');setApiReadOnly(false);browser.restore();axios.defaults.adapter=adapter;}
});

test('reads begun during pending writes stay fenced after settlement; future reads and unrelated members reconcile',()=>{
 const reads=createRelationshipReads();reads.pending('p',true);reads.patch('p',{following:false,requestStatus:null});
 const during=reads.capture();reads.patch('p',{following:false,requestStatus:null});reads.pending('p',false);
 const old=[{id:'p',following:true,requestStatus:'accepted',followersCount:5},{id:'q',following:true}];
 assert.deepEqual(reads.reconcile(old,during).map(person=>[person.id,person.following]),[['p',false],['q',true]]);
 assert.equal(reads.reconcile(old,during)[0].followersCount,4);
 const fresh=reads.capture();assert.equal(reads.reconcile(old,fresh)[0].following,true);
 assert.equal(reads.reconcile(old,during)[0].following,true,'older read uses subsequently reconciled authoritative state');
 reads.clear();assert.equal(reads.current(during),false);
});

test('session-discovered owner switch clears pending relationship history for the next owner',async()=>{
 const axios=(await import('axios')).default;
 const {createElement,act}=await import('react'),{create}=await import('react-test-renderer');
 const {loadJsx,moduleUrl,browserFixture,settle}=await import('./helpers/jsx.js');
 const {setApiOwner,setApiReadOnly}=await import('../src/lib/api.js');
 globalThis.IS_REACT_ACT_ENVIRONMENT=true;
 const context=await loadJsx(new URL('../src/context/CampusContext.jsx',import.meta.url),{'./AppPreferences':moduleUrl('export const useAppPreferences=()=>({preferences:{refreshSeconds:0}})')});
 const browser=browserFixture(),adapter=axios.defaults.adapter,calls=[];let campus,renderer,sessionOwner='a',releaseWrite;
 axios.defaults.adapter=async config=>{calls.push([config.method,config.url]);if(config.url==='/connections/p' && config.method==='delete')await new Promise(resolve=>{releaseWrite=resolve;});return {data:config.url==='/session'?{user:{id:sessionOwner,name:'Own student',accountRole:'student'},csrfToken:'fixture'}:config.url==='/academics/overview'?{profile:{name:'Own student'},summary:[],academic:{},syncStatus:{state:'idle',modules:[]}}:config.url==='/connections/p'?{following:false}:config.url==='/people'?[{id:'p',following:true,isPrivate:true,requestStatus:'accepted'}]:config.url.startsWith('/academic-calendar') || config.url==='/timetable-rooms'?{entries:[]}:[],status:200,headers:{},config};};
 try{
  function Probe(){campus=context.useCampus();return null;}
  await act(async()=>{renderer=create(createElement(context.CampusProvider,null,createElement(Probe)));await settle();});
  for(let i=0;i<50 && !campus.data.workspaceReady;i++)await act(async()=>{await settle();});
  let write;
  await act(async()=>{write=campus.follow(campus.data.people[0]).catch(()=>{});await settle();});
  assert.equal(typeof releaseWrite,'function');assert.equal(campus.data.people[0].following,false);
  sessionOwner='b';
  await act(async()=>{await campus.refresh();await settle();});
  for(let i=0;i<50 && (!campus.data.workspaceReady || campus.data.profile.id!=='b');i++)await act(async()=>{await settle();});
  assert.equal(campus.data.profile.id,'b');assert.equal(campus.data.people[0].following,true,'B must never inherit A pending unfollow');
  await act(async()=>{releaseWrite();await write;await settle();});
  assert.equal(campus.data.people[0].following,true);
  await act(async()=>{await campus.refresh();await settle();});
  assert.equal(campus.data.people[0].following,true,'later B refresh is also free of A overrides');

 }finally{if(renderer)await act(async()=>renderer.unmount());setApiOwner('');setApiReadOnly(false);browser.restore();axios.defaults.adapter=adapter;}
});
