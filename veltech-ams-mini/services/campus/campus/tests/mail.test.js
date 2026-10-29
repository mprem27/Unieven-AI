import test from 'node:test';
import assert from 'node:assert/strict';
import nodemailer from 'nodemailer';
import * as mail from '../services/mail.js';
const env={NODE_ENV:'production',CAMPUS_MAIL_FROM:'Veltech mini <sender@example.test>',SMTP_HOST:'smtp.example.test',SMTP_PORT:'587',SMTP_USER:'smtp-user',SMTP_PASS:'private-fixture-password',CAMPUS_PUBLIC_URL:'https://campus.example.test'};
function transport(t,send=async()=>({accepted:['student@example.test'],messageId:'fixture-message'})) {
 const calls=[],options=[];let verified=0,closed=0;
 t.mock.method(nodemailer,'createTransport',value=>{options.push(value);return {sendMail:async value=>{calls.push(value);return send(value);},verify:async()=>{verified++;return true;},close:()=>{closed++;}};});
 return {calls,options,get verified(){return verified;},get closed(){return closed;}};
}
test('production rejects plaintext SMTP, invalid ports and incomplete credentials',()=>{
 for(const changes of [{SMTP_REQUIRE_TLS:'false'},{SMTP_PORT:'NaN'},{SMTP_PORT:'70000'},{SMTP_PASS:''},{SMTP_USER:''},{SMTP_PORT:'587',SMTP_SECURE:'true'},{CAMPUS_MAIL_FROM:'bad\r\nBcc: other@example.test'},{CAMPUS_PUBLIC_URL:'http://campus.example.test'}]) {
  assert.equal(mail.createMailProvider({...env,...changes}).configured,false,JSON.stringify(Object.keys(changes)));
 }
});
test('SMTP port 587 requires STARTTLS by default and disables file/URL reads',t=>{
 const state=transport(t);const provider=mail.createMailProvider(env);
 assert.equal(provider.configured,true);assert.equal(state.options[0].requireTLS,true);assert.equal(state.options[0].secure,false);
 assert.equal(state.options[0].disableFileAccess,true);assert.equal(state.options[0].disableUrlAccess,true);assert.ok(state.options[0].connectionTimeout<=10000);
});
test('465 uses direct TLS and local Mailpit stays available only for development',t=>{
 const state=transport(t);assert.equal(mail.createMailProvider({...env,SMTP_PORT:'465'}).configured,true);assert.equal(state.options[0].secure,true);
 assert.equal(mail.createMailProvider({NODE_ENV:'development',CAMPUS_MAIL_FROM:'Campus <campus@localhost.invalid>',SMTP_HOST:'mailpit',SMTP_PORT:'1025',SMTP_SECURE:'false',SMTP_REQUIRE_TLS:'false'}).configured,true);
 assert.equal(mail.createMailProvider({...env,SMTP_HOST:'localhost',SMTP_PORT:'1025',SMTP_REQUIRE_TLS:'false'}).configured,false);
});
test('SMTP sends both HTML and text with reply-to and checks recipient acceptance',async t=>{
 const state=transport(t);const provider=mail.createMailProvider({...env,CAMPUS_MAIL_REPLY_TO:'Help <help@example.test>'});
 const result=await provider.send({to:'student@example.test',subject:'Verification',text:'Plain code 123456',html:'<p>Code <b>123456</b></p>'});
 assert.equal(state.calls[0].html,'<p>Code <b>123456</b></p>');assert.equal(state.calls[0].replyTo,'Help <help@example.test>');assert.equal(result.accepted,true);assert.equal(result.messageId,'fixture-message');
});
test('SMTP verification checks the connection without sending email',async t=>{
 const state=transport(t);const provider=mail.createMailProvider(env);
 assert.equal(typeof provider.verify,'function');await provider.verify();provider.close();assert.equal(state.verified,1);assert.equal(state.calls.length,0);assert.equal(state.closed,1);
});
test('temporary explicit SMTP rejection gets one bounded retry',async t=>{
 let attempts=0;transport(t,async()=>{attempts++;if(attempts===1)throw Object.assign(new Error('Temporary private response'),{responseCode:451});return {accepted:['student@example.test'],messageId:'retried'};});
 const result=await mail.createMailProvider(env).send({to:'student@example.test',subject:'Code',text:'Code'});assert.equal(attempts,2);assert.equal(result.accepted,true);
});
test('permanent SMTP authentication failure is sanitized and not retried',async t=>{
 let attempts=0;transport(t,async()=>{attempts++;throw Object.assign(new Error('Rejected private-fixture-password'),{responseCode:535,code:'EAUTH'});});
 await assert.rejects(mail.createMailProvider(env).send({to:'student@example.test',subject:'Code',text:'Code'}),e=>e.status===503 && !e.message.includes('private-fixture-password'));
 assert.equal(attempts,1);
});
test('uncertain timeout after DATA is not automatically retried',async t=>{
 let attempts=0;transport(t,async()=>{attempts++;throw Object.assign(new Error('private server details'),{code:'ETIMEDOUT',command:'DATA'});});
 await assert.rejects(mail.createMailProvider(env).send({to:'student@example.test',subject:'Code',text:'Code'}),e=>e.status===503);assert.equal(attempts,1);
});
test('recipient rejection cannot be marked as accepted',async t=>{
 transport(t,async()=>({accepted:[],rejected:['student@example.test']}));
 await assert.rejects(mail.createMailProvider(env).send({to:'student@example.test',subject:'Code',text:'Code'}),e=>e.status===503);
});
test('header injection and multiple recipients are rejected before SMTP',async t=>{
 const state=transport(t),provider=mail.createMailProvider(env);
 for(const message of [{to:'one@example.test,two@example.test',subject:'Code',text:'Code'},{to:'student@example.test',subject:'Code\r\nBcc: other@example.test',text:'Code'}])await assert.rejects(provider.send(message),e=>e.status===400);
 assert.equal(state.calls.length,0);
});
test('Brevo HTTPS alternative keeps the HTML template and does not silently replace bad SMTP',async t=>{
 let body;
 t.mock.method(globalThis,'fetch',async(_url,options)=>{body=JSON.parse(options.body);return {ok:true,json:async()=>({messageId:'brevo-fixture'})};});
 const provider=mail.createMailProvider({NODE_ENV:'production',CAMPUS_MAIL_FROM:env.CAMPUS_MAIL_FROM,BREVO_API_KEY:'fixture-brevo-key'});
 const sent=await provider.send({to:'student@example.test',subject:'Hello',text:'Text',html:'<p>HTML</p>'});assert.equal(body.htmlContent,'<p>HTML</p>');assert.equal(sent.accepted,true);
 assert.equal(mail.createMailProvider({...env,SMTP_PASS:'',BREVO_API_KEY:'fixture-brevo-key'}).configured,false);
});
test('verification template contains escaped text, single-use instructions and the same OTP in text/HTML',()=>{
 const message=mail.verificationEmail?.({purpose:'reset',code:'123456',appUrl:'https://campus.example.test',name:'<script>alert(1)</script>'});
 assert.ok(message?.html);assert.match(message.html,/123456/);assert.match(message.text,/123456/);assert.match(message.html,/5 minutes/);assert.doesNotMatch(message.html,/<script>/);assert.match(message.html,/veltech-ams-mini/);assert.match(message.text,/browser/);
});
test('event template escapes campus content and keeps private ticket data behind sign-in',()=>{
 const message=mail.eventEmail?.({kind:'receipt',name:'Student',title:'Design <img src=x onerror=alert(1)>',when:'24 Oct 2026, 09:00 am IST',location:'Main & Hall',registrationId:'DEMO-TICKET',amountPaise:25000,paymentId:'DEMO-PAYMENT',appUrl:'https://campus.example.test'});
 assert.ok(message?.html);assert.match(message.text,/250\.00/);assert.match(message.html,/&lt;img/);assert.doesNotMatch(message.html,/<img|<script|onerror="/);assert.match(message.html,/https:\/\/campus\.example\.test\/#\/events\/tickets/);assert.doesNotMatch(message.html,/data:image|checkInSecret/);
});
test('email links cannot point to an attacker scheme and previews use no tracking resources',()=>{
 const message=mail.verificationEmail?.({purpose:'recovery',code:'654321',appUrl:'javascript:alert(1)'});
 assert.ok(message?.html);assert.doesNotMatch(message.html,/javascript:|<img|<script|<link\b|http-equiv/i);assert.match(message.subject,/recovery/i);
});
