import {fail,httpUrl} from '../security.js';
import {mediaId,mediaUrl,requireOwnedMedia} from './media-store.js';
// These files are shipped with this application; arbitrary /assets/ paths are not attachments.
const bundledImages=new Set(['/assets/veltech-campus.jpg','/assets/code-jam.png','/assets/career-connect.png','/assets/original-logo.png','/assets/student.png']);
export async function eventMedia(user,value,{kind,previous}={}){
 if(typeof value!=='string')fail(400,'Choose an uploaded event image or video');
 if(!value)return kind==='video'?'':'/assets/veltech-campus.jpg';
 // An authorized organizer may retain an existing attachment while changing other details.
 // New or changed uploads must belong to the acting organizer.
 if(value===previous){if(mediaId(value))return mediaUrl(mediaId(value));if(kind==='image' && bundledImages.has(value))return value;if(/^https?:\/\//i.test(value)){httpUrl(value);return value;}}
 if(kind==='image' && bundledImages.has(value))return value;
 const media=await requireOwnedMedia(user,value,{kind});return mediaUrl(media);
}
