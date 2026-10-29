import nodemailer from 'nodemailer';
import validator from 'validator';
import {publicAppUrl} from './mail-templates.js';
export {verificationEmail,eventEmail,testEmail,publicAppUrl} from './mail-templates.js';
const header=value=>typeof value==='string' && !/[\r\n\0]/.test(value);
const mailbox=value=>header(value) && validator.isEmail(value,{allow_display_name:true,allow_utf8_local_part:false});
const address=value=>header(value) && validator.isEmail(value,{allow_utf8_local_part:false});
const truth=value=>String(value).toLowerCase()==='true';
const localHost=value=>['localhost','127.0.0.1','::1','[::1]','mailpit'].includes(String(value).toLowerCase());
function unavailable(message,code='MAIL_UNAVAILABLE') {const error=new Error(message);error.status=503;error.code=code;return error;}
export function inspectMailConfiguration(env=process.env) {
 const from=env.CAMPUS_MAIL_FROM || env.MAIL_FROM || env.SMTP_FROM || '',replyTo=env.CAMPUS_MAIL_REPLY_TO || '';
 const production=env.NODE_ENV==='production',smtp=!!env.SMTP_HOST,brevo=!!env.BREVO_API_KEY;
 const provider=smtp?'smtp':brevo?'brevo':'none',issues=[];
 if(!smtp && !brevo)issues.push('Configure SMTP_HOST or BREVO_API_KEY.');
 if(!mailbox(from))issues.push('CAMPUS_MAIL_FROM must contain one valid sender mailbox.');
 if(replyTo && !mailbox(replyTo))issues.push('CAMPUS_MAIL_REPLY_TO must contain one valid mailbox.');
 if(env.CAMPUS_PUBLIC_URL && (!publicAppUrl(env.CAMPUS_PUBLIC_URL) || (production && !env.CAMPUS_PUBLIC_URL.startsWith('https://'))))issues.push('CAMPUS_PUBLIC_URL must be an HTTPS origin without a path.');
 const port=Number(env.SMTP_PORT || 587),secure=truth(env.SMTP_SECURE) || port===465;
 const devLocal=!production && localHost(env.SMTP_HOST);
 const requireTLS=secure?false:env.SMTP_REQUIRE_TLS===undefined?!devLocal:truth(env.SMTP_REQUIRE_TLS);
 if(smtp) {
  if(!header(env.SMTP_HOST) || !/^[a-z0-9.:[\]-]+$/i.test(env.SMTP_HOST))issues.push('SMTP_HOST must be a hostname or IP without a URL scheme.');
  if(!Number.isInteger(port) || port<1 || port>65535)issues.push('SMTP_PORT must be an integer from 1 to 65535.');
  if(port===587 && secure)issues.push('Port 587 uses STARTTLS: set SMTP_SECURE=false.');
  if(!secure && !requireTLS && !devLocal)issues.push('Remote or production SMTP must require TLS.');
  if(!!env.SMTP_USER!==!!env.SMTP_PASS)issues.push('Set both SMTP_USER and SMTP_PASS, or neither for an authorized relay.');
  if(production && localHost(env.SMTP_HOST))issues.push('A local development SMTP inbox cannot deliver production email.');
  for(const key of ['SMTP_SECURE','SMTP_REQUIRE_TLS'])if(env[key]!==undefined && !['true','false',''].includes(String(env[key]).toLowerCase()))issues.push(`${key} must be true or false.`);
 }
 return {configured:provider!=='none' && issues.length===0,provider,issues,from,replyTo,port,secure,requireTLS};
}
function validateMessage(message) {
 if(!address(message?.to) || !header(message.subject) || !message.subject.trim() || message.subject.length>250 || typeof message.text!=='string' || !message.text.trim()) {
  const error=new Error('A single recipient, safe subject and plain-text email body are required.');error.status=400;throw error;
 }
 if(message.html!==undefined && typeof message.html!=='string'){const error=new Error('Email HTML must be text.');error.status=400;throw error;}
}
export function createMailProvider(env=process.env) {
 const config=inspectMailConfiguration(env);
 if(!config.configured)return {configured:false,provider:config.provider,issues:config.issues,async verify(){throw unavailable('Email configuration is incomplete. Run the server email check.');},async send(){throw unavailable('Email delivery is not configured. Ask the administrator to configure SMTP or Brevo.');},close(){}};
 if(config.provider==='smtp') {
  const transport=nodemailer.createTransport({host:env.SMTP_HOST,port:config.port,secure:config.secure,requireTLS:config.requireTLS,
   ...(env.SMTP_USER?{auth:{user:env.SMTP_USER,pass:env.SMTP_PASS}}:{}),
   connectionTimeout:10000,greetingTimeout:10000,socketTimeout:15000,
   disableFileAccess:true,disableUrlAccess:true});
  return {configured:true,provider:'smtp',issues:[],
   async verify(){try{await transport.verify();return true;}catch{throw unavailable('SMTP connection or authentication failed. Check the host, port, TLS, credentials and hosting outbound rules.','MAIL_SMTP_VERIFY');}},
   async send(message) {
    validateMessage(message);
    for(let attempt=0;attempt<2;attempt++) {
     try {
      const result=await transport.sendMail({from:config.from,to:message.to,subject:message.subject,text:message.text,...(message.html?{html:message.html}:{}),...(config.replyTo?{replyTo:config.replyTo}:{})});
      if(!result.accepted?.some(value=>String(value).toLowerCase()===message.to.toLowerCase()))throw unavailable('SMTP did not accept the recipient.','MAIL_RECIPIENT_REJECTED');
      return {accepted:true,messageId:result.messageId || ''};
     }catch(error) {
      // Retry only an explicit temporary rejection. A lost DATA response is
      // ambiguous and may already have been accepted by the remote server.
      if(attempt===0 && error.responseCode>=400 && error.responseCode<500){await new Promise(resolve=>setTimeout(resolve,200));continue;}
      throw unavailable('The email provider could not accept this message. Check server email configuration or retry later.',error.code==='EAUTH'?'MAIL_AUTHENTICATION':'MAIL_SEND_FAILED');
     }
    }
   },close(){transport.close?.();}};
 }
 const match=config.from.match(/^(.*?)\s*<([^>]+)>$/),sender=match?{name:match[1].trim().replace(/^"|"$/g,''),email:match[2]}:{email:config.from};
 return {configured:true,provider:'brevo',issues:[],
  async verify(){throw unavailable('Brevo HTTPS delivery has no SMTP connection to verify. Send an explicit test email instead.','MAIL_VERIFY_NOT_SUPPORTED');},
  async send(message) {
   validateMessage(message);
   try {
    const response=await fetch('https://api.brevo.com/v3/smtp/email',{method:'POST',headers:{'api-key':env.BREVO_API_KEY,'Content-Type':'application/json'},body:JSON.stringify({sender,to:[{email:message.to}],subject:message.subject,textContent:message.text,...(message.html?{htmlContent:message.html}:{}),...(config.replyTo?{replyTo:{email:config.replyTo.match(/<([^>]+)>/)?.[1] || config.replyTo}}:{})}),signal:AbortSignal.timeout(15000)});
    if(!response.ok)throw new Error('Provider rejected delivery');
    const value=await response.json();return {accepted:true,messageId:value.messageId || ''};
   }catch{throw unavailable('The email provider could not accept this message. Check server email configuration or retry later.','MAIL_SEND_FAILED');}
  },close(){}};
}
