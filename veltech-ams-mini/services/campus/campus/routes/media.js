import multer from 'multer';
import fs from 'node:fs';
import {stat} from 'node:fs/promises';
import {CampusMedia,createMediaStore,canAccessMedia,mediaUrl} from '../services/media-store.js';
import {fail,validateId} from '../security.js';
export function registerMedia(router,config) {
 const store=config.mediaStore || createMediaStore(config),upload=multer({storage:multer.memoryStorage(),limits:{fileSize:25*1024*1024,files:1,fields:3,parts:4}}).single('file');
 router.post('/media/upload',config.auth,(req,res,next)=>upload(req,res,error=>{
  if(error){error.status=error.code==='LIMIT_FILE_SIZE'?413:400;error.message=error.code==='LIMIT_FILE_SIZE'?'Files are limited to 25 MB.':'Choose one media file.';return next(error);}
  next();
 }),async(req,res)=>{
  if(!req.file)fail(400,'Choose a media file to upload.');
  const item=await store.put(req.user,req.file.buffer,{visibility:req.body.visibility || 'private'});
  res.status(201).json({id:String(item._id),url:mediaUrl(item._id),kind:item.kind,mime:item.mime,size:item.size,visibility:item.visibility});
 });
 router.get('/media/:id',config.auth,async(req,res)=>{
  validateId(req.params.id);const item=await CampusMedia.findById(req.params.id);
  if(!item || !await canAccessMedia(req.user,item))fail(404,'Media not found.');
  const filename=store.pathFor(item);let info;try{info=await stat(filename);}catch{fail(404,'Media not found.');}
  if(!info.isFile() || info.size!==item.size)fail(404,'Media not found.');
  res.set({'Content-Type':item.mime,'X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'none'; sandbox",'Cache-Control':'private, no-store','Accept-Ranges':'bytes','Content-Disposition':'inline'});
  const range=req.headers.range;let start=0,end=item.size-1;
  if(range){
   const match=/^bytes=(\d*)-(\d*)$/.exec(range);
   if(!match || (!match[1] && !match[2]))return res.status(416).set('Content-Range',`bytes */${item.size}`).end();
   if(!match[1]){const length=Number(match[2]);start=Math.max(0,item.size-length);if(length<=0)start=item.size;}
   else {start=Number(match[1]);end=match[2]?Math.min(Number(match[2]),end):end;}
   if(!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start>end || start>=item.size)return res.status(416).set('Content-Range',`bytes */${item.size}`).end();
   res.status(206).set('Content-Range',`bytes ${start}-${end}/${item.size}`);
  }
  res.set('Content-Length',String(end-start+1));if(req.method==='HEAD')return res.end();
  const stream=fs.createReadStream(filename,{start,end});stream.on('error',()=>res.destroy());req.on('close',()=>stream.destroy());stream.pipe(res);
 });
}
