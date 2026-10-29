import unittest
from app.services.ams.ams_adapter import parse_login_form, AmsChallengeRequired

class LoginFormTests(unittest.TestCase):
    def test_nonce_is_preserved_and_challenge_is_required(self):
        form = parse_login_form('<form><input type="hidden" name="loginNonce" value="nonce-test"><div class="captcha">TEST-CHALLENGE</div><input name="captcha"></form>')
        self.assertEqual(form['fields']['loginNonce'], 'nonce-test')
        self.assertTrue(form['requiresCaptcha'])
        self.assertEqual(form['challenge'], 'TEST-CHALLENGE')

    def test_template_page_is_rejected_instead_of_posting_password(self):
        with self.assertRaises(AmsChallengeRequired):
            parse_login_form('<input type="hidden" name="loginNonce" value="{{NONCE}}"><div class="captcha">{{CAPTCHA}}</div>')


class LoginSubmissionTests(unittest.IsolatedAsyncioTestCase):
    async def test_credentials_are_not_submitted_without_manual_captcha(self):
        import httpx
        from unittest.mock import patch
        from app.services.ams.ams_adapter import AmsAdapter
        calls=[]
        def handle(request):
            calls.append(request.method)
            return httpx.Response(200,text='<form><input type="hidden" name="loginNonce" value="test"><div class="captcha">TEST-ONLY</div><input name="captcha"></form>')
        client=httpx.AsyncClient(transport=httpx.MockTransport(handle))
        with patch('app.services.ams.ams_adapter.httpx.AsyncClient',return_value=client):
            with self.assertRaises(AmsChallengeRequired):
                await AmsAdapter().login('VTU_TEST','not-real-credentials')
        self.assertEqual(calls,['GET'])
        self.assertTrue(client.is_closed)

    async def test_challenge_is_owned_and_can_only_be_used_once(self):
        from unittest.mock import patch, AsyncMock
        from app.services.ams.manual_session import prepare_challenge,take_challenge
        client=type('Client',(),{'aclose':AsyncMock()})()
        prepared={'client':client,'fields':{'loginNonce':'test'},'challenge':'TEST-ONLY','requiresCaptcha':True}
        with patch('app.services.ams.manual_session.AmsAdapter.prepare_login',AsyncMock(return_value=prepared)):
            challenge=await prepare_challenge('student-alpha')
        with self.assertRaises(ValueError):await take_challenge('student-beta',challenge['challengeId'])
        self.assertIs(await take_challenge('student-alpha',challenge['challengeId']),prepared)
        with self.assertRaises(ValueError):await take_challenge('student-alpha',challenge['challengeId'])
