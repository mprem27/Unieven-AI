"""Exercise real Mongo persistence with synthetic attendance and mocked providers."""
import json
import unittest
from datetime import datetime, timezone
from concurrent.futures import ThreadPoolExecutor
from unittest.mock import patch
from uuid import uuid4

from bson import ObjectId
from fastapi import FastAPI
from fastapi.testclient import TestClient
from pymongo import MongoClient

from app.config.database import get_db
from app.routes.notifications import router
from app.schemas.notification import PushAlertPreferences
from app.security.permissions import get_current_user
from app.services.notification_service import NotificationService
from app.services.push_notification_service import PushNotificationService, push_is_silent


NOW = datetime(2026, 10, 19, 12, tzinfo=timezone.utc)


class NotificationV18Tests(unittest.TestCase):
    def setUp(self):
        self.client = MongoClient('mongodb://127.0.0.1:27017', serverSelectionTimeoutMS=1000)
        self.db = self.client['campus_test_notifications_v18_' + uuid4().hex]
        self.sid, self.other = str(ObjectId()), str(ObjectId())
        self.row = {'subjectCode': 'CS101', 'subjectName': 'Synthetic course',
                    'date': '2026-10-19', 'period': '2', 'status': 'absent', 'source': 'ams'}
        self.db.users.insert_one({'_id': ObjectId(self.sid), 'role': 'student',
                                  'absentAlertsEnabled': True, 'smsEnabled': False,
                                  'amsClassRecords': [self.row]})
        self.clock = patch('app.services.notification_service.utc_now', return_value=NOW)
        self.clock.start()
        self.push = patch('app.services.push_notification_service.PushNotificationService.send_to_user',
                          return_value={'configured': False, 'accepted': 0, 'delivered': None})
        self.provider = self.push.start()

    def tearDown(self):
        self.push.stop()
        self.clock.stop()
        self.client.drop_database(self.db.name)
        self.client.close()

    def test_new_persisted_absence_creates_one_owner_notification_across_retries(self):
        service = NotificationService(self.db)
        self.assertEqual(service.notify_new_absences(self.sid, [self.row, self.row]), 1)
        self.assertEqual(service.notify_new_absences(self.sid, [self.row]), 0)
        notifications = service.list_notifications(self.sid)
        self.assertEqual(len(notifications), 1)
        self.assertEqual(service.list_notifications(self.other), [])
        self.assertEqual(notifications[0]['type'], 'ATTENDANCE_ABSENT')
        self.assertEqual(notifications[0]['periodId'], '2')
        self.assertEqual(notifications[0]['pushStatus'], 'NOT_CONFIGURED')
        self.assertEqual(service.get_unread_count(self.sid), 1)
        service.mark_read(notifications[0]['id'], self.sid)
        self.assertEqual(service.get_unread_count(self.sid), 0)
        self.assertEqual(self.provider.call_count, 1)

    def test_absence_alerts_require_explicit_opt_in(self):
        self.db.users.update_one({'_id': ObjectId(self.sid)}, {'$unset': {'absentAlertsEnabled': ''}})
        self.assertEqual(NotificationService(self.db).notify_new_absences(self.sid, [self.row]), 0)
        self.assertEqual(self.db.notifications.count_documents({}), 0)

    def test_old_future_ambiguous_and_unpersisted_absences_do_not_alert(self):
        cases = [dict(self.row, date='2026-10-18'), dict(self.row, date='2026-10-20'),
                 dict(self.row, status='unknown'), dict(self.row, status='present'),
                 dict(self.row, period=''), dict(self.row, period='3'),
                 dict(self.row, source='manual'), dict(self.row, date='not-a-date')]
        self.assertEqual(NotificationService(self.db).notify_new_absences(self.sid, cases), 0)
        self.assertEqual(self.db.notifications.count_documents({}), 0)
        self.assertEqual(self.provider.call_count, 0)

    def test_absence_notifications_for_different_periods_are_distinct(self):
        second = dict(self.row, period='3')
        self.db.users.update_one({'_id': ObjectId(self.sid)}, {'$push': {'amsClassRecords': second}})
        self.assertEqual(NotificationService(self.db).notify_new_absences(self.sid, [self.row, second]), 2)
        self.assertEqual(self.db.notifications.count_documents({'studentId': self.sid}), 2)

    def test_concurrent_sync_retries_claim_one_absence_before_push(self):
        with ThreadPoolExecutor(max_workers=4) as pool:
            results = list(pool.map(lambda _: NotificationService(self.db).notify_new_absences(self.sid, [self.row]), range(4)))
        self.assertEqual(sum(results), 1)
        self.assertEqual(self.db.notifications.count_documents({'studentId': self.sid}), 1)
        self.assertEqual(self.provider.call_count, 1)


