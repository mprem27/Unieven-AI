import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {transformWithOxc} from 'vite';
import {createElement,act} from 'react';
import {create} from 'react-test-renderer';
import {MemoryRouter} from 'react-router-dom';
import {moduleUrl,settle} from './helpers/jsx.js';
globalThis.IS_REACT_ACT_ENVIRONMENT=true;
const ui=moduleUrl(`import {createElement as h} from ${JSON.stringify(import.meta.resolve('react'))};
export const Button=({children,busy,...p})=>h('button',p,children);export const IconButton=({label,children,...p})=>h('button',{'aria-label':label,...p},children);
export const Avatar=()=>null;export const EmptyState=({title})=>h('p',null,title);export const PageHeader=({title,description,children})=>h('header',null,h('h1',null,title),h('p',null,description),children);export const Feedback=()=>null;export const Field=({children})=>h('div',null,children);`);
async function page(path,extra={}){
 const url=new URL(path,import.meta.url);let source=(await fs.readFile(url,'utf8')).replace(/^import ['"].*\.css['"];?$/gm,'');
 const replacements={'../components/UI':ui,'../context/CampusContext':moduleUrl('export const useCampus=()=>globalThis.__inboxCampus;'),'../lib/api':moduleUrl('export const request=(...args)=>globalThis.__inboxRequest(...args);'),...extra};
 source=source.replace(/from\s+(['"])([^'"]+)\1/g,(_,q,p)=>`from ${JSON.stringify(replacements[p] || (p.startsWith('.')?new URL(p+(/\.(?:m?js|jsx)$/.test(p)?'':'.js'),url).href:import.meta.resolve(p)))}`);
 const {code}=await transformWithOxc(source,url.pathname,{jsx:{runtime:'automatic'}});return (await import(moduleUrl(code.replace(/from "react\/jsx-runtime"/g,`from ${JSON.stringify(import.meta.resolve('react/jsx-runtime'))}`)))).default;
}
const Notifications=await page('../src/pages/Notifications.jsx');
const stub=moduleUrl('export default function Stub(){return null;}');
const settingsSource=await fs.readFile(new URL('../src/pages/Settings.jsx',import.meta.url),'utf8');
const extras=Object.fromEntries([...settingsSource.matchAll(/import \w+ from '(\.\.\/components\/[^']+)'/g)].map(match=>[match[1],stub]));
const Settings=await page('../src/pages/Settings.jsx',extras);
const data=owner=>({profile:{id:owner,name:owner,campusRole:'student'},notifications:[{id:'one',source:'social',title:'A new reply',read:false}],notices:[{id:'notice',title:'Campus update',body:'Notice text'}]});
function campus(owner){globalThis.__inboxCampus={mode:'connected',data:data(owner),isCurrentAccount:key=>key===`connected:${globalThis.__inboxCampus.data.profile.id}`,notify:(...args)=>messages.push(args),refresh:()=>{throw new Error('Workspace must not refresh');}};}
let messages=[];
async function render(Component,route){let renderer;await act(async()=>{renderer=create(createElement(MemoryRouter,{initialEntries:[route]},createElement(Component,{openNotice:()=>{}})));await settle();});return renderer;}
const text=renderer=>JSON.stringify(renderer.toJSON());
test('rendered inbox immediately marks read, resets filters on account switch, and ignores late rollback',async()=>{
 messages=[];campus('alpha');let reject;globalThis.__inboxRequest=()=>new Promise((_,no)=>{reject=no;});let renderer;
 try{renderer=await render(Notifications,'/notifications');await act(async()=>renderer.root.findByProps({'aria-label':'Actions for A new reply'}).props.onClick());
 await act(async()=>{renderer.root.findAllByType('button').find(n=>n.children.includes('Mark as read')).props.onClick();await settle();});assert.match(text(renderer),/You’re all caught up/);
 await act(async()=>renderer.root.findAllByType('button').find(n=>n.props['aria-pressed']!==undefined && n.children[0]==='Unread').props.onClick());
 campus('beta');await act(async()=>{renderer.update(createElement(MemoryRouter,{initialEntries:['/notifications']},createElement(Notifications,{openNotice:()=>{}})));await settle();});
 assert.match(text(renderer),/1 unread update/);const all=renderer.root.findAllByType('button').find(n=>n.children.includes('All updates'));assert.equal(all.props['aria-pressed'],true);
 await act(async()=>{reject(new Error('Old account failure'));await settle();});assert.equal(messages.length,0);assert.match(text(renderer),/1 unread update/);
 }finally{if(renderer)await act(async()=>renderer.unmount());}
});
test('mobile settings route selects index/detail and install category without replacing history links',async()=>{
 campus('alpha');for(const [route,expected]of [['/settings','settings-index'],['/settings/notifications','settings-detail'],['/settings/install','settings-detail']]){const renderer=await render(Settings,route);try{assert.match(renderer.root.findAllByType('div')[0].props.className,new RegExp(expected));assert.ok(renderer.root.findAllByType('a').some(n=>n.props.href==='/settings/install'));if(route!='/settings')assert.ok(renderer.root.findAllByType('a').some(n=>n.props.href==='/settings' && n.children.includes('Back to settings')));}finally{await act(async()=>renderer.unmount());}}
});
