const escape=value=>String(value ?? '').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const short=value=>String(value ?? '').replace(/[\r\n]+/g,' ').trim().slice(0,180);
export function publicAppUrl(value) {
 try {
  const url=new URL(value),local=['localhost','127.0.0.1','[::1]'].includes(url.hostname);
  if((url.protocol!=='https:' && !(url.protocol==='http:' && local)) || url.username || url.password || url.pathname!=='/' || url.search || url.hash)return '';
  return url.origin;
 }catch{return '';}
}
function frame({title,preheader,content,plain,appUrl,route='/#/login',button='Open your workspace'}) {
 const origin=publicAppUrl(appUrl),link=origin?origin+route:'';
 const action=link?`<table role="presentation" cellspacing="0" cellpadding="0" style="margin:24px 0"><tr><td bgcolor="#0867bb" style="border-radius:8px"><a href="${escape(link)}" style="display:inline-block;padding:14px 22px;color:#ffffff;font:600 16px Arial,sans-serif;text-decoration:none">${escape(button)}</a></td></tr></table>`:'';
 return {text:plain+(link?`\n\n${button}: ${link}`:'')+'\n\nveltech-ams-mini\nDeveloped by VEL STUDENTS',html:`<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escape(title)}</title></head>
<body style="margin:0;background:#f1f5f9;color:#153047;font-family:Arial,sans-serif">
<div style="display:none;max-height:0;overflow:hidden;opacity:0">${escape(preheader)}</div>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="600" cellspacing="0" cellpadding="0" style="width:100%;max-width:600px;background:#ffffff;border:1px solid #dce6ef;border-radius:12px;overflow:hidden">
<tr><td bgcolor="#153047" style="padding:24px;color:#ffffff;font-size:21px;font-weight:700">veltech-ams-mini<div style="font-size:13px;font-weight:400;margin-top:6px;color:#cce4f2">One campus. Together.</div></td></tr>
<tr><td style="padding:28px 24px;font-size:16px;line-height:1.65"><h1 style="margin:0 0 18px;font-size:24px;line-height:1.3;color:#153047">${escape(title)}</h1>${content}${action}</td></tr>
<tr><td style="padding:18px 24px;border-top:1px solid #e5edf4;font-size:12px;line-height:1.6;color:#60758a">Sent by veltech-ams-mini.<br>Developed by VEL STUDENTS</td></tr>
</table></td></tr></table></body></html>`};
}
export function verificationEmail({purpose='reset',code,name,appUrl}={}) {
 if(!/^\d{6}$/.test(String(code ?? '')))throw new TypeError('A six-digit verification code is required.');
 const titles={reset:'Reset your application password',recovery:'Verify your recovery email',signup:'Verify your email'};
 const title=titles[purpose] || titles.reset,greeting=name?`Hello ${name},`:'Hello,';
 const instruction='It expires in 5 minutes and works only in the browser that requested it. Do not share this code.';
 const notice=purpose==='reset'?'This changes only your application password. Your university AMS password remains unchanged.':'This verifies the email address for your application account.';
 return {subject:`veltech-ams-mini · ${title}`,...frame({title,preheader:'Your single-use verification code',appUrl,
  plain:`${greeting}\n\nYour verification code is ${code}. ${instruction}\n\n${notice}\nIf you did not request this email, you can ignore it.`,
  content:`<p>${escape(greeting)}</p><p>Your verification code is:</p><div style="padding:18px 12px;margin:18px 0;border:1px solid #c9e0f8;background:#eef6ff;border-radius:8px;text-align:center;color:#075ca9;font-size:32px;font-weight:700;letter-spacing:6px">${code}</div><p>${escape(instruction)}</p><p>${escape(notice)}</p><p style="font-size:14px;color:#60758a">If you did not request this email, you can ignore it.</p>`})};
}
export function eventEmail({kind='receipt',name='student',title='',when='',location='',registrationId='',amountPaise=0,paymentId='',appUrl,cancelled=false}={}) {
 const heading=cancelled?'Event update':kind==='reminder'?'Your event starts soon':'Registration confirmed';
 const intro=cancelled?'This event has been cancelled. Contact the organizer for the next steps.':kind==='reminder'?'Your registered event starts soon.':'Your event registration is confirmed.';
 const payment=amountPaise>0?`Verified payment: INR ${(amountPaise/100).toFixed(2)}.${paymentId?` Payment reference: ${paymentId}.`:''}`:'Free registration.';
 const details=[['Event',title],['When',when],['Location',location],['Registration',registrationId]].filter(([,value])=>value);
 const rows=details.map(([label,value])=>`<tr><th align="left" valign="top" style="padding:9px 10px 9px 0;width:110px;font-size:14px;color:#60758a;font-weight:400">${escape(label)}</th><td style="padding:9px 0;font-size:15px;overflow-wrap:anywhere">${escape(value)}</td></tr>`).join('');
 return {subject:`${heading}: ${short(title)}`,...frame({title:heading,preheader:short(title),appUrl,route:'/#/events/tickets',button:'View your ticket',
  plain:`Hello ${name},\n\n${intro}\n${details.map(([label,value])=>`${label}: ${value}`).join('\n')}\n${payment}\n\nOpen Events → Your ticket after signing in for your private check-in QR.`,
  content:`<p>Hello ${escape(name)},</p><p>${escape(intro)}</p><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-top:1px solid #e5edf4;border-bottom:1px solid #e5edf4;margin:20px 0">${rows}</table><p>${escape(payment)}</p><p style="font-size:14px;color:#60758a">Your private check-in QR is available only after signing in. Do not forward your ticket or verification codes.</p>`})};
}
export function testEmail({appUrl}={}) {
 return {subject:'veltech-ams-mini · Email delivery test',...frame({title:'Your email setup is connected',preheader:'SMTP delivery test',appUrl,
  plain:'This is the email test you requested from your server. If you can read this, the message reached this mailbox. No student data is included.',
  content:'<p>This is the email test you requested from your server.</p><p>If you can read this, the message reached this mailbox. No student data is included.</p>'})};
}

export function announcementEmail({title='',body='',name='',appUrl,moderation=false}={}){
 const heading=short(title),greeting=name?`Hello ${name},`:'Hello,';
 return {subject:`veltech-ams-mini · ${heading}`,...frame({title:heading,preheader:moderation?'A campus moderation decision for your content':'An update from your campus staff',appUrl,route:'/#/notifications',button:'View your notifications',plain:`${greeting}\n\n${body}`,content:`<p>${escape(greeting)}</p><p style="white-space:pre-wrap;overflow-wrap:anywhere">${escape(body)}</p>`})};
}
