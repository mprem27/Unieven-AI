const id=value=>String(value?.id ?? value?._id ?? value ?? '');
const author=item=>item.author || item.user;
export function demoActivity(data,tab='own',now=Date.now()) {
 const viewer=id(data.profile),own=item=>id(author(item))===viewer;
 const visible=item=>{if(own(item))return true;if(item.visibility==='private')return false;const person=(data.people || []).find(person=>id(person)===id(author(item))) || author(item) || {};return !(person.isPrivate || item.visibility==='followers') || person.following===true;};
 const include=item=>tab==='archive'?own(item)&&item.isArchived:!item.isArchived&&visible(item)&&(tab==='own'?own(item):tab==='saved'?item.saved:!!item.liked);
 const expired=(data.stories || []).filter(item=>own(item)&&item.expiresAt&&Date.parse(item.expiresAt)<=now),stories=[...(data.storyArchive || []).filter(own),...expired];
 return {tab,posts:(data.posts || []).filter(include),reels:(data.reels || []).filter(include),stories:tab==='archive'?[...new Map(stories.map(item=>[id(item),item])).values()]:[]};
}
export function archiveDemoContent(data,kind,contentId,archived) {
 const collection=kind==='post'?data.posts:kind==='reel'?data.reels:null,item=collection?.find(item=>id(item)===String(contentId));
 if(!item||id(author(item))!==id(data.profile))throw new Error('Only your own content can be archived.');
 item.isArchived=archived;return data;
}
