import base64
import unittest
from unittest.mock import patch
from fastapi import HTTPException

def encoded(data):return base64.urlsafe_b64encode(data).decode().rstrip('=')
class PushSecurityTests(unittest.TestCase):
    def test_endpoint_keys_and_resolved_network_are_validated(self):
        from app.services.push_notification_service import validate_subscription
        keys=(encoded(b'\x04'+b'x'*64),encoded(b'x'*16))
        with patch('socket.getaddrinfo',return_value=[(2,1,6,'',('142.250.1.1',443))]):
            validate_subscription('https://fcm.googleapis.com/fcm/send/example',*keys)
        for endpoint in ('http://fcm.googleapis.com/a','https://127.0.0.1/a','https://example.com/a','https://fcm.googleapis.com:8080/a','https://fcm.googleapis.com.evil.example/a','https://user:pass@fcm.googleapis.com/a'):
            with self.assertRaises(HTTPException):validate_subscription(endpoint,*keys)
        with patch('socket.getaddrinfo',return_value=[(2,1,6,'',('127.0.0.1',443))]):
            with self.assertRaises(HTTPException):validate_subscription('https://fcm.googleapis.com/a',*keys)
        with self.assertRaises(HTTPException):validate_subscription('https://fcm.googleapis.com/a','bad','bad')
