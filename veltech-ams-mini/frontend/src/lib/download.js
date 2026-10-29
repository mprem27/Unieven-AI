import {recordDeviceDownload,downloadOwner,deviceDownloadForSource} from './device-downloads.js';
export function downloadFile(name,content,type='text/plain',{store=true,owner=downloadOwner()}={}) {const blob=content instanceof Blob?content:new Blob([content],{type});if(store)void recordDeviceDownload(name,blob,owner).catch(error=>globalThis.dispatchEvent?.(new CustomEvent('campus-download-error',{detail:error.message})));const url=URL.createObjectURL(blob);const link=document.createElement('a');link.href=url;link.download=name;link.click();setTimeout(()=>URL.revokeObjectURL(url),5000);}
export function csv(rows) {return rows.map(row=>row.map(value=>{let text=String(value ?? '');if(/^[\s\u0000-\u001f]*[=+@-]/.test(text))text="'"+text;return '"'+text.replaceAll('"','""')+'"';}).join(',')).join('\r\n');}

export function academicDownloadName(name,type){const extension={'application/pdf':'.pdf','image/png':'.png','image/jpeg':'.jpg','text/csv':'.csv','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet':'.xlsx'}[type];const safe=String(name || 'AMS document').replace(/[\\/\u0000-\u001f]/g,'_').slice(0,170);return extension?safe.replace(/\.(?:pdf|png|jpe?g|csv|xlsx)$/i,'')+extension:safe;}

export async function downloadRemote(url,name){
 const owner=downloadOwner();
 if(!/^\/api\/campus\/(?:academics\/documents\/[a-f0-9]{24}|academics\/campus-documents\/[a-f0-9]{24}\/file|academics\/exam-seating\/[a-f0-9]{24}\/file|faculty-exams\/[a-f0-9]{24}\/seating\/template|exam-plans\/[a-f0-9]{24}\/document)$/.test(url))throw new Error('This academic file link is unavailable.');
 if(globalThis.navigator?.onLine===false){
  const saved=await deviceDownloadForSource(url,owner);if(owner!==downloadOwner())return;
  if(!saved)throw new Error('This file was not previously downloaded for your account. Connect to download it first.');
  downloadFile(saved.name,saved.blob,saved.type,{store:false,owner});return;
 }
 const response=await fetch(url,{credentials:'same-origin',headers:{'X-Campus-Account':owner}});
 if(!response.ok)throw new Error('The file could not be downloaded. Refresh this section and retry.');
 const blob=await response.blob();if(blob.size>15000000)throw new Error('This file is too large for device download storage.');if(owner!==downloadOwner())return;
 const filename=academicDownloadName(name,blob.type);
 try{await recordDeviceDownload(filename,blob,owner,{sourceURL:url,requireActiveOwner:true});}catch(error){if(owner!==downloadOwner())return;globalThis.dispatchEvent?.(new CustomEvent('campus-download-error',{detail:error.message}));}
 if(owner!==downloadOwner())return;downloadFile(filename,blob,blob.type,{store:false,owner});
}
