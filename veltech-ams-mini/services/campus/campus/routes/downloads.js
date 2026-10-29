import path from 'node:path';
import fs from 'node:fs';
export function registerDownloads(router,options={}) {
 const dist=options.dist || process.env.CAMPUS_WEB_DIST || path.resolve('frontend/dist');
 const directory=options.directory || process.env.CAMPUS_DOWNLOAD_DIR || path.resolve(dist,'../../downloads');
 const base='https://raw.githubusercontent.com/vtu26418-design/Clinical/veltech-ams-mini-v2.3.3-college-update/';
 const files=[{id:'source',label:'veltech-ams-mini · full React source',filename:'veltech-ams-mini-source.zip',legacyFilename:'veltech-ams-mini-v1.8-source.zip',type:'application/zip'},{id:'mobile-web',label:'veltech-ams-mini · mobile and web build',filename:'veltech-ams-mini-web.zip',legacyFilename:'veltech-ams-mini-v1.8-mobile-web.zip',type:'application/zip'},{id:'guide',label:'Windows Docker setup guide',filename:'setup-guide.md',legacyFilename:'veltech-ams-mini-v1.8-setup.md',type:'text/markdown; charset=utf-8'}];
 const local=file=>{for(const name of [file.filename,file.legacyFilename].filter(Boolean)){const target=path.join(directory,name);if(fs.existsSync(target)&&fs.statSync(target).isFile())return target;}return null;};
 router.get('/downloads',(_req,res)=>res.json({items:files.map(file=>{const target=local(file);return {id:file.id,label:file.label,available:true,hosted:!target,bytes:target?fs.statSync(target).size:null,url:target?`/api/campus/downloads/${file.id}`:base+file.filename};})}));
 router.get('/downloads/:id',(req,res)=>{const file=files.find(file=>file.id===req.params.id);if(!file)return res.status(404).json({message:'Download not found'});const target=local(file);if(!target)return res.redirect(302,base+file.filename);res.type(file.type).download(target,file.filename);});
}
