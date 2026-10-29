import unittest
from unittest.mock import AsyncMock,MagicMock,patch
from bson import ObjectId
from app.routes.portal_login import LoginInput,session

class PortalLoginV16Tests(unittest.IsolatedAsyncioTestCase):
 async def test_credentials_only_prepare_and_return_actual_manual_verification_without_login(self):
  challenge={'challengeId':'manual-session-fixture-12345','requiresCaptcha':True,'display':'Displayed by AMS','expiresIn':300}
  with patch('app.routes.portal_login.prepare_challenge',new_callable=AsyncMock,return_value=challenge) as prepare,patch('app.routes.portal_login.take_challenge',new_callable=AsyncMock) as take,patch('app.routes.portal_login.AmsAdapter') as adapter:
   result=await session(LoginInput(owner='a'*64,username='fixture',password='not-retained'),db=MagicMock())
   self.assertEqual(result,{'verificationRequired':True,'challenge':challenge})
   prepare.assert_awaited_once_with('browser:'+'a'*64)
   take.assert_not_awaited();adapter.assert_not_called()
 async def test_credentials_only_complete_when_upstream_has_no_captcha(self):
  prepared={'client':MagicMock(aclose=AsyncMock())};portal={'portalUsername':'verified-fixture'}
  adapter=MagicMock(login=AsyncMock(return_value=portal),get_student_profile=AsyncMock(return_value={'name':'Fixture Student'}),logout=AsyncMock())
  student={'_id':ObjectId(),'email':'fixture@portal.invalid'}
  with patch('app.routes.portal_login.prepare_challenge',new_callable=AsyncMock,return_value={'challengeId':'prepared-session-fixture-12345','requiresCaptcha':False}),patch('app.routes.portal_login.take_challenge',new_callable=AsyncMock,return_value=prepared) as take,patch('app.routes.portal_login.AmsAdapter',return_value=adapter),patch('app.routes.portal_login.resolve_portal_student',return_value=student),patch('app.routes.portal_login.active_ams_sessions.retain',new_callable=AsyncMock,return_value=True) as retain,patch('app.routes.portal_login.StudentService'),patch('app.routes.portal_login.report_module'),patch('app.routes.portal_login.read_sync_status',return_value={'state':'syncing'}),patch('app.routes.portal_login.enqueue_sync',new_callable=AsyncMock,return_value=True) as enqueue:
   result=await session(LoginInput(owner='a'*64,username='fixture',password='not-retained'),db=MagicMock())
   self.assertIn('token',result);self.assertTrue(result['partial']);self.assertTrue(result['syncPending']);self.assertNotIn('verificationRequired',result)
   take.assert_awaited_once_with('browser:'+'a'*64,'prepared-session-fixture-12345')
   adapter.login.assert_awaited_once_with('fixture','not-retained',captcha='',prepared=prepared)
   enqueue.assert_awaited_once_with(unittest.mock.ANY,str(student['_id']),initial=True);retain.assert_awaited_once_with(str(student['_id']),portal,adapter);adapter.logout.assert_not_awaited();self.assertTrue(result['refreshAvailable'])
