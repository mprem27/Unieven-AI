const idOf=value=>String(value?.id ?? value?._id ?? value ?? '');
export const socialCount=value=>Array.isArray(value)?value.length:Number(value)||0;
export const socialAuthor=item=>item?.author || item?.user || {};
export function canEditContent(item,viewerId,now=Date.now()) {
 if(!viewerId || idOf(socialAuthor(item))!==String(viewerId) || item.canEdit===false)return false;
 const created=Date.parse(item.createdAt),deadline=Date.parse(item.editableUntil);
 if(!Number.isFinite(created))return false;
 return now>=created && now<Math.min(created+300000,Number.isFinite(deadline)?deadline:Infinity);
}
export function orderForRefresh(items,revision=0) {
 if(items.length<2 || !revision)return [...items];
 const offset=revision%items.length;
 return [...items.slice(offset),...items.slice(0,offset)];
}
export function buildMixedFeed(posts=[],reels=[],recommended=[]) {
 const maps={post:new Map(posts.map(item=>[idOf(item),item])),reel:new Map(reels.map(item=>[idOf(item),item]))},seen=new Set(),mixed=[];
 const add=(kind,item,reasons=[])=>{const key=`${kind}-${idOf(item)}`;if(!item || !maps[kind] || seen.has(key))return;const current=maps[kind].get(idOf(item)) || item;if(current.isArchived)return;seen.add(key);mixed.push({kind,item:current,reasons});};
 for(const entry of recommended)add(entry.kind,entry.item || entry[entry.kind],entry.reasons || []);
 for(let i=0;i<Math.max(posts.length,reels.length);i++){add('post',posts[i]);add('reel',reels[i]);}
 const balanced=[];
 while(mixed.length){let index=0;const last=balanced.at(-1)?.kind;if(balanced.length>1&&last===balanced.at(-2)?.kind){const alternative=mixed.findIndex(entry=>entry.kind!==last);if(alternative>=0)index=alternative;}balanced.push(...mixed.splice(index,1));}
 return balanced;
}
export function withSuggestions(feed,members=[]) {
 const seen=new Set(),unique=members.filter(member=>{const id=idOf(member);if(!id || seen.has(id))return false;seen.add(id);return true;}),mixed=[];
 let cursor=0;
 feed.forEach((item,index)=>{mixed.push(item);if((index+1)%3===2 && cursor<unique.length){mixed.push({kind:'suggestions',members:unique.slice(cursor,cursor+3),key:cursor});cursor+=3;}});
 return mixed;
}
export async function shareContent(item,kind,notify) {
 const id=idOf(item),path=kind==='reel'?`/reels?reel=${encodeURIComponent(id)}`:`/community/posts/${encodeURIComponent(id)}`,url=`${location.origin}${location.pathname}#${path}`;
 try {if(navigator.share)await navigator.share({title:kind==='reel'?'Campus reel':'Campus post',text:item.text || item.caption || '',url});else {await navigator.clipboard.writeText(url);notify('Link copied');}}catch(error){if(error.name!=='AbortError')notify('Sharing is unavailable in this browser.','error');}
}
