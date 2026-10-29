export const notificationId=item=>item.id || item._id;
export const notificationIdentity=item=>`${item.source || 'academic'}:${notificationId(item) || ''}`;
export function notificationChanges(previous,account,items) {
 const baseline=previous?.account===account;
 const ids=new Set(baseline?previous.ids:[]),newUnread=[];
 for(const item of items){const id=notificationId(item);if(!id)continue;const key=notificationIdentity(item);if(baseline && !(item.read ?? item.isRead) && !ids.has(key))newUnread.push(id);ids.add(key);}
 // Retain seen IDs across paging and temporary upstream failures, with a bounded history.
 return {state:{account,ids:new Set([...ids].slice(-2000))},newUnread};
}

export function notificationCategory(item){
 if(item.type==='exam_update')return 'academic';
 if(['campus_message','placement_update'].includes(item.type))return 'app';
 if(['academic','academics','attendance'].includes(item.category))return 'academic';
 if(['events','notices','community'].includes(item.category))return item.category;
 if(item.noticeId || item.type==='campus_notice')return 'notices';
 if(item.eventId || /^event_/.test(item.type || ''))return 'events';
 if(item.source==='social' && item.type!=='app_feedback_reply')return 'community';
 return item.source==='academic' || /ATTENDANCE|SYNC_|LOW_ATTENDANCE/.test(item.type || '')?'academic':'app';
}

export function notificationLink(item){
 if(item.type==='exam_update' && (!item.link || item.link==='/notifications'))return '/academics?section=examinations';
 if(typeof item.link==='string' && /^\/(?!\/)[a-zA-Z0-9_/?=&%#.-]*$/.test(item.link))return item.link;
 if(item.noticeId)return `/notifications?notice=${encodeURIComponent(item.noticeId)}`;
 if(item.postId)return `/community/posts/${encodeURIComponent(item.postId)}`;
 if(item.reelId)return `/reels/${encodeURIComponent(item.reelId)}/comments`;
 if(item.eventId)return `/events/${encodeURIComponent(item.eventId)}`;
 if(item.type==='follow_request')return '/connections';
 if(item.actor?.username)return `/members/${encodeURIComponent(item.actor.username)}`;
 return notificationCategory(item)==='academic'?'/attendance':'/notifications';
}

export function notificationGroups(items,now=new Date()){
 const start=new Date(now);start.setHours(0,0,0,0);const week=new Date(start.getTime()-6*86400000);
 const groups=new Map();
 for(const item of [...items].sort((a,b)=>(Date.parse(b.createdAt) || 0)-(Date.parse(a.createdAt) || 0))){const date=Date.parse(item.createdAt),label=date>=start.getTime()?'Today':date>=week.getTime()?'This week':'Earlier';if(!groups.has(label))groups.set(label,[]);groups.get(label).push(item);}
 return [...groups].map(([label,items])=>({label,items}));
}

export const defaultAlertPreferences={soundEnabled:false,silent:false,quietHoursEnabled:false,quietHoursStart:'22:00',quietHoursEnd:'07:00',timeZone:'Asia/Kolkata'};
export function normalizeAlertPreferences(input={}){
 const time=value=>typeof value==='string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
 let timeZone=input.timeZone || 'Asia/Kolkata';try{new Intl.DateTimeFormat('en',{timeZone}).format();}catch{timeZone='Asia/Kolkata';}
 return {...defaultAlertPreferences,soundEnabled:input.soundEnabled===true,silent:input.silent===true,quietHoursEnabled:input.quietHoursEnabled===true,quietHoursStart:time(input.quietHoursStart)?input.quietHoursStart:'22:00',quietHoursEnd:time(input.quietHoursEnd)?input.quietHoursEnd:'07:00',timeZone};
}
export function isQuietHours(preferences,now=new Date()){
 const p=normalizeAlertPreferences(preferences);if(!p.quietHoursEnabled)return false;
 const current=new Intl.DateTimeFormat('en-GB',{timeZone:p.timeZone,hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(now),start=p.quietHoursStart,end=p.quietHoursEnd;
 return start===end || (start<end?current>=start && current<end:current>=start || current<end);
}
export function shouldPlayForegroundSound(preferences,{visible=true,now=new Date()}={}){
 const p=normalizeAlertPreferences(preferences);return visible && p.soundEnabled && !p.silent && !isQuietHours(p,now);
}
const preferenceKey=account=>`veltech:notification-alerts:v1:${encodeURIComponent(account || 'preview')}`;
export function readAlertPreferences(account,storage=globalThis.localStorage){try{return normalizeAlertPreferences(JSON.parse(storage?.getItem(preferenceKey(account)) || '{}'));}catch{return {...defaultAlertPreferences};}}
export function saveAlertPreferences(account,value,storage=globalThis.localStorage){const next=normalizeAlertPreferences(value);try{storage?.setItem(preferenceKey(account),JSON.stringify(next));}catch{}return next;}

let soundContext;
export async function playForegroundSound(){
 const Audio=globalThis.AudioContext || globalThis.webkitAudioContext;if(!Audio)return false;
 soundContext ||= new Audio();if(soundContext.state==='suspended')await soundContext.resume();if(soundContext.state!=='running')return false;
 const start=soundContext.currentTime;
 for(const [offset,frequency]of [[0,660],[.13,880]]){const tone=soundContext.createOscillator(),gain=soundContext.createGain();tone.type='sine';tone.frequency.value=frequency;gain.gain.setValueAtTime(0,start+offset);gain.gain.linearRampToValueAtTime(.07,start+offset+.015);gain.gain.exponentialRampToValueAtTime(.001,start+offset+.12);tone.connect(gain);gain.connect(soundContext.destination);tone.start(start+offset);tone.stop(start+offset+.13);}
 return true;
}
