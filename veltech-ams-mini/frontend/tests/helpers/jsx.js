import fs from 'node:fs/promises';
import {transformWithOxc} from 'vite';
export const moduleUrl=code=>'data:text/javascript;base64,'+Buffer.from(code).toString('base64');
export async function loadJsx(file,replacements={}){
 let source=await fs.readFile(file,'utf8');
 source=source.replace(/from\s+(['"])([^'"]+)\1/g,(_match,_quote,path)=>`from ${JSON.stringify(replacements[path] || (path.startsWith('.')?new URL(path+(/\.(?:m?js|jsx)$/.test(path)?'':'.js'),file).href:import.meta.resolve(path)))}`);
 const {code}=await transformWithOxc(source,file.pathname,{jsx:{runtime:'automatic'}});
 return import(moduleUrl(code.replace(/from "react\/jsx-runtime"/g,`from ${JSON.stringify(import.meta.resolve('react/jsx-runtime'))}`)));
}
export const settle=()=>new Promise(resolve=>setImmediate(resolve));
export function browserFixture(){
 const saved={window:globalThis.window,document:globalThis.document,localStorage:globalThis.localStorage,navigator:Object.getOwnPropertyDescriptor(globalThis,'navigator')};
 const window=new EventTarget(),document=new EventTarget(),values=new Map();document.visibilityState='visible';
 const localStorage={getItem:key=>values.get(key) ?? null,setItem:(key,value)=>values.set(key,String(value)),removeItem:key=>values.delete(key)};
 Object.assign(globalThis,{window,document,localStorage});Object.defineProperty(globalThis,'navigator',{value:{onLine:true},configurable:true});
 return {window,document,localStorage,restore(){for(const key of ['window','document','localStorage'])globalThis[key]=saved[key];if(saved.navigator)Object.defineProperty(globalThis,'navigator',saved.navigator);else delete globalThis.navigator;}};
}
