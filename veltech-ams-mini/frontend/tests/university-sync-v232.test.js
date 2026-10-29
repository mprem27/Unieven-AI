import test from 'node:test';
import assert from 'node:assert/strict';
import {createElement,act} from 'react';
import {create} from 'react-test-renderer';
import {MemoryRouter} from 'react-router-dom';
import axios from 'axios';
import {loadJsx,moduleUrl,settle} from './helpers/jsx.js';
import {request,setApiOwner} from '../src/lib/api.js';

globalThis.IS_REACT_ACT_ENVIRONMENT=true;
const uiModule=await loadJsx(new URL('../src/components/UI.jsx',import.meta.url));
// Reuse the real field, button and feedback components; only the remote service
// and surrounding provider are replaced to control upstream responses.
globalThis.__universityUi=uiModule;
const uiUrl=moduleUrl('export const {Button,Field,Feedback,SectionTitle}=globalThis.__universityUi;');
const campusUrl=moduleUrl('export const useCampus=()=>globalThis.__universityCampus;');
const apiUrl=moduleUrl('export const request=(...args)=>globalThis.__universityRequest(...args);export const setCsrf=()=>{};');
const syncStatus=(await loadJsx(new URL('../src/components/SourceSyncStatus.jsx',import.meta.url),{'../context/CampusContext':campusUrl})).default;
globalThis.__universityStatus=syncStatus;
const statusUrl=moduleUrl('export default globalThis.__universityStatus;');
const replacements={'../components/UI':uiUrl,'./UI':uiUrl,'../context/CampusContext':campusUrl,'../lib/api':apiUrl,'./SourceSyncStatus':statusUrl};
const PortalLogin=(await loadJsx(new URL('../src/pages/PortalLogin.jsx',import.meta.url),replacements)).default;
const AmsConnection=(await loadJsx(new URL('../src/components/AmsConnection.jsx',import.meta.url),replacements)).default;
const challenge={requiresCaptcha:true,challengeId:'fixture-challenge-one',display:'FIXTURE'};
const busy=()=>Object.assign(new Error('Source busy. Please retry.'),{status:503});
const rejected=()=>Object.assign(new Error('The verification answer was not accepted.'),{status:400});
const renderedText=renderer=>JSON.stringify(renderer.toJSON());
function fixture(){globalThis.__universityCampus={mode:'connected',data:{profile:{id:'owner',portalPrincipal:'vtu00000'},syncStatus:{state:'partial',lastSuccessAt:'2026-10-27T08:00:00Z',modules:[]}},refresh:async()=>{},refreshUniversity:()=>globalThis.__universityRequest('/academics/ams/refresh',{method:'POST',body:{}}),resume:async()=>true,finishWelcome:()=>{}};}
async function mount(Component){let renderer;await act(async()=>{renderer=create(createElement(MemoryRouter,null,createElement(Component)));await settle();});return renderer;}
async function change(renderer,type,value){const field=renderer.root.findAllByType('input').find(node=>node.props.type===type || type==='username' && node.props.autoComplete==='username' || type==='answer' && node.props.autoComplete==='off');assert.ok(field,`Missing ${type} input`);await act(async()=>{field.props.onChange({target:{value}});});}
async function submit(renderer){await act(async()=>{await renderer.root.findByType('form').props.onSubmit({preventDefault(){}});await settle();});}

test('a busy upstream sign-in keeps its unused challenge for a manual retry; rejected answers discard it',async()=>{
 fixture();let attempt=0,renderer;
 globalThis.__universityRequest=async()=>{if(++attempt===1)return {verificationRequired:true,challenge};throw attempt===2?busy():rejected();};
 try{
  renderer=await mount(PortalLogin);await change(renderer,'username','vtu00000');await change(renderer,'password','fixture-password');await submit(renderer);await change(renderer,'answer','typed-answer');await submit(renderer);
  assert.match(renderedText(renderer),/FIXTURE/,'503 must not discard the unused official challenge');
  assert.equal(renderer.root.findAllByType('input').find(node=>node.props.autoComplete==='off').props.value,'typed-answer');
  await submit(renderer);assert.doesNotMatch(renderedText(renderer),/FIXTURE/,'an ordinary rejection must require a new challenge');
 }finally{if(renderer)await act(async()=>renderer.unmount());}
});

test('a busy challenge reload leaves the previous browser-bound challenge and answer usable',async()=>{
 fixture();let renderer;globalThis.__universityRequest=async path=>{if(path==='/portal/challenge')throw busy();return {verificationRequired:true,challenge};};
 try{
  renderer=await mount(PortalLogin);await change(renderer,'username','vtu00000');await change(renderer,'password','fixture-password');await submit(renderer);await change(renderer,'answer','typed-answer');
  const reload=renderer.root.findAllByType('button').find(node=>node.children.includes('Reload'));
  await act(async()=>{await reload.props.onClick();await settle();});
  assert.match(renderedText(renderer),/FIXTURE/);assert.equal(renderer.root.findAllByType('input').find(node=>node.props.autoComplete==='off').props.value,'typed-answer');
 }finally{if(renderer)await act(async()=>renderer.unmount());}
});

test('a busy university reconnection preserves verification without adopting a session',async()=>{
 fixture();let attempt=0,resumes=0,renderer;globalThis.__universityCampus.resume=async()=>{resumes++;};globalThis.__universityRequest=async()=>{if(++attempt===1)return {verificationRequired:true,challenge};throw busy();};
 try{
  renderer=await mount(AmsConnection);const reconnect=renderer.root.findAllByType('button').find(node=>node.props.className==='text-button');await act(async()=>reconnect.props.onClick());await change(renderer,'password','fixture-password');await submit(renderer);await change(renderer,'answer','typed-answer');await submit(renderer);
  assert.match(renderedText(renderer),/FIXTURE/);assert.equal(resumes,0);assert.equal(renderer.root.findAllByType('input').find(node=>node.props.autoComplete==='off').props.value,'typed-answer');
 }finally{if(renderer)await act(async()=>renderer.unmount());}
});

