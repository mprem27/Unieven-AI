import {createHash} from 'node:crypto';
import {fail} from '../security.js';
export const RECOMMENDATION_MODEL='campus-weighted-v1';
export const RECOMMENDATION_DESCRIPTION='Transparent ranking using accepted connections, your recent likes and saves, social profile department, recency, engagement, author/content diversity, and bounded refresh variation. This is a rules-based model, not a trained neural network.';
export function refreshKeyInput(value) {
  if(value===undefined)return '';
  if(typeof value!=='string'||!/^[a-z0-9_-]{1,64}$/i.test(value))fail(400,'Refresh key must be 1–64 letters, numbers, underscores, or hyphens');
  return value;
}
export function refreshKeyQuery(query={}) {
  if(Object.keys(query).some(key=>key.startsWith('refreshKey[')))fail(400,'Choose a valid refresh key');
  return refreshKeyInput(query.refreshKey);
}
export function refreshedItems(items,key) {
  return key?[...items].sort((a,b)=>refreshWeight(key,b.id)-refreshWeight(key,a.id)||String(a.id).localeCompare(String(b.id))):items;
}
export function refreshWeight(key,id) {
  if(!key)return 0;
  return createHash('sha256').update(`${key}:${id}`).digest().readUInt32BE(0)/0xffffffff;
}
export function contentTokens(text='') {
  if(typeof text!=='string')return [];
  return [...new Set((text.toLowerCase().match(/#?[a-z][a-z0-9_-]{2,29}/g) || []).map(word=>word.replace(/^#/,'')))].filter(word=>!new Set(['the','and','for','with','this','that','from','have','your','will','are','was','our','you','campus']).has(word));
}
export function rankCandidates(candidates,{userId,following=new Set(),interests=new Set(),department='',now=new Date(),limit=30,refreshKey=''}={}) {
  const clock=new Date(now).getTime();
  const scored=candidates.map(candidate=>{
    let score=refreshKey?(refreshWeight(refreshKey,`${candidate.kind}:${candidate.item.id}`)-0.5)*12:0;const reasons=[];
    if(following.has(String(candidate.authorId))){score+=40;reasons.push('From a connection you follow');}
    if(department && department.toLowerCase()===String(candidate.department || '').toLowerCase()){score+=14;reasons.push('Shared social profile department');}
    const shared=[...new Set(candidate.tokens || [])].filter(token=>interests.has(token)).length;
    if(shared){score+=Math.min(shared,3)*8;reasons.push('Similar to content you liked or saved');}
    const stamp=new Date(candidate.createdAt).getTime();
    const ageHours=Number.isFinite(stamp)?Math.max(0,(clock-stamp)/3600000):365*24;
    score+=24/(1+ageHours/48);
    if(ageHours<48)reasons.push('Recently shared');
    const engagement=Math.max(0,candidate.likes || 0)+2*Math.max(0,candidate.comments || 0)+0.1*Math.max(0,candidate.views || 0);
    score+=Math.min(18,Math.log1p(engagement)*3);
    if(engagement>=10)reasons.push('Students are engaging with this');
    if(candidate.viewed)score-=8;
    if(String(candidate.authorId)===String(userId))score-=12;
    return {...candidate,baseScore:score,reasons:reasons.length?reasons:['Discover a campus perspective']};
  });
  const chosen=[],authorCounts=new Map();let previousKind=null,run=0;
  while(scored.length && chosen.length<Math.min(50,Math.max(1,limit))) {
    for(const candidate of scored)candidate.score=candidate.baseScore-(authorCounts.get(String(candidate.authorId)) || 0)*18-(candidate.kind===previousKind?run*7:0);
    scored.sort((a,b)=>b.score-a.score || String(a.item.id).localeCompare(String(b.item.id)));
    const next=scored.shift();chosen.push({kind:next.kind,item:next.item,reasons:next.reasons.slice(0,3),score:Number(next.score.toFixed(2))});
    authorCounts.set(String(next.authorId),(authorCounts.get(String(next.authorId)) || 0)+1);
    run=next.kind===previousKind?run+1:1;previousKind=next.kind;
  }
  return chosen;
}
