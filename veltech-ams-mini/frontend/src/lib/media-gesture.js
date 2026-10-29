// Delay a single tap so a second tap never pauses the video before liking it.
export function createMediaGesture({single,like,now=Date.now,schedule=setTimeout,cancel=clearTimeout,delay=280}) {
 let timer=null,lastTouch=null,ignoreMouseUntil=0;
 const clear=()=>{if(timer!==null)cancel(timer);timer=null;};
 const queue=()=>{clear();timer=schedule(()=>{timer=null;single?.();},delay);};
 return {
  click(detail=1){if(now()<ignoreMouseUntil)return;if(detail>1){clear();return;}queue();},
  doubleClick(){if(now()<ignoreMouseUntil)return;clear();like();},
  touch({x,y}){const time=now();ignoreMouseUntil=time+600;const previous=lastTouch;if(previous&&time-previous.time<delay&&Math.hypot(x-previous.x,y-previous.y)<35){clear();lastTouch=null;like();}else {lastTouch={x,y,time};queue();}},
  dispose(){clear();lastTouch=null;}
 };
}
