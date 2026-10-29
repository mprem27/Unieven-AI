import importlib.util
import os
import unittest
from concurrent.futures import ThreadPoolExecutor
from bson import ObjectId
from fastapi import FastAPI
from fastapi.testclient import TestClient
from pymongo import MongoClient
from app.config.database import get_db
from app.config.settings import settings
from app.security.jwt import decode_access_token

class CampusBridgeTests(unittest.TestCase):
    def setUp(self):
        if importlib.util.find_spec('app.routes.campus_bridge') is None:
            return
        from app.routes.campus_bridge import router
        self.mongo = MongoClient('mongodb://127.0.0.1:27017', serverSelectionTimeoutMS=1000)
        self.db = self.mongo[f'campus_test_bridge_{os.getpid()}']
        self.db.users.delete_many({})
        self.db.users.create_index('email', unique=True)
        self.db.users.create_index('campusUserId', unique=True, sparse=True)
        self.db.users.create_index('vtuNumber', unique=True, sparse=True)
        self.previous = settings.campus_service_key
        settings.campus_service_key = 'a' * 64
        app = FastAPI(); app.include_router(router)
        app.dependency_overrides[get_db] = lambda: self.db
        self.client = TestClient(app)
        self.headers = {'X-Campus-Service-Key': settings.campus_service_key}
        self.body = {'campusId': str(ObjectId()), 'email': 'alpha@example.edu', 'name': 'Alpha', 'department': 'CSE'}

    def tearDown(self):
        if hasattr(self, 'mongo'):
            settings.campus_service_key = self.previous
            self.mongo.drop_database(self.db.name); self.mongo.close()

    def post(self, body=None, path='/campus/bridge/session', headers=None):
        if not hasattr(self, 'client'):
            self.fail('single-account bridge is missing')
        return self.client.post(path, json=body or self.body, headers=self.headers if headers is None else headers)

    def test_bridge_rejects_browser_or_wrong_service_key(self):
        self.assertEqual(self.post(headers={}).status_code, 403)
        self.assertEqual(self.post(headers={'X-Campus-Service-Key': 'wrong'}).status_code, 403)
        self.assertEqual(self.db.users.count_documents({}), 0)

    def test_new_account_and_repeated_login_resolve_same_own_student(self):
        first = self.post(); self.assertEqual(first.status_code, 200)
        result = first.json(); again = self.post().json()
        self.assertEqual(result['user']['id'], again['user']['id'])
        self.assertEqual(decode_access_token(result['token'])['sub'], result['user']['id'])
        self.assertEqual(self.db.users.count_documents({}), 1)
        self.assertNotIn('passwordHash', result['user'])

    def test_second_new_student_does_not_create_null_vtu_collision(self):
        self.assertEqual(self.post().status_code, 200)
        second = {**self.body, 'campusId': str(ObjectId()), 'email': 'beta@example.edu'}
        self.assertEqual(self.post(second).status_code, 200)
        self.assertEqual(self.db.users.count_documents({'vtuNumber': {'$exists': False}}), 2)

    def test_existing_email_is_not_claimed_without_verified_migration(self):
        self.db.users.insert_one({'email': self.body['email'], 'name': 'Existing', 'role': 'student', 'active': True})
        self.assertEqual(self.post().status_code, 409)
        self.assertNotIn('campusUserId', self.db.users.find_one({'email': self.body['email']}))

    def test_bound_identity_cannot_change_email_or_claim_another_campus_id(self):
        self.assertEqual(self.post().status_code, 200)
        self.assertEqual(self.post({**self.body, 'email': 'other@example.edu'}).status_code, 409)
        self.assertEqual(self.post({**self.body, 'campusId': str(ObjectId())}).status_code, 409)

    def test_migration_requires_exact_email_and_student_role(self):
        record = self.db.users.insert_one({'email': self.body['email'], 'role': 'student', 'active': True}).inserted_id
        payload = {**self.body, 'academicId': str(record)}
        self.assertEqual(self.post({**payload, 'email': 'wrong@example.edu'}, '/campus/bridge/bind').status_code, 403)
        self.assertEqual(self.post(payload, '/campus/bridge/bind').status_code, 200)
        self.assertEqual(self.post().json()['user']['id'], str(record))

    def test_bridge_does_not_accept_a_caller_selected_admin_role(self):
        self.assertEqual(self.post({**self.body, 'role': 'admin'}).status_code, 422)
        record = self.db.users.insert_one({'email': self.body['email'], 'role': 'admin', 'active': True}).inserted_id
        self.assertEqual(self.post({**self.body, 'academicId': str(record)}, '/campus/bridge/bind').status_code, 403)

    def test_concurrent_first_login_provisions_only_one_owned_student(self):
        if not hasattr(self, 'client'): self.fail('single-account bridge is missing')
        from app.services.campus_bridge import campus_session
        with ThreadPoolExecutor(max_workers=4) as pool:
            result = list(pool.map(lambda _: campus_session(self.db, self.body), range(4)))
        self.assertEqual(len({item['user']['id'] for item in result}), 1)
        self.assertEqual(self.db.users.count_documents({}), 1)