test('offline university status identifies the saved device copy instead of reporting an active sync',async()=>{
 fixture();globalThis.__universityCampus.offlineSnapshot=true;globalThis.__universityCampus.data.syncStatus={state:'syncing',lastSuccessAt:'2026-10-27T08:00:00Z',modules:[{id:'profile',label:'Student information',state:'available'}]};let renderer;
 try{await act(async()=>{renderer=create(createElement(syncStatus,{detailed:true}));});assert.match(renderedText(renderer),/Saved on this device/);assert.doesNotMatch(renderedText(renderer),/Syncing AMS|Syncing university/);assert.match(renderedText(renderer),/27 Oct/);}
 finally{if(renderer)await act(async()=>renderer.unmount());}
});

test('a partially refreshed university source is presented as incomplete rather than a success message',async()=>{
 fixture();globalThis.__universityRequest=async()=>({partial:true});let renderer;
 try{renderer=await mount(AmsConnection);const refresh=renderer.root.findAllByType('button').find(node=>node.props.className?.includes('secondary'));await act(async()=>{await refresh.props.onClick();await settle();});assert.equal(renderer.root.findAllByProps({className:'feedback success'}).length,0);assert.equal(renderer.root.findAllByProps({className:'feedback error'}).length,1);}
 finally{if(renderer)await act(async()=>renderer.unmount());}
});

test('retained source modules stay visibly saved when the latest layout is unsupported or unavailable',async()=>{
 fixture();globalThis.__universityCampus.data.syncStatus.modules=[{id:'results',label:'Results',state:'unsupported',retained:true,lastSuccessAt:'2026-10-27T08:00:00Z'},{id:'fees',label:'Fees',state:'unavailable',retained:true,lastSuccessAt:'2026-10-26T08:00:00Z'}];let renderer;
 try{await act(async()=>{renderer=create(createElement(syncStatus,{detailed:true}));});const modules=renderer.root.findByProps({className:'sync-module-grid'}).findAllByType('strong');assert.equal(modules.length,2);for(const item of modules)assert.match(item.children.join(''),/previous records retained/i);assert.match(modules[0].children.join(''),/unsupported/i);}
 finally{if(renderer)await act(async()=>renderer.unmount());}
});

test('university reconnect allows the source login deadline and still sends credentials only once',async()=>{
 const adapter=axios.defaults.adapter;let calls=0,timeout;
 axios.defaults.adapter=async config=>{calls++;timeout=config.timeout;throw Object.assign(new Error('source timeout'),{code:'ECONNABORTED'});};
 try{await assert.rejects(request('/portal/login',{method:'POST',body:{username:'vtu00000',password:'fixture'}}),error=>error.code==='REQUEST_TIMEOUT');assert.ok(timeout>=120000 && timeout<=135000);assert.equal(calls,1);}
 finally{axios.defaults.adapter=adapter;setApiOwner('');}
});

test('university status distinguishes an active source session from saved records needing reconnection',async()=>{
 fixture();let renderer;
 try{
  globalThis.__universityCampus.data.syncStatus.sourceSession={state:'active',refreshAvailable:true,expiresInSeconds:900};
  await act(async()=>{renderer=create(createElement(syncStatus,{detailed:true}));});assert.match(renderedText(renderer),/University connection active/);assert.match(renderedText(renderer),/15 minutes/);
  globalThis.__universityCampus.data.syncStatus.sourceSession={state:'reconnect_required',refreshAvailable:false,expiresInSeconds:0};
  await act(async()=>renderer.update(createElement(syncStatus,{detailed:true})));assert.match(renderedText(renderer),/Sign in to the university source again/);assert.match(renderedText(renderer),/27 Oct/);
 }finally{if(renderer)await act(async()=>renderer.unmount());}
});
test('queued university work uses the shared controller and does not claim completed records',async()=>{
 fixture();let renderer,shared=0,globalReads=0;globalThis.__universityCampus.refreshUniversity=async()=>{shared++;return {queued:true,syncStatus:{state:'syncing'}};};globalThis.__universityCampus.refresh=async()=>{globalReads++;};
 try{
  renderer=await mount(AmsConnection);const refresh=renderer.root.findAllByType('button').find(node=>node.props.className?.includes('secondary'));
  await act(async()=>{await refresh.props.onClick();await settle();});assert.equal(shared,1);assert.equal(globalReads,0);assert.match(renderedText(renderer),/Sync started/);assert.doesNotMatch(renderedText(renderer),/University records refreshed/);
 }finally{if(renderer)await act(async()=>renderer.unmount());}
});

test('source status respects manual refresh and expires an old capability even when status transport is delayed',async()=>{
 fixture();let renderer;globalThis.__universityCampus.automaticUniversityRefresh=false;globalThis.__universityCampus.data.syncStatus.sourceSession={state:'active',refreshAvailable:true,expiresInSeconds:900,expiresAt:Date.now()+900000};
 try{await act(async()=>{renderer=create(createElement(syncStatus,{detailed:true}));});assert.match(renderedText(renderer),/Automatic refresh is off/);
  globalThis.__universityCampus.data.syncStatus.sourceSession.expiresAt=Date.now()-1;await act(async()=>renderer.update(createElement(syncStatus,{detailed:true})));assert.match(renderedText(renderer),/Sign in to the university source again/);assert.doesNotMatch(renderedText(renderer),/University connection active/);
 }finally{if(renderer)await act(async()=>renderer.unmount());}
});
