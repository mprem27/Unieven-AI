// Keep every push destination inside this app's hash router.
function notificationDestination(value){
 const fallback=new URL('/#/notifications',self.location.origin).href;
 if(typeof value!=='string')return fallback;
 try{
  const candidate=new URL(value,self.location.origin);
  if(candidate.origin!==self.location.origin)return fallback;
  if(candidate.pathname==='/' && candidate.hash.startsWith('#/'))return candidate.href;
  if(!candidate.hash && /^\/(?!\/)[a-zA-Z0-9_/?=&%.-]*$/.test(value))return new URL('/#'+value,self.location.origin).href;
 }catch{}
 return fallback;
}
self.addEventListener('push',event=>{
 let payload={};try{payload=event.data?.json() || {};}catch{}
 const title=typeof payload.title==='string'?payload.title:'New campus notification';
 const options={body:typeof payload.body==='string'?payload.body:typeof payload.message==='string'?payload.message:'Open your campus inbox to read the update.',icon:'/icons/app-192.png',tag:payload.notificationId?`campus:${payload.notificationId}`:'campus-update',silent:payload.silent!==false,data:{url:notificationDestination(payload.url || payload.link)}};
 event.waitUntil(self.registration.showNotification(title,options));
});
self.addEventListener('notificationclick',event=>{
 event.notification.close();
 event.waitUntil((async()=>{
  const url=notificationDestination(event.notification.data?.url || event.notification.data?.link);
  const windows=await self.clients.matchAll({type:'window',includeUncontrolled:true});
  const existing=windows.find(client=>new URL(client.url).origin===self.location.origin);
  if(existing){await existing.navigate(url);await existing.focus();}
  else await self.clients.openWindow(url);
 })());
});
