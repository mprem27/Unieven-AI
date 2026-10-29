"""Fixed official public sources; never treats website news as student attendance."""
import asyncio
import time
from datetime import datetime, timezone
from urllib.parse import urljoin, urlparse
import requests
from bs4 import BeautifulSoup

URLS={'ams':'https://ams.veltech.edu.in/Login.aspx','home':'https://play.google.com/store/apps/details?id=com.siva.homeofveltech','website':'https://www.veltech.edu.in/','student':'https://apps.veltech.edu.in/clique/'}
_cache={}

def parse_news(html):
    soup=BeautifulSoup(html,'html.parser');items=[];seen=set()
    for anchor in soup.find_all('a',href=True):
        title=' '.join(anchor.get_text(' ',strip=True).split())
        url=urljoin(URLS['website'],anchor['href']);parsed=urlparse(url)
        if parsed.scheme!='https' or parsed.hostname not in {'www.veltech.edu.in','veltech.edu.in'} or url in seen:continue
        if len(title)<25 or len(title)>260:continue
        if '/events/' not in parsed.path and not any(word in parsed.path for word in ('hackathon','winners','conference','achievement')):continue
        seen.add(url);items.append({'title':title,'url':url,'source':'Official university website'})
    return items[:8]

async def source_status():
    if time.monotonic()-_cache.get('statusTime',0)<120:return _cache['status']
    async def check(key,url):
        try:
            response=await asyncio.to_thread(requests.get,url,timeout=15.0,allow_redirects=False)
            result={'id':key,'url':url,'httpStatus':response.status_code,'reachable':200<=response.status_code<400}
            if key=='home':result.update(providerType='reference',dataSource='ams',message='Student-developed app using AMS directly; no separate data server is documented.')
            if key=='ams' and response.ok:
                from app.services.ams.ams_adapter import parse_login_form
                result['requiresCaptcha']=parse_login_form(response.text)['requiresCaptcha']
            return result
        except Exception:
            return {'id':key,'url':url,'reachable':False,'message':'Connection failed or timed out. Check the server network policy.'}
    result={'checkedAt':datetime.now(timezone.utc).isoformat(),'sources':await asyncio.gather(*(check(key,url) for key,url in URLS.items())), 'coverage':{'profile':'Authenticated AMS dashboard','photo':'Authenticated AMS student image','courses':'Authenticated AMS registered-course table','timetable':'Authenticated AMS timetable','attendance':'Authenticated AMS attendance pages; see your sync status for availability','results':'Authenticated AMS grade and assessment reports','credits':'Authenticated AMS Credit Earned Details','feesAndDocuments':'Only supported records and files actually returned by your AMS account; see your sync status'}}
    _cache.update(status=result,statusTime=time.monotonic());return result

async def public_news():
    if time.monotonic()-_cache.get('newsTime',0)<300:return _cache['news']
    response=await asyncio.to_thread(requests.get,URLS['website'],timeout=20.0,allow_redirects=False);response.raise_for_status()
    result={'sourceUrl':URLS['website'],'fetchedAt':datetime.now(timezone.utc).isoformat(),'items':parse_news(response.text)}
    _cache.update(news=result,newsTime=time.monotonic());return result

# Single-flight public fetches avoid duplicate requests during simultaneous app loads.
_status_fetch=source_status
_news_fetch=public_news
_status_lock=asyncio.Lock()
_news_lock=asyncio.Lock()
async def source_status():
    async with _status_lock:return await _status_fetch()
async def public_news():
    async with _news_lock:return await _news_fetch()
