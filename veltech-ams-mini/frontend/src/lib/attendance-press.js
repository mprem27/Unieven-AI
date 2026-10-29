// Pointer state stays outside React renders; one controller serves the calendar.
export function createAttendancePress({delay=450,tolerance=10,schedule=setTimeout,unschedule=clearTimeout,now=Date.now}={}) {
 let active=null,timer=null,suppressUntil=0;
 const stopTimer=()=>{if(timer!==null)unschedule(timer);timer=null;};
 const cancel=()=>{if(active){suppressUntil=now()+1000;stopTimer();active=null;}};
 return {
  start(event,onHold){
   stopTimer();active=null;suppressUntil=0;
   if(!['touch','pen'].includes(event.pointerType) || (event.button!=null && event.button!==0))return;
   active={id:event.pointerId,x:event.clientX,y:event.clientY,held:false};
   timer=schedule(()=>{timer=null;if(active){active.held=true;suppressUntil=now()+1000;onHold();}},delay);
  },
  move(event){if(active && active.id===event.pointerId && Math.hypot(event.clientX-active.x,event.clientY-active.y)>tolerance)cancel();},
  end(event){if(active && active.id===event.pointerId){stopTimer();if(active.held)suppressUntil=now()+1000;active=null;}},
  cancel,
  consumeClick(event){
   // Keyboard activation is always available after a touch gesture.
   if(event.detail===0)return false;
   if(now()<suppressUntil){suppressUntil=0;return true;}
   return false;
  },
  dispose(){stopTimer();active=null;suppressUntil=0;},
 };
}
