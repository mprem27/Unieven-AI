"""Bounded, process-local authenticated AMS clients. No passwords or CAPTCHA answers.

Run one academic worker until an owner-bound shared upstream-session design is deployed.
Campus browser sessions are independent of this deliberately short upstream lifetime.
"""
import asyncio
import time
import math
from contextlib import asynccontextmanager
from dataclasses import dataclass,field
from fastapi import HTTPException

_ALLOWED_SESSION_FIELDS={'client','username','portalUsername','vtuNumber','studentId','rollNumber','registrationNumber','dashboard_html','url'}
_EXPIRED='AMS sign-in expired. Sign in with your AMS username and password again.'

@dataclass
class _Entry:
    portal:dict
    adapter:object
    expires:float
    lock:asyncio.Lock=field(default_factory=asyncio.Lock)
    closed:bool=False
    expiry_task:asyncio.Task|None=None
    sync_task:asyncio.Task|None=None
    refresh_after:float=0

class ActiveSessionStore:
    def __init__(self,ttl_seconds=1800,capacity=100,clock=time.monotonic,sync_concurrency=3):
        self._ttl=ttl_seconds
        self._capacity=capacity
        self._clock=clock
        self._entries={}
        self._lock=asyncio.Lock()
        self._sync_slots=asyncio.Semaphore(sync_concurrency)

    @asynccontextmanager
    async def record_sync_slot(self,*,wait_timeout=None):
        """One shared report limit for retained jobs and legacy manual sync.

        Browser requests use a short deadline; queued retained jobs are bounded
        by session capacity and can wait without keeping a browser call open.
        """
        try:
            if wait_timeout is None:await self._sync_slots.acquire()
            else:await asyncio.wait_for(self._sync_slots.acquire(),timeout=wait_timeout)
        except TimeoutError:
            raise HTTPException(503,'AMS record sync is busy. Please retry shortly.',headers={'Retry-After':'3'}) from None
        try:yield
        finally:self._sync_slots.release()

    async def _close(self,entry):
        task=entry.sync_task
        if task and task is not asyncio.current_task() and not task.done():
            task.cancel()
            try:await task
            except (asyncio.CancelledError,Exception):pass
        async with entry.lock:
            if entry.closed:return
            entry.closed=True
            if entry.expiry_task and entry.expiry_task is not asyncio.current_task():entry.expiry_task.cancel()
            try:await asyncio.wait_for(entry.adapter.logout(entry.portal),timeout=3.0)
            except Exception:
                client=entry.portal.get('client')
                if client:
                    try:await client.aclose()
                    except Exception:pass

    async def _expire(self,owner,entry):
        await asyncio.sleep(self._ttl)
        async with self._lock:
            if self._entries.get(owner) is not entry:return
            self._entries.pop(owner)
        await self._close(entry)

    async def retain(self,owner,portal,adapter):
        # Copy only the adapter's required client/identity/source fields, never input credentials.
        entry=_Entry({key:value for key,value in portal.items() if key in _ALLOWED_SESSION_FIELDS},adapter,self._clock()+self._ttl)
        async with self._lock:
            expired=[self._entries.pop(key) for key,item in list(self._entries.items()) if item.expires<=self._clock()]
            old=self._entries.pop(owner,None)
            accepted=len(self._entries)<self._capacity
            if accepted:
                self._entries[owner]=entry
                entry.expiry_task=asyncio.create_task(self._expire(owner,entry))
        for stale in [*expired,*([old] if old else [])]:await self._close(stale)
        return accepted

    @asynccontextmanager
    async def use(self,owner):
        async with self._lock:
            entry=self._entries.get(owner)
            expired=entry and entry.expires<=self._clock()
            if expired:self._entries.pop(owner)
        if expired:await self._close(entry)
        if not entry or expired:raise ValueError(_EXPIRED)
        async with entry.lock:
            async with self._lock:
                valid=self._entries.get(owner) is entry and entry.expires>self._clock()
            if not valid or entry.closed:raise ValueError(_EXPIRED)
            yield entry.portal,entry.adapter

    async def capability(self,owner):
        """Nonsecret availability only; observing a client never renews its TTL."""
        async with self._lock:
            entry=self._entries.get(owner)
            active=bool(entry and not entry.closed and entry.expires>self._clock()
                        and getattr(entry.portal.get('client'),'is_closed',False) is not True)
            return {'state':'active' if active else 'reconnect_required','refreshAvailable':active,
                    'expiresInSeconds':max(0,math.ceil(entry.expires-self._clock())) if active else 0,
                    'retryAfterSeconds':max(0,math.ceil(entry.refresh_after-self._clock())) if active else 0}

    async def start_job(self,owner,callback,*,on_cancel=None,min_interval_seconds=0):
        """Start one bounded job per retained owner; no caller credentials are captured."""
        async with self._lock:
            entry=self._entries.get(owner)
            if not entry or entry.closed or entry.expires<=self._clock() or getattr(entry.portal.get('client'),'is_closed',False) is True:raise ValueError(_EXPIRED)
            if entry.sync_task and not entry.sync_task.done():return False
            if entry.refresh_after>self._clock():
                raise HTTPException(429,'AMS was checked recently. Please wait before syncing again.',
                                    headers={'Retry-After':str(math.ceil(entry.refresh_after-self._clock()))})
            entry.refresh_after=self._clock()+min_interval_seconds
            async def run():
                async with self.record_sync_slot():
                    async with entry.lock:
                        async with self._lock:
                            valid=self._entries.get(owner) is entry and entry.expires>self._clock()
                        if not valid or entry.closed:return
                        await callback(entry.portal,entry.adapter)
            def finished(task):
                current_job=entry.sync_task is task
                if current_job:entry.sync_task=None
                if task.cancelled():
                    current_entry=self._entries.get(owner)
                    # A done callback also runs when cancellation precedes the
                    # coroutine's first turn or occurs while waiting for a slot.
                    # An old client must not fail a replacement owner's job.
                    if current_job and on_cancel and (current_entry is entry or current_entry is None):on_cancel()
                else:task.exception()
            entry.sync_task=asyncio.create_task(run())
            entry.sync_task.add_done_callback(finished)
        return True

    async def close_all(self):
        async with self._lock:
            entries=list(self._entries.values());self._entries.clear()
        await asyncio.gather(*(self._close(entry) for entry in entries),return_exceptions=True)

    async def revoke(self,owner):
        async with self._lock:entry=self._entries.pop(owner,None)
        if entry:await self._close(entry)

active_ams_sessions=ActiveSessionStore()
