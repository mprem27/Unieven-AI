"""Short-lived, account-bound manual CAPTCHA sessions; no passwords are retained."""
import asyncio,secrets,time
from app.services.ams.ams_adapter import AmsAdapter
from app.services.ams.login_admission import SourceLoginBusy, source_login_admission

_sessions={}
_lock=asyncio.Lock()

async def prepare_challenge(owner):
    # Admission precedes replacement: a rejected request keeps the owner's
    # existing challenge usable. Do not hold the session lock over source I/O.
    async with source_login_admission.slot():
        async with _lock:
            now=time.monotonic()
            if len(_sessions)>=100 and not any(item['expires']<=now or item['owner']==owner for item in _sessions.values()):
                raise SourceLoginBusy()
        prepared=await AmsAdapter().prepare_login()
        retired=[];key=None
        try:
            try:
                async with _lock:
                    now=time.monotonic()
                    for old_key,item in list(_sessions.items()):
                        if item['expires']<=now or item['owner']==owner:
                            retired.append(_sessions.pop(old_key)['prepared']['client'])
                    if len(_sessions)>=100:raise SourceLoginBusy()
                    key=secrets.token_urlsafe(32)
                    _sessions[key]={'owner':owner,'expires':now+300,'prepared':prepared}
            finally:
                closed=await asyncio.gather(*(client.aclose() for client in retired),return_exceptions=True)
                for result in closed:
                    if isinstance(result,BaseException):raise result
            return {'challengeId':key,'display':prepared['challenge'],'requiresCaptcha':prepared['requiresCaptcha'],'expiresIn':300}
        except BaseException:
            async with _lock:
                if key and _sessions.get(key,{}).get('prepared') is prepared:_sessions.pop(key)
            await prepared['client'].aclose()
            raise

async def take_challenge(owner,key):
    async with _lock:
        item=_sessions.get(key)
        if not item or item['owner']!=owner:raise ValueError('Load a new AMS challenge for your own account.')
        _sessions.pop(key)
        if item['expires']<=time.monotonic():
            await item['prepared']['client'].aclose();raise ValueError('The AMS challenge expired. Load a fresh challenge.')
        return item['prepared']
