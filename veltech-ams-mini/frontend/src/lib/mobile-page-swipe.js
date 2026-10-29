const tabs=['/home','/academics','/events','/community'];
export function swipeDestination(path,start,end){
 const index=tabs.indexOf(path);
 if(index<0 || !start || !end)return null;
 const dx=end.x-start.x,dy=end.y-start.y,elapsed=end.at-start.at;
 if(![dx,dy,elapsed].every(Number.isFinite) || elapsed<0 || elapsed>750 || Math.abs(dx)<85 || Math.abs(dx)<Math.abs(dy)*1.8)return null;
 return tabs[index+(dx<0?1:-1)] || null;
}
export function canStartPageSwipe(target,{x,width}){
 if(!target || width>760 || x<24 || x>width-24)return false;
 const node=target.nodeType===1?target:target.parentElement;
 if(!node || node.closest('a,button,input,textarea,select,summary,video,audio,img,canvas,[contenteditable]:not([contenteditable="false"]),[role="slider"],[role="dialog"],[role="menu"],[data-no-page-swipe],.social-post-media,.reel-viewer,.v17-media-gesture,.v16-media-gesture,.tabs'))return false;
 // Horizontal carousels and wide tables own their gesture, even if the swipe
 // starts on a text child. No CSS touch-action restriction or preventDefault.
 for(let parent=node;parent && parent!==globalThis.document?.body;parent=parent.parentElement){
  if(parent.clientWidth>0 && parent.scrollWidth>parent.clientWidth+3)return false;
 }
 return true;
}
