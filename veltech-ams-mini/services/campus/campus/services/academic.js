import axios from 'axios';
import {fail} from '../security.js';
function upstreamFailure(error,status,message){
  const failure=Object.assign(new Error(error.response?.data?.detail || message),{status});
  const retry=Number(error.response?.headers?.['retry-after']);
  if([429,503].includes(status) && Number.isInteger(retry) && retry>0 && retry<=300)failure.retryAfter=retry;
  throw failure;
}
export function academicClient(baseURL,serviceKey='') {
  const client=axios.create({baseURL,timeout:60000,maxRedirects:0});
  return {
    async bootstrap(identity,academicId) {
      if(!serviceKey) fail(503,'The internal academic workspace connection is not configured');
      try {return (await client.post(academicId?'/campus/bridge/bind':'/campus/bridge/session',{...identity,...(academicId?{academicId}:{})},{headers:{'X-Campus-Service-Key':serviceKey}})).data;}
      catch(error) {upstreamFailure(error,error.response?.status || 502,'The academic workspace could not be prepared. Retry after the service starts.');}
    },
    async internal(path,body) {
      if(!serviceKey) fail(503,'The internal academic connection is not configured');
      try{return (await client.post(path,body,{headers:{'X-Campus-Service-Key':serviceKey},...(path==='/campus/portal-login/session'?{timeout:120000}:{})})).data;}
      catch(error){upstreamFailure(error,error.response?.status || 502,'The academic service could not complete this request.');}
    },
    async login(email,password) {
      const {data}=await client.post('/auth/login',{email,password});
      const token=data.accessToken;
      const me=await client.get('/auth/me',{headers:{Authorization:`Bearer ${token}`}});
      return {token,user:me.data};
    },
    async request(token,path,method='GET',body) {
      try {return (await client.request({url:path,method,data:body,headers:{Authorization:`Bearer ${token}`},...(path==='/campus/ams/refresh'?{timeout:120000}:{})})).data;}
      catch(error) {
        const status=error.response?.status;
        if(status===401) fail(401,'Academic session expired. Reconnect your academic account.');
        if(status===403) fail(403,'The linked academic account cannot access this resource.');
        upstreamFailure(error,status && (status<500 || status===503)?status:502,'Academic service is unavailable. Retry after it starts.');
      }
    }
  };
}
