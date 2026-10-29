import Follow from '../../models/Follow.js';
import {isSocialLinkUrl} from '../../models/User.js';
import {fail,httpUrl} from '../security.js';
import {OVERLAY_FONTS,OVERLAY_STYLES,MEDIA_FILTERS,OVERLAY_LIMITS,isOverlayColor} from '../../../../shared/social-overlay.mjs';
export const sameId=(left,right)=>String(left?._id ?? left ?? '')===String(right?._id ?? right ?? '');
export const hasId=(values,id)=>Array.isArray(values) && values.some(value=>sameId(value,id));
export const AUTHOR_FIELDS='name username image bio socialDepartment socialLinks isPrivate isVerified isActive';
export function socialLinksInput(value) {
  if(!Array.isArray(value)||value.length>5)fail(400,'Add up to five social links');
  return value.map(link=>{
    if(!link||typeof link!=='object'||Array.isArray(link)||Object.keys(link).some(key=>!['label','url'].includes(key)))fail(400,'Each social link needs a label and URL');
    if(typeof link.label!=='string'||!link.label.trim()||link.label.length>40)fail(400,'Link labels must be 1–40 characters');
    if(typeof link.url!=='string'||!isSocialLinkUrl(link.url.trim()))fail(400,'Use an HTTP or HTTPS link without credentials');
    return {label:link.label.trim(),url:link.url.trim()};
  });
}
export const publicSocialLinks=user=>(Array.isArray(user?.socialLinks)?user.socialLinks:[]).filter(link=>link&&typeof link==='object'&&typeof link.label==='string'&&link.label.trim()&&link.label.length<=40&&isSocialLinkUrl(link.url)).slice(0,5).map(link=>({label:link.label,url:link.url}));
export const authorView=user=>({id:String(user?._id ?? user?.id ?? ''),name:user?.name || user?.username || 'Campus member',username:user?.username || '',image:user?.image || '',bio:user?.bio || '',socialDepartment:user?.socialDepartment || '',socialLinks:publicSocialLinks(user),isPrivate:!!user?.isPrivate,isVerified:!!user?.isVerified});
export async function acceptedAuthors(user) {
  const rows=await Follow.find({from:user._id,status:'accepted'}).select('to').lean();
  return new Set(rows.map(row=>String(row.to)));
}
export function canReadContent(item,user,accepted=new Set()) {
  const author=item?.user ?? item?.author;
  if(!author || !user || author.isActive===false) return false;
  if(sameId(author,user)) return true;
  if(item.visibility==='private') return false;
  if(author.isPrivate || item.visibility==='followers') return accepted.has(String(author._id ?? author.id));
  return true;
}
export async function readable(item,user) {return canReadContent(item,user,await acceptedAuthors(user));}
export function audience(value='account') {
  if(value==='public') value='account';
  if(!['account','followers','private'].includes(value)) fail(400,'Choose account, followers, or private visibility');
  return value;
}
export const FONTS=OVERLAY_FONTS;
export const STYLES=OVERLAY_STYLES;
export const FILTERS=['',...MEDIA_FILTERS];
export const BACKGROUNDS=['','navy','teal','sunset','purple','ocean','rose','#0b1830','#0e7490','#0f766e','#7c3aed','#1e293b','#f97316','linear-gradient(135deg,#122a48,#087c79)','linear-gradient(135deg,#345079,#914f81)','linear-gradient(135deg,#785135,#c38648)','linear-gradient(135deg,#174c43,#527e4c)'];
export function overlayInput(body={}) {
  const output={};
  for(const [key,alias,allowed] of [['textFont','font',FONTS],['textStyle','style',STYLES],['filter',null,FILTERS]]) {
    const value=body[key] ?? (alias?body[alias]:undefined);if(value===undefined)continue;
    if(!allowed.includes(value))fail(400,`Invalid ${key}`);output[key]=value;
  }
  for(const [key,alias] of [['textSize','fontSize'],['textX','overlayX'],['textY','overlayY']]) {
    const {min,max}=OVERLAY_LIMITS[key];
    const value=body[key] ?? body[alias];if(value===undefined)continue;
    if(typeof value!=='number' || !Number.isFinite(value) || value<min || value>max)fail(400,`Invalid ${key}`);output[key]=value;
  }
  const color=body.textColor ?? body.color;
  if(color!==undefined){if(!isOverlayColor(color))fail(400,'Choose a supported text color');output.textColor=color;}
  const background=body.bgGradient ?? body.backgroundColor;
  if(background!==undefined){if(!BACKGROUNDS.includes(background))fail(400,'Choose a supported background');output.bgGradient=background;}
  for(const [key,max] of [['overlayText',300],['location',150]])if(body[key]!==undefined){if(typeof body[key]!=='string'||body[key].length>max)fail(400,`Invalid ${key}`);output[key]=body[key].trim();}
  if(body.link!==undefined)output.link=httpUrl(body.link);
  const hashtagInputs=[];
  if(body.tags!==undefined){
    if(!Array.isArray(body.tags)||body.tags.length>20||body.tags.some(tag=>typeof tag!=='string'))fail(400,'Add up to 20 member tags or hashtags');
    output.tags=[...new Set(body.tags.filter(tag=>/^[a-f0-9]{24}$/i.test(tag)))];
    hashtagInputs.push(...body.tags.filter(tag=>!/^[a-f0-9]{24}$/i.test(tag)));
  }
  if(body.hashtags!==undefined){if(!Array.isArray(body.hashtags)||body.hashtags.length>20)fail(400,'Add up to 20 hashtags');hashtagInputs.push(...body.hashtags);}
  if(body.tags!==undefined||body.hashtags!==undefined){
    if(hashtagInputs.some(tag=>typeof tag!=='string'||!/^#?[\p{L}\p{N}_-]{1,30}$/u.test(tag)))fail(400,'Hashtags may contain letters, numbers, underscores, and hyphens');
    output.hashtags=[...new Set(hashtagInputs.map(tag=>tag.replace(/^#/, '').toLowerCase()))].slice(0,20);
  }
  if(body.mentions!==undefined){if(!Array.isArray(body.mentions)||body.mentions.length>20||body.mentions.some(name=>typeof name!=='string'||!/^@?[a-z0-9_.]{3,30}$/i.test(name)))fail(400,'Mention up to 20 valid usernames');output.mentions=[...new Set(body.mentions.map(name=>name.replace(/^@/,'').toLowerCase()))];}

  output.visibility=audience(body.visibility);
  return output;
}
export function overlayView(item) {
  return Object.fromEntries(['overlayText','textColor','textFont','textStyle','textSize','textX','textY','bgGradient','filter','link','location','visibility'].map(key=>[key,item[key] ?? (key==='visibility'?'account':'')]));
}
export function boundedQuery(value,max=100) {if(value===undefined)return '';if(typeof value!=='string'||value.length>max)fail(400,`Search must be at most ${max} characters`);return value.trim();}
export const escapeRegex=value=>value.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
