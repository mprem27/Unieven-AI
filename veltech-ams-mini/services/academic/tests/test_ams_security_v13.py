import unittest
from unittest.mock import AsyncMock, MagicMock
import httpx

class AmsSecurityTests(unittest.IsolatedAsyncioTestCase):
    def test_login_url_checks_only_path_and_generic_security_copy_is_not_a_login_error(self):
        from app.services.ams.ams_adapter import AmsAdapter
        self.assertFalse(AmsAdapter._is_login_page('https://ams.veltech.edu.in/Default.aspx?returnUrl=/Login.aspx'))
        self.assertTrue(AmsAdapter._is_login_page('https://ams.veltech.edu.in/Login.aspx'))
        self.assertFalse(AmsAdapter._contains_authentication_error('<p>Never share your username or password.</p>'))
        self.assertTrue(AmsAdapter._contains_authentication_error('<p>Invalid username or password.</p>'))
    async def test_photo_fetch_refuses_other_hosts_and_redirects(self):
        from app.services.ams.safe_photo import fetch_source_photo
        client=MagicMock()
        self.assertIsNone(await fetch_source_photo(client,'http://127.0.0.1/private'))
        self.assertIsNone(await fetch_source_photo(client,'https://attacker.example/image.png'))
        client.stream.assert_not_called()
        client.stream.return_value.__aenter__=AsyncMock(return_value=httpx.Response(302,headers={'location':'http://127.0.0.1'},request=httpx.Request('GET','https://ams.veltech.edu.in/photo.png')))
        client.stream.return_value.__aexit__=AsyncMock(return_value=False)
        self.assertIsNone(await fetch_source_photo(client,'https://ams.veltech.edu.in/photo.png'))
        self.assertFalse(client.stream.call_args.kwargs['follow_redirects'])
    async def test_valid_bounded_jpeg_becomes_private_data_uri(self):
        from app.services.ams.safe_photo import fetch_source_photo
        client=MagicMock();client.stream.return_value.__aenter__=AsyncMock(return_value=httpx.Response(200,content=b'\xff\xd8\xff\xe0test',headers={'content-type':'image/jpeg'},request=httpx.Request('GET','https://ams.veltech.edu.in/p.jpg')))
        client.stream.return_value.__aexit__=AsyncMock(return_value=False)
        self.assertTrue((await fetch_source_photo(client,'https://ams.veltech.edu.in/p.jpg')).startswith('data:image/jpeg;base64,'))