class PushPreferencesV18Tests(unittest.TestCase):
    def test_sound_is_opt_in_and_quiet_hours_override_sound(self):
        self.assertFalse(PushAlertPreferences().soundEnabled)
        self.assertTrue(push_is_silent({}))
        preferences = {'soundEnabled': True, 'quietHoursEnabled': True,
                       'quietHoursStart': '22:00', 'quietHoursEnd': '07:00', 'timeZone': 'Asia/Kolkata'}
        self.assertFalse(push_is_silent(preferences, NOW))  # 17:30 local
        self.assertTrue(push_is_silent(preferences, datetime(2026, 10, 19, 17, tzinfo=timezone.utc)))
        self.assertTrue(push_is_silent(dict(preferences, silent=True), NOW))
        self.assertTrue(push_is_silent(dict(preferences, timeZone='invalid'), NOW))

    def test_unconfigured_provider_never_claims_enabled_or_delivery(self):
        with patch.dict('os.environ', {'VAPID_PUBLIC_KEY': '', 'VAPID_PRIVATE_KEY': '', 'VAPID_SUBJECT': ''}):
            service = PushNotificationService(unittest.mock.MagicMock())
            service.db.__getitem__.return_value.count_documents.return_value = 1
            status = service.get_status('owner')
            self.assertFalse(status['configured'])
            self.assertFalse(status['enabled'])
            self.assertIsNone(status['publicKey'])
            result = service.send_to_user('owner', 'Synthetic title', 'Synthetic body')
            self.assertFalse(result['configured'])
            self.assertEqual(result['accepted'], 0)
            self.assertIsNone(result['delivered'])

    def test_provider_acceptance_is_not_reported_as_confirmed_delivery(self):
        with patch.dict('os.environ', {'VAPID_PUBLIC_KEY': 'fixture-public',
                                      'VAPID_PRIVATE_KEY': 'fixture-private',
                                      'VAPID_SUBJECT': 'mailto:fixture@example.invalid'}):
            service = PushNotificationService(unittest.mock.MagicMock())
            service.db.__getitem__.return_value.find.return_value = [{
                '_id': ObjectId(), 'endpoint': 'https://fcm.googleapis.com/fixture',
                'p256dh': 'fixture', 'auth': 'fixture', 'preferences': {'soundEnabled': True, 'silent': True},
            }]
            with patch('app.services.push_notification_service.validate_subscription'), patch('app.services.push_notification_service.webpush') as provider:
                result = service.send_to_user('owner', 'Private subject', 'Private attendance',
                                              notification_id='fixture-id', link='//other.example')
            self.assertTrue(result['configured'])
            self.assertEqual(result['accepted'], 1)
            self.assertIsNone(result['delivered'])
            payload = json.loads(provider.call_args.kwargs['data'])
            self.assertEqual(payload['link'], '/notifications')
            self.assertTrue(payload['silent'])
            self.assertNotIn('Private', json.dumps(payload))

    def test_preference_patch_changes_only_owned_active_subscription_without_subscribing(self):
        mongo = MongoClient('mongodb://127.0.0.1:27017', serverSelectionTimeoutMS=1000)
        db = mongo['test_push_prefs_v18_' + uuid4().hex]
        try:
            own = db.push_subscriptions.insert_one({'userId': 'owner', 'endpoint': 'https://example.invalid/own', 'enabled': True}).inserted_id
            other = db.push_subscriptions.insert_one({'userId': 'other', 'endpoint': 'https://example.invalid/other', 'enabled': True}).inserted_id
            app = FastAPI()
            app.include_router(router)
            app.dependency_overrides[get_db] = lambda: db
            app.dependency_overrides[get_current_user] = lambda: {'id': 'owner'}
            with TestClient(app) as client:
                payload = {'endpoint': 'https://example.invalid/own', 'preferences': {'soundEnabled': True}}
                response = client.patch('/notifications/push/preferences', json=payload)
                self.assertEqual(response.status_code, 200, response.text)
                self.assertTrue(db.push_subscriptions.find_one({'_id': own})['preferences']['soundEnabled'])
                payload['endpoint'] = 'https://example.invalid/other'
                self.assertEqual(client.patch('/notifications/push/preferences', json=payload).status_code, 404)
                self.assertNotIn('preferences', db.push_subscriptions.find_one({'_id': other}))
                self.assertEqual(db.push_subscriptions.count_documents({}), 2)
                db.push_subscriptions.update_one({'_id': own}, {'$set': {'enabled': False}})
                payload['endpoint'] = 'https://example.invalid/own'
                self.assertEqual(client.patch('/notifications/push/preferences', json=payload).status_code, 404)
                payload['preferences']['quietHoursStart'] = '25:00'
                self.assertEqual(client.patch('/notifications/push/preferences', json=payload).status_code, 422)
        finally:
            mongo.drop_database(db.name)
            mongo.close()
