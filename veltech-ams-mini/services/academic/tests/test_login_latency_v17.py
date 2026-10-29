import asyncio,unittest
from types import SimpleNamespace
from unittest.mock import AsyncMock,patch
from uuid import uuid4
from pymongo import MongoClient
from app.services.ams.active_sessions import ActiveSessionStore
from app.routes.portal_login import session,LoginInput
class LoginLatencyTests(unittest.IsolatedAsyncioTestCase):
 async def test_verified_login_returns_before_a_slow_profile_photo_or_reports_finish(self):
  client=MongoClient('mongodb://127.0.0.1:27017');db=client['campus_test_login_latency_'+uuid4().hex];store=ActiveSessionStore();entered=asyncio.Event();release=asyncio.Event();completed=asyncio.Event()
  portal={'client':SimpleNamespace(aclose=AsyncMock(),is_closed=False),'portalUsername':'vtu00000','dashboard_html':'<span id="MainContent_lblStuname">Fictional student</span><span id="MainContent_lblID">VTU00000</span>'}
  async def slow_profile(p):entered.set();await release.wait();return {'name':'Fictional student','vtuNumber':'VTU00000'}
  async def reports(*args,**kwargs):completed.set();return {'notes':[],'updated':{}}
  adapter=SimpleNamespace(login=AsyncMock(return_value=portal),get_student_profile=slow_profile,logout=AsyncMock())
  prepared={'client':portal['client']}
  try:
   with patch('app.routes.portal_login.prepare_challenge',new_callable=AsyncMock,return_value={'challengeId':'fixture-latency-challenge-123','requiresCaptcha':False}),patch('app.routes.portal_login.take_challenge',new_callable=AsyncMock,return_value=prepared),patch('app.routes.portal_login.AmsAdapter',return_value=adapter),patch('app.routes.portal_login.active_ams_sessions',store),patch('app.services.ams.sync_jobs.active_ams_sessions',store),patch('app.services.ams.sync_jobs.sync_authenticated_records',side_effect=reports):
    try:result=await asyncio.wait_for(session(LoginInput(owner='a'*64,username='fixture',password='not-retained'),db=db),1.5)
    except asyncio.TimeoutError:self.fail('Verified login waited for slow academic/profile retrieval')
    self.assertIn('token',result);self.assertTrue(result['syncPending']);self.assertEqual(result['syncStatus']['state'],'syncing')
    await asyncio.wait_for(entered.wait(),1);self.assertFalse(completed.is_set());release.set();await asyncio.wait_for(completed.wait(),1)
  finally:
   release.set();await store.close_all();client.drop_database(db.name);client.close()
