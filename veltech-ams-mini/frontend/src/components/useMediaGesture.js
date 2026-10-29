import {useEffect,useRef,useState} from 'react';
import {createMediaGesture} from '../lib/media-gesture';

export default function useMediaGesture({onLike,onSingle,active=true}) {
 const callbacks=useRef({onLike,onSingle}),controller=useRef(null),[heart,setHeart]=useState(0);
 callbacks.current={onLike,onSingle};
 if(!controller.current)controller.current=createMediaGesture({single:()=>callbacks.current.onSingle?.(),like:()=>{setHeart(value=>value+1);callbacks.current.onLike();}});
 useEffect(()=>()=>controller.current.dispose(),[]);
 useEffect(()=>{if(!active)controller.current.dispose();},[active]);
 return {heart,handlers:{onClick:e=>{if(active)controller.current.click(e.detail);},onDoubleClick:e=>{e.preventDefault();if(active)controller.current.doubleClick();},onPointerUp:e=>{if(active&&e.pointerType==='touch')controller.current.touch({x:e.clientX,y:e.clientY});},onPointerCancel:()=>controller.current.dispose()}};
}
