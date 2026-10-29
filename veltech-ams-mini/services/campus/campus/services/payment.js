import axios from 'axios';
import {fail} from '../security.js';
export function razorpayProvider(keyId,keySecret) {
  return {keyId,async createOrder({amount,currency,receipt}) {
    if(!keyId || !keySecret) fail(503,'Paid events require the college payment account to be configured.');
    const {data}=await axios.post('https://api.razorpay.com/v1/orders',{amount,currency,receipt},{auth:{username:keyId,password:keySecret},timeout:15000,maxRedirects:0});
    return data;
  }};
}
