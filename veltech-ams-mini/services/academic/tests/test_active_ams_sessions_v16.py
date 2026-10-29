import unittest
from unittest.mock import AsyncMock

class ActiveAmsSessionTests(unittest.IsolatedAsyncioTestCase):
 async def test_owner_bound_expiry_and_logout_close_without_retaining_passwords(self):
  from app.services.ams.active_sessions import ActiveSessionStore
  now=[100.0];store=ActiveSessionStore(ttl_seconds=30,capacity=2,clock=lambda:now[0]);adapter=AsyncMock()
  await store.retain('mine',{'client':object(),'portalUsername':'fixture','password':'never retain','captcha':'never retain'},adapter)
  async with store.use('mine') as (portal,_):
   self.assertEqual(portal['portalUsername'],'fixture');self.assertNotIn('password',portal);self.assertNotIn('captcha',portal)
  with self.assertRaises(ValueError):
   async with store.use('other'):pass
  now[0]=131
  with self.assertRaises(ValueError):
   async with store.use('mine'):pass
  adapter.logout.assert_awaited_once()
  await store.revoke('mine');self.assertEqual(adapter.logout.await_count,1)
 async def test_capacity_is_bounded_and_revocation_cannot_reopen_an_old_session(self):
  from app.services.ams.active_sessions import ActiveSessionStore
  store=ActiveSessionStore(capacity=1);adapter=AsyncMock()
  await store.retain('mine',{'client':object()},adapter)
  self.assertFalse(await store.retain('other',{'client':object()},adapter))
  await store.revoke('mine')
  with self.assertRaises(ValueError):
   async with store.use('mine'):pass
  self.assertEqual(adapter.logout.await_count,1)
 async def test_refresh_reads_only_the_authenticated_owner_and_expiry_requires_signin(self):
  from app.routes.campus import ams_refresh
  from unittest.mock import MagicMock,patch
  from fastapi import HTTPException
  db=MagicMock()
  with patch('app.services.ams.sync_jobs.enqueue_sync',new_callable=AsyncMock,return_value=True) as enqueue,patch('app.routes.campus.read_sync_status',return_value={'state':'syncing'}):
   result=await ams_refresh(current_user={'id':'my-academic-id'},db=db)
   self.assertTrue(result['success']);self.assertTrue(result['queued']);self.assertFalse(result['alreadyRunning']);self.assertEqual(result['syncStatus']['state'],'syncing');enqueue.assert_awaited_once_with(db,'my-academic-id')
  with patch('app.services.ams.sync_jobs.enqueue_sync',new_callable=AsyncMock,side_effect=ValueError('AMS sign-in expired. Sign in with your AMS username and password again.')),patch('app.routes.campus.active_ams_sessions.revoke',new_callable=AsyncMock) as revoke,patch('app.routes.campus.fail_sync'):
   with self.assertRaises(HTTPException) as caught:await ams_refresh(current_user={'id':'my-academic-id'},db=MagicMock())
   self.assertEqual(caught.exception.status_code,409)
   revoke.assert_awaited_once_with('my-academic-id')
