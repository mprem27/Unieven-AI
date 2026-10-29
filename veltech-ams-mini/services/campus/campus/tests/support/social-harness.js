import {duplicateKey} from '../../security.js';
import express from 'express';
import mongoose from 'mongoose';
import User from '../../../models/User.js';
export async function harness(name,register) {
  await mongoose.connect(`mongodb://127.0.0.1:27017/campus_test_v13_${name}_${process.pid}`);
  await User.init();
  const app=express();app.use(express.json());
  const router=express.Router();
  const auth=async(req,_res,next)=>{const id=req.headers['x-test-user'];req.user=typeof id==='string'&&/^[a-f0-9]{24}$/i.test(id)?await User.findById(id):null;if(!req.user){const error=new Error('Sign in');error.status=401;throw error;}next();};
  register(router,{auth});app.use(router);
  app.use((_req,res)=>res.status(404).json({message:'Endpoint not found'}));
  app.use((error,_req,res,_next)=>res.status(error.status || (duplicateKey(error)?409:error.name==='ValidationError'?400:500)).json({message:error.message}));
  const server=app.listen(0);await new Promise(resolve=>server.once('listening',resolve));
  const base=`http://127.0.0.1:${server.address().port}`;
  return {base,async call(path,{user,method='GET',body}={}){const response=await fetch(base+path,{method,headers:{...(user?{'X-Test-User':String(user._id ?? user)}:{}),...(body?{'Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined});return {status:response.status,body:await response.json()};},async close(){await new Promise(resolve=>server.close(resolve));await mongoose.connection.dropDatabase();await mongoose.disconnect();}};
}
export const member=(username,fields={})=>User.create({username,email:`${username}@example.test`,password:'unused-test-hash',name:username,...fields});
export async function clearCollections(){for(const collection of Object.values(mongoose.connection.collections))await collection.deleteMany({});}
