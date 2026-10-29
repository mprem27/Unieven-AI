import {OVERLAY_FONTS,OVERLAY_STYLES,MEDIA_FILTERS,OVERLAY_LIMITS,OVERLAY_DEFAULTS,isOverlayColor} from '../../../shared/social-overlay.mjs';
export {OVERLAY_FONTS,OVERLAY_STYLES,MEDIA_FILTERS,OVERLAY_DEFAULTS};

export const fontFamilies=Object.freeze({classic:'Arial, sans-serif',typewriter:'"Courier New", monospace',modern:'Inter, sans-serif',impact:'Impact, "Arial Narrow", sans-serif',cursive:'"Brush Script MT", cursive',marker:'"Comic Sans MS", cursive',sleek:'"Lucida Console", monospace',serif:'Georgia, serif',rounded:'"Trebuchet MS", sans-serif',editorial:'"Palatino Linotype", Palatino, serif'});
export const filterStyles=Object.freeze({none:'none',grayscale:'grayscale(1)',sepia:'sepia(.8)',contrast:'contrast(1.3)',warm:'sepia(.25) saturate(1.2)',cool:'hue-rotate(15deg) saturate(.8)',vivid:'saturate(1.55) contrast(1.08)',vintage:'sepia(.4) saturate(.75) contrast(.92)',fade:'contrast(.85) saturate(.8) brightness(1.1)',dramatic:'contrast(1.45) saturate(.75) brightness(.9)',bright:'brightness(1.16) saturate(1.1)',ink:'grayscale(1) contrast(1.6)'});
export const optionLabel=value=>({'3d-pop':'3D pop',classic:'Classic',typewriter:'Typewriter',modern:'Modern',impact:'Impact',cursive:'Script',marker:'Marker',sleek:'Mono',serif:'Serif',rounded:'Rounded',editorial:'Editorial',none:'Original',grayscale:'Mono',sepia:'Sepia',contrast:'Contrast',warm:'Warm',cool:'Cool',vivid:'Vivid',vintage:'Vintage',fade:'Fade',dramatic:'Dramatic',bright:'Bright',ink:'Ink'})[value] || `${value[0]?.toUpperCase() || ''}${value.slice(1)}`;
export const overlayPlacements=Object.freeze([
 {label:'Top left',textX:.18,textY:.18},{label:'Top centre',textX:.5,textY:.18},{label:'Top right',textX:.82,textY:.18},
 {label:'Middle left',textX:.18,textY:.5},{label:'Centre',textX:.5,textY:.5},{label:'Middle right',textX:.82,textY:.5},
 {label:'Bottom left',textX:.18,textY:.82},{label:'Bottom centre',textX:.5,textY:.82},{label:'Bottom right',textX:.82,textY:.82}
]);
export function normalizedOverlay(entry={}) {
 const result={...OVERLAY_DEFAULTS};
 for(const [key,allowed] of [['textFont',OVERLAY_FONTS],['textStyle',OVERLAY_STYLES],['filter',MEDIA_FILTERS]])if(allowed.includes(entry[key]))result[key]=entry[key];
 for(const [key,{min,max}] of Object.entries(OVERLAY_LIMITS))if(typeof entry[key]==='number' && Number.isFinite(entry[key]))result[key]=Math.min(max,Math.max(min,entry[key]));
 if(isOverlayColor(entry.textColor))result.textColor=entry.textColor;
 return result;
}
export const filterStyle=value=>Object.hasOwn(filterStyles,value)?filterStyles[value]:'none';
export function mediaStyle(entry={}) {
 const value=normalizedOverlay(entry),x=value.textX*100,y=value.textY*100;
 return {fontFamily:fontFamilies[value.textFont],fontSize:`${value.textSize}px`,'--overlay-size':value.textSize,color:value.textColor,left:`${x}%`,top:`${y}%`,transform:`translate(-${x}%,-${y}%)`};
}
