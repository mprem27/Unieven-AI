/** First administrator provisioning. Passwords are accepted only from environment variables. */
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import bcrypt from 'bcrypt';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import User from '../models/User.js';

dotenv.config({path:process.env.CAMPUS_ENV_FILE || path.resolve(path.dirname(fileURLToPath(import.meta.url)),'.env'),quiet:true});
const email=(process.env.CAMPUS_ADMIN_EMAIL || '').trim().toLowerCase();
const username=(process.env.CAMPUS_ADMIN_USERNAME || '').trim().toLowerCase();
const name=(process.env.CAMPUS_ADMIN_NAME || '').trim();
const password=process.env.CAMPUS_ADMIN_PASSWORD || '';
if(process.argv.includes('--check-existing')) {
 try {
  await mongoose.connect(process.env.MONGODB_URI);
  if(!await User.exists({$or:[{role:'admin'},{campusRole:'admin'}]})){console.log('No campus administrator exists in this database.');process.exitCode=2;}
  else console.log('An administrator already exists. Use its existing login.');
 }catch{console.error('Could not verify an existing administrator. Check Atlas access.');process.exitCode=1;}
 finally{await mongoose.disconnect();}
} else if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !/^[a-z0-9_.]{3,30}$/.test(username) || !name || name.length>120 || password.length<16 || Buffer.byteLength(password,'utf8')>72 || !/[a-z]/.test(password) || !/[A-Z]/.test(password) || !/[0-9]/.test(password) || !/[^A-Za-z0-9]/.test(password)) {
  console.error('Set CAMPUS_ADMIN_EMAIL, CAMPUS_ADMIN_USERNAME, CAMPUS_ADMIN_NAME and a strong CAMPUS_ADMIN_PASSWORD (at least 16 characters, at most 72 UTF-8 bytes, upper/lowercase, number and symbol).');
  process.exitCode=1;
} else if(!process.env.MONGODB_URI) {
  console.error('Configure MONGODB_URI or point CAMPUS_ENV_FILE at the private campus env file.');
  process.exitCode=1;
} else {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    await User.init();
    if(await User.exists({$or:[{email},{username}]})) {
      throw new Error('Account already exists. Existing accounts are never overwritten or promoted by this command.');
    }
    await User.create({name,email,username,password:await bcrypt.hash(password,12),role:'admin',campusRole:'admin',isVerified:true});
    console.log('Administrator created. Sign in using the account you supplied.');
  } catch(error) {
    console.error(error.message.startsWith('Account already exists')?error.message:'Administrator provisioning failed. Check database availability and account uniqueness.');
    process.exitCode=1;
  } finally {
    await mongoose.disconnect();
  }
}
