"""Synthetic source sessions; no external AMS calls or credentials."""
import asyncio
import unittest
from types import SimpleNamespace
from unittest.mock import AsyncMock,MagicMock,patch
from fastapi import HTTPException
from app.services.ams.active_sessions import ActiveSessionStore

class LiveSourceCapabilityTests(unittest.IsolatedAsyncioTestCase):
 async def test_capability_is_owner_bound_nonsecret_and_does_not_extend_ttl(self):
  now=[10.0];store=ActiveSessionStore(ttl_seconds=30,clock=lambda:now[0]);adapter=SimpleNamespace(logout=AsyncMock())
  self.assertTrue(callable(getattr(store,'capability',None)),'Status needs actual retained-session capability')
  try:
   await store.retain('mine',{'client':object(),'username':'private-id','password':'never retained'},adapter)
   value=await store.capability('mine');self.assertEqual(value,{'state':'active','refreshAvailable':True,'expiresInSeconds':30,'retryAfterSeconds':0})
   self.assertEqual((await store.capability('foreign'))['refreshAvailable'],False)
   now[0]=25;self.assertEqual((await store.capability('mine'))['expiresInSeconds'],15)
   now[0]=41;self.assertEqual((await store.capability('mine'))['state'],'reconnect_required')
   with self.assertRaises(ValueError):await store.start_job('mine',AsyncMock())
  finally:await store.close_all()
 async def test_logout_and_closed_upstream_client_disable_refresh(self):
  store=ActiveSessionStore();adapter=SimpleNamespace(logout=AsyncMock());client=SimpleNamespace(is_closed=False)
  self.assertTrue(callable(getattr(store,'capability',None)))
  try:
   await store.retain('mine',{'client':client},adapter);client.is_closed=True
   self.assertFalse((await store.capability('mine'))['refreshAvailable'])
   await store.revoke('mine');self.assertFalse((await store.capability('mine'))['refreshAvailable'])
  finally:await store.close_all()
 async def test_finished_jobs_have_an_owner_cooldown_without_extending_expiry(self):
  now=[100.0];store=ActiveSessionStore(ttl_seconds=300,clock=lambda:now[0]);adapter=SimpleNamespace(logout=AsyncMock());done=asyncio.Event()
  self.assertTrue(callable(getattr(store,'capability',None)))
  try:
   await store.retain('mine',{'client':object()},adapter)
   async def read(*_args):done.set()
   self.assertTrue(await store.start_job('mine',read,min_interval_seconds=120));await done.wait();await asyncio.sleep(0);await asyncio.sleep(0)
   with self.assertRaises(HTTPException) as caught:await store.start_job('mine',read,min_interval_seconds=120)
   self.assertEqual(caught.exception.status_code,429);self.assertEqual(caught.exception.headers,{'Retry-After':'120'})
   self.assertEqual((await store.capability('mine'))['expiresInSeconds'],300)
   now[0]=220;self.assertTrue(await store.start_job('mine',read,min_interval_seconds=120))
  finally:await store.close_all()
 async def test_status_endpoint_includes_current_owners_capability_without_reading_upstream(self):
  from app.routes.campus import sync_status
  from inspect import isawaitable
  with patch('app.routes.campus.read_sync_status',return_value={'state':'partial','lastSuccessAt':'original'}),patch('app.routes.campus.active_ams_sessions') as store:
   store.capability=AsyncMock(return_value={'state':'active','refreshAvailable':True,'expiresInSeconds':15,'retryAfterSeconds':0})
   value=sync_status(current_user={'id':'owner'},db=MagicMock())
   if isawaitable(value):value=await value
   self.assertIn('sourceSession',value);self.assertEqual(value['lastSuccessAt'],'original');store.capability.assert_awaited_once_with('owner')
 async def test_rate_limited_admission_preserves_saved_status_and_the_owner_session(self):
  from app.routes.campus import ams_refresh
  with patch('app.services.ams.sync_jobs.enqueue_sync',new_callable=AsyncMock,side_effect=HTTPException(429,'Please wait.',headers={'Retry-After':'120'})),patch('app.routes.campus.fail_sync') as fail,patch('app.routes.campus.active_ams_sessions.revoke',new_callable=AsyncMock) as revoke:
   with self.assertRaises(HTTPException) as caught:await ams_refresh(current_user={'id':'owner'},db=MagicMock())
   self.assertEqual(caught.exception.status_code,429);fail.assert_not_called();revoke.assert_not_awaited()
