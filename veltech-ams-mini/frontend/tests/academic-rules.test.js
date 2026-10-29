import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {transformWithOxc} from 'vite';
import {createElement,act} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {create} from 'react-test-renderer';
import {loadJsx,moduleUrl,settle} from './helpers/jsx.js';
globalThis.IS_REACT_ACT_ENVIRONMENT=true;
const uiFile=new URL('../src/components/UI.jsx',import.meta.url);
const uiSource=await fs.readFile(uiFile,'utf8');
async function jsxUrl(file,source,replacements={}){
 const rewritten=source.replace(/^import\s+['"][^'"]+\.css['"];?$/gm,'').replace(/from\s+(['"])([^'"]+)\1/g,(_match,_quote,path)=>`from ${JSON.stringify(replacements[path] || (path.startsWith('.')?new URL(path+(/\.(?:m?js|jsx)$/.test(path)?'':'.js'),file).href:import.meta.resolve(path)))}`);
 const {code}=await transformWithOxc(rewritten,file.pathname,{jsx:{runtime:'automatic'}});return moduleUrl(code.replace(/from "react\/jsx-runtime"/g,`from ${JSON.stringify(import.meta.resolve('react/jsx-runtime'))}`));
}
const ui=await jsxUrl(uiFile,uiSource);
async function component(name){
 const file=new URL(`../src/components/${name}.jsx`,import.meta.url);
 let source;try{source=await fs.readFile(file,'utf8');}catch{return null;}
 const url=await jsxUrl(file,source,{'./UI':ui,'../lib/api':moduleUrl('export const request=(...args)=>globalThis.__academicRulesRequest(...args);'),'../context/CampusContext':moduleUrl('export const useCampus=()=>globalThis.__academicRulesCampus;')});return (await import(url)).default;
}
const AcademicRules=await component('AcademicRules'),BatchRules=await component('BatchRules');
test('student rules use the official profile and show an exact regulation source without inferring batch',()=>{
 assert.equal(typeof AcademicRules,'function');
 const render=profile=>renderToStaticMarkup(createElement(AcademicRules,{profile,mode:'connected'}));
 const source=render({id:'one',officialProfile:{degree:'B.Tech',regulation:'VTR UGE 2025',department:'CSE',batch:'2025-2029'}});
 assert.match(source,/CGPA × 10/);assert.match(source,/25\.23\.3/);assert.match(source,/Regulations-VTR-UGE-2025-1_\.pdf/);
 const socialOnly=render({id:'one',degree:'B.Tech',regulation:'VTR UGE 2025',batch:'2025-2029'});
 assert.match(socialOnly,/official regulation is not available/i);assert.match(socialOnly,/Project estimate/);
 const old=render({officialProfile:{degree:'B.Tech',regulation:'VTR UGE 2021'}});assert.match(old,/conversion remains unverified/i);
});
test('legacy edit requires an explicit department scope and preserves the original record identity',async()=>{
 globalThis.__academicRulesCampus={mode:'connected',data:{profile:{id:'admin'}}};
 const calls=[],legacy={id:'507f1f77bcf86cd799439011',batch:'2023-2027',programme:'B.Tech',regulation:'VTR UGE 2021',factor:9,offset:0,sourceUrl:'https://www.veltech.edu.in/fixture.pdf',sourceClause:'Fictional legacy record',verifiedAt:'2026-10-21',legacy:true};
 globalThis.__academicRulesRequest=async(path,options={})=>{calls.push({path,options});return options.method?{...legacy,...options.body}:{rules:[legacy]};};
 let renderer;const oldError=console.error;console.error=(message,...args)=>{if(!String(message).includes('react-test-renderer is deprecated'))oldError(message,...args);};
 try{
  await act(async()=>{renderer=create(createElement(BatchRules));await settle();});
  const edit=renderer.root.findAllByType('button').find(node=>node.children.includes('Review scope'));
  assert.ok(edit,'A legacy record must invite an explicit scope review');await act(async()=>edit.props.onClick());
  const scope=renderer.root.findByType('select');assert.equal(scope.props.value,'');
  await act(async()=>scope.props.onChange({target:{value:'all'}}));
  const checkbox=renderer.root.findAllByType('input').find(node=>node.props.type==='checkbox');await act(async()=>checkbox.props.onChange({target:{checked:true}}));
  await act(async()=>{await renderer.root.findByType('form').props.onSubmit({preventDefault(){}});await settle();});
  const saved=calls.find(row=>row.options.method==='POST');assert.ok(saved);assert.equal(saved.options.body.id,legacy.id);assert.equal(saved.options.body.departmentScope,'all');assert.equal(saved.options.body.department,'');
 }finally{if(renderer)await act(async()=>renderer.unmount());console.error=oldError;delete globalThis.__academicRulesRequest;delete globalThis.__academicRulesCampus;}
});
