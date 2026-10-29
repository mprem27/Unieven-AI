export const FEEDBACK_CATEGORIES={bug:'Report a problem',idea:'Suggest an improvement',experience:'Share your experience'};
export const FEEDBACK_STATUSES={new:'Received',reviewing:'Under review',planned:'Planned',resolved:'Resolved',closed:'Closed'};

export function feedbackPayload(draft){
 const category=draft.category,subject=String(draft.subject || '').trim(),message=String(draft.message || '').trim();
 if(!Object.hasOwn(FEEDBACK_CATEGORIES,category))throw new Error('Choose a feedback category.');
 if(!subject || subject.length>120)throw new Error('Add a subject of up to 120 characters.');
 if(!message || message.length>3000)throw new Error('Add a message of up to 3,000 characters.');
 const payload={category,subject,message};
 if(draft.rating!=='' && draft.rating!==undefined && draft.rating!==null){
  const rating=Number(draft.rating);
  if(!Number.isInteger(rating) || rating<1 || rating>5)throw new Error('Choose a rating from 1 to 5, or leave it blank.');
  payload.rating=rating;
 }
 return payload;
}
export const feedbackId=item=>String(item?.id || item?._id || '');
export function feedbackItems(value){return Array.isArray(value)?value:Array.isArray(value?.feedback)?value.feedback:[];}
