import {existsSync,readFileSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import dotenv from 'dotenv';
import {createMailProvider,inspectMailConfiguration,testEmail} from '../services/mail.js';
const root=fileURLToPath(new URL('../../../../',import.meta.url));
const args=process.argv.slice(2),known=arg=>arg==='--verify' || arg.startsWith('--env-file=') || arg.startsWith('--send-to=');
if(args.some(arg=>!known(arg) || (arg.includes('=') && !arg.split('=').slice(1).join('='))) || new Set(args.map(arg=>arg.split('=')[0])).size!==args.length) {
 console.error('Usage: npm run email:check -- [--env-file=.private/campus.env] [--verify] [--send-to=your-own-address]');process.exitCode=1;
}else {
 const option=name=>args.find(value=>value.startsWith(`${name}=`))?.slice(name.length+1);
 const explicitFile=option('--env-file'),file=path.resolve(root,explicitFile || '.private/campus.env');
 let env;
 try {
  if(explicitFile && !existsSync(file))throw new Error();
  env={...(existsSync(file)?dotenv.parse(readFileSync(file)):{}),...process.env};
 }catch{console.error('CHECK The selected private environment file could not be read. No configuration values were printed.');process.exitCode=1;}
 if(env) {
  const config=inspectMailConfiguration(env);
  if(!config.configured){for(const issue of config.issues)console.error(`CHECK ${issue}`);process.exitCode=1;}
  else {
   console.log(`OK ${config.provider.toUpperCase()} email configuration is structurally valid. Credentials are hidden.`);
   if(!env.CAMPUS_PUBLIC_URL)console.log('NOTE Set CAMPUS_PUBLIC_URL to your public HTTPS origin to include app links in emails.');
   const mail=createMailProvider(env),recipient=option('--send-to');
   try {
    if(args.includes('--verify') || (recipient && config.provider==='smtp')) {
     await mail.verify();console.log('OK SMTP connection and configured security/authentication checked. No email has been sent by this verification step.');
    }
    if(recipient) {
     await mail.send({to:recipient,...testEmail({appUrl:env.CAMPUS_PUBLIC_URL})});
     console.log('OK The provider accepted the requested test message. Check the recipient inbox and Spam folder to confirm delivery.');
    }else if(!args.includes('--verify'))console.log('UNRUN Network authentication and inbox delivery. Add --verify, or --send-to=your-own-address for an explicit test.');
   }catch(error){console.error(`CHECK ${error.status?error.message:'Email verification failed. Check the provider configuration and hosting outbound rules.'}`);process.exitCode=1;}
   finally{mail.close();}
  }
 }
}
