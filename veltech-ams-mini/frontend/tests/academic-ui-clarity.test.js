import test from 'node:test';
import assert from 'node:assert/strict';
import {createElement,act} from 'react';
import {create} from 'react-test-renderer';
import {MemoryRouter} from 'react-router-dom';
import {createServer} from 'vite';
import {browserFixture} from './helpers/jsx.js';
globalThis.IS_REACT_ACT_ENVIRONMENT=true;

// Load the real JSX and nested components using the application's compiler.
const vite=await createServer({root:new URL('..',import.meta.url).pathname,server:{middlewareMode:true,hmr:false},appType:'custom'});
const {default:ResultsDashboard}=await vite.ssrLoadModule('/src/components/ResultsDashboard.jsx');
const {default:MarksDashboard}=await vite.ssrLoadModule('/src/components/MarksDashboard.jsx');
const text=node=>typeof node==='string'?node:node.children?.map(text).join('') || '';
const rows=[{courseCode:'CS101',courseName:'Networks',semester:'II',resultType:'Tests',sourceReport:'May',testMark1:0,midTestMark1:'Absent',labMark:12},{courseCode:'CS101',courseName:'Networks',semester:'2',resultType:'Tests',sourceReport:'June',testMark1:18}];
try{
 await test('Marks semester and division controls change visible subjects without merging source records',async()=>{
  const browser=browserFixture();let renderer;
  try{
   await act(async()=>{renderer=create(createElement(MarksDashboard,{results:rows,mode:'demo'}));});
   await act(async()=>renderer.root.findByProps({'aria-label':'Semester 2'}).props.onClick());
   assert.equal(renderer.root.findAllByType('article').length,2);
   assert.match(text(renderer.root),/Absent/);assert.match(text(renderer.root),/Mid-term/);
   await act(async()=>renderer.root.findAllByType('button').find(node=>text(node)==='Lab').props.onClick());
   assert.equal(renderer.root.findAllByType('article').length,1);
   assert.equal(renderer.root.findAllByType('figure').length,0,'Marks has no graph');
   assert.deepEqual(renderer.root.findAllByType('dt').map(text),['Lab']);
   await act(async()=>renderer.root.findByProps({'aria-label':'Search marks by subject'}).props.onChange({target:{value:'no such subject'}}));
   assert.match(text(renderer.root),/No subjects match your search/);
  }finally{if(renderer)await act(async()=>renderer.unmount());browser.restore();}
 });
 await test('unit-test subjects do not show an unrelated empty mid-term block and mid-term subjects do not show empty tests',async()=>{
  const browser=browserFixture();let renderer;
  try{await act(async()=>{renderer=create(createElement(MarksDashboard,{results:[{courseCode:'T',courseName:'Theory',semester:'5',sourceReport:'Unit tests',testMark1:25},{courseCode:'M',courseName:'Integrated',semester:'5',sourceReport:'Mid-term',midTestMark1:18}],mode:'demo'}));});const cards=renderer.root.findAllByType('article');assert.equal(cards[0].findAllByProps({className:'marks-midterms'}).length,0);assert.deepEqual(cards[1].findAllByType('dt').map(text),['Mid-test 1','Mid-test 2']);}finally{if(renderer)await act(async()=>renderer.unmount());browser.restore();}
 });
 await test('Results keeps semester search and overall figures visible, with advanced controls in a closed disclosure',async()=>{
  const browser=browserFixture();let renderer;
  try{
   await act(async()=>{renderer=create(createElement(MemoryRouter,null,createElement(ResultsDashboard,{results:[{courseCode:'A',courseName:'Algorithms',semester:'II',grade:'A',credits:4,gradePoints:9}],creditSummary:[{label:'CGPA',value:8.8}],mode:'demo'})));});
   const link=renderer.root.findAllByType('a').find(node=>node.props.href==='/academics?section=marks');
   assert.ok(link,'a direct Marks link is visible');
   const tools=renderer.root.findAllByType('details').find(node=>node.props['aria-label']==='Advanced result tools');
   assert.ok(tools,'advanced result tools have their own disclosure');
   assert.notEqual(tools.props.open,true,'advanced tools start closed');
   assert.match(text(tools),/Source report/);
   assert.match(text(renderer.root),/Overall CGPA/);assert.match(text(renderer.root),/8\.80/);
   assert.match(text(renderer.root),/Project estimate/);
   const primary=renderer.root.findByProps({className:'results-primary-filters'});
   assert.match(text(primary),/Semester/);assert.equal(primary.findAllByType('input').length,1);
  }finally{if(renderer)await act(async()=>renderer.unmount());browser.restore();}
 });
}finally{await vite.close();}
