import asyncio,unittest
from unittest.mock import AsyncMock
from app.services.ams.active_sessions import ActiveSessionStore
class BackgroundSyncJobsTests(unittest.IsolatedAsyncioTestCase):
 async def test_login_can_queue_a_job_without_waiting_for_slow_reports_and_duplicates_are_coalesced(self):
  store=ActiveSessionStore();self.assertTrue(hasattr(store,'start_job'),'A retained owner session needs nonblocking jobs')
  adapter=AsyncMock();await store.retain('owner',{'client':object(),'username':'fixture'},adapter)
  entered=asyncio.Event();release=asyncio.Event();done=asyncio.Event()
  async def job(portal,actual_adapter):
   self.assertIs(actual_adapter,adapter);self.assertEqual(portal['username'],'fixture');entered.set();await release.wait();done.set()
  self.assertTrue(await store.start_job('owner',job));await asyncio.wait_for(entered.wait(),1);self.assertFalse(done.is_set())
  self.assertFalse(await store.start_job('owner',job));release.set();await asyncio.wait_for(done.wait(),1);await store.revoke('owner')
 async def test_logout_cancels_the_owners_job_and_does_not_leave_a_usable_session(self):
  store=ActiveSessionStore();self.assertTrue(hasattr(store,'start_job'),'Owner revocation must cancel pending sync')
  adapter=AsyncMock();await store.retain('owner',{'client':object()},adapter);entered=asyncio.Event();cancelled=asyncio.Event()
  async def job(portal,actual_adapter):
   entered.set()
   try:await asyncio.Event().wait()
   except asyncio.CancelledError:cancelled.set();raise
  await store.start_job('owner',job);await asyncio.wait_for(entered.wait(),1);await asyncio.wait_for(store.revoke('owner'),1)
  self.assertTrue(cancelled.is_set());adapter.logout.assert_awaited_once()
  with self.assertRaises(ValueError):
   async with store.use('owner'):pass
 async def test_expired_or_foreign_owners_cannot_schedule_another_students_client(self):
  store=ActiveSessionStore();self.assertTrue(hasattr(store,'start_job'),'Jobs must use an existing owner session')
  with self.assertRaises(ValueError):await store.start_job('foreign',AsyncMock())
