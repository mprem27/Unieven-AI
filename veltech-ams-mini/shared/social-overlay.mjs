// The browser, API validator and media schemas use the same persisted keys.
export const OVERLAY_FONTS=Object.freeze(['classic','typewriter','modern','impact','cursive','marker','sleek','serif','rounded','editorial']);
export const OVERLAY_STYLES=Object.freeze(['classic','highlight','neon','playful','outline','glitch','3d-pop','elegant','shadow','caption','label']);
export const MEDIA_FILTERS=Object.freeze(['none','grayscale','sepia','contrast','warm','cool','vivid','vintage','fade','dramatic','bright','ink']);
export const OVERLAY_LIMITS=Object.freeze({textSize:{min:16,max:100},textX:{min:0,max:1},textY:{min:0,max:1}});
export const OVERLAY_DEFAULTS=Object.freeze({text:'',textFont:'classic',textStyle:'classic',textSize:28,textColor:'#ffffff',textX:0.5,textY:0.5,filter:'none'});
export const isOverlayColor=value=>typeof value==='string' && /^(#(?:[a-f\d]{3}|[a-f\d]{4}|[a-f\d]{6}|[a-f\d]{8})|white|black|yellow|cyan|pink|red|orange)$/i.test(value);
