const socialKeys=['username','bio','image','socialDepartment','socialLinks','isPrivate'];
export function officialStudentProfile(profile={},mode='connected') {return profile.officialProfile || (mode==='demo'?profile:{});}
export function isSocialLinkUrl(value) {
 if(typeof value!=='string'||value.length>2048||!/^https?:\/\//i.test(value)||/[\u0000-\u0020\u007f]/.test(value))return false;
 try {const url=new URL(value);return ['http:','https:'].includes(url.protocol)&&!!url.hostname&&!url.username&&!url.password;}catch{return false;}
}
export function safeSocialLinks(links=[]) {return (Array.isArray(links)?links:[]).filter(link=>link&&typeof link.label==='string'&&link.label.trim()&&link.label.length<=40&&isSocialLinkUrl(link.url)).slice(0,5).map(({label,url})=>({label,url}));}
export function socialProfileDraft(profile={},demo=false) {return {name:(demo?profile.socialName:profile.name) || profile.name || '',username:profile.username || '',bio:profile.bio || '',image:profile.image || '',socialDepartment:profile.socialDepartment || '',socialLinks:safeSocialLinks(profile.socialLinks),isPrivate:!!profile.isPrivate};}
export function socialProfileBody(draft={}) {
 const name=String(draft.name || '').trim(),username=String(draft.username || '').trim().toLowerCase(),bio=String(draft.bio || '').trim(),socialDepartment=String(draft.socialDepartment || '').trim();
 if(!name||name.length>100)throw new Error('Display names must be 1–100 characters.');
 if(!/^[a-z0-9_.]{3,30}$/.test(username))throw new Error('Usernames need 3–30 letters, numbers, dots or underscores.');
 if(bio.length>300||socialDepartment.length>100)throw new Error('Keep your bio within 300 characters and your department within 100.');
 if(!Array.isArray(draft.socialLinks??[]))throw new Error('Add up to five social links.');
 const links=(draft.socialLinks || []).filter(link=>String(link.label || '').trim()||String(link.url || '').trim());
 if(links.length>5)throw new Error('Add up to five social links.');
 const socialLinks=links.map(link=>{const label=String(link.label || '').trim(),url=String(link.url || '').trim();if(!label||label.length>40)throw new Error('Give each link a label within 40 characters.');if(!isSocialLinkUrl(url))throw new Error('Use an HTTP or HTTPS link without credentials.');return {label,url};});
 return {name,username,bio,image:draft.image || '',socialDepartment,socialLinks,isPrivate:!!draft.isPrivate};
}
export function applyDemoSocialProfile(state,body) {
 state.profile.socialName=body.name;
 for(const key of socialKeys)if(body[key]!==undefined)state.profile[key]=body[key];
 for(const item of [...(state.posts || []),...(state.reels || []),...(state.stories || [])]){if(String(item.author?.id ?? item.author?._id)!==String(state.profile.id))continue;Object.assign(item.author,{name:body.name,username:body.username,image:body.image,bio:body.bio,socialDepartment:body.socialDepartment,socialLinks:body.socialLinks});}
 return state;
}
