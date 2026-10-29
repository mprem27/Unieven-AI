const keep=(value,keys)=>Object.fromEntries(keys.filter(key=>value?.[key]!==undefined).map(key=>[key,value[key]]));
export function ownActivityExport(activity,generatedAt=new Date().toISOString()){
 const fields=['id','text','caption','category','createdAt','isArchived','overlayText','hashtags','mentions'];
 return {version:1,generatedAt,scope:'Your community content',posts:(activity?.posts || []).map(item=>keep(item,fields)),reels:(activity?.reels || []).map(item=>keep(item,fields))};
}
