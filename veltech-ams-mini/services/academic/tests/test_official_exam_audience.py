"""AMS-only examination audiences cannot be promoted from editable imports."""
import json
import unittest
from datetime import datetime, timezone
from uuid import uuid4

from bson import ObjectId
from fastapi import FastAPI
from fastapi.testclient import TestClient
from pymongo import MongoClient

from app.config.database import get_db
from app.routes.campus import router, snapshot
from app.security.permissions import get_current_user
from app.services.ams.source_modules import store_source_modules
from app.services.student_import import parse_student_import, store_student_import
from app.services.student_service import StudentService
from app.services.timetable_service import TimetableService


class OfficialExamAudienceTests(unittest.TestCase):
    def setUp(self):
        self.mongo = MongoClient('mongodb://127.0.0.1:27017', serverSelectionTimeoutMS=1000)
        self.db = self.mongo['campus_official_audience_' + uuid4().hex]
        self.sid = str(ObjectId())
        self.db.users.insert_one({'_id': ObjectId(self.sid), 'role': 'student', 'active': True,
                                  'name': 'Fictional Student', 'email': 'student@example.test'})

    def tearDown(self):
        self.mongo.drop_database(self.db.name)
        self.mongo.close()

    def user(self):
        return {'id': self.sid, **self.db.users.find_one({'_id': ObjectId(self.sid)})}

    def test_verified_student_import_is_forbidden_and_cannot_spoof_own_audience(self):
        official = {'branch': 'CSE', 'semester': '7', 'section': 'A', 'batch': '2023-2027', 'regulation': '2021'}
        self.db.users.update_one({'_id': ObjectId(self.sid)}, {'$set': {
            **official, 'portalVerifiedPrincipal': 'vtu00000',
            'portalPrincipalVerifiedAt': datetime.now(timezone.utc), 'amsOfficialProfile': official,
        }})
        self.db.timetable_metadata.insert_one({'studentId': self.sid, 'courses': [{'courseCode': 'CS101', 'source': 'ams'}],
                                               'amsRegisteredCourses': [{'courseCode': 'CS101', 'source': 'ams'}]})
        app = FastAPI()
        app.include_router(router)
        app.dependency_overrides[get_db] = lambda: self.db
        app.dependency_overrides[get_current_user] = self.user
        with TestClient(app) as client:
            response = client.post('/campus/import', json={'format': 'json', 'content': json.dumps({
                'profile': {'branch': 'ECE', 'semester': '1', 'section': 'Z', 'batch': 'invented'},
                'courses': [{'courseCode': 'EC999', 'courseName': 'Spoofed course'}],
            })})
        self.assertEqual(response.status_code, 403, response.text)
        saved = self.user()
        self.assertEqual(saved['branch'], 'CSE')
        self.assertEqual(saved['amsOfficialProfile'], official)
        self.assertEqual(self.db.timetable_metadata.find_one({'studentId': self.sid})['courses'][0]['courseCode'], 'CS101')

    def test_unverified_import_remains_available_but_cannot_write_protected_fields(self):
        data = parse_student_import('json', json.dumps({
            'profile': {'branch': 'Imported branch', 'semester': '1', 'portalVerifiedPrincipal': 'fake',
                        'amsOfficialProfile': {'branch': 'Forged branch'}},
            'courses': [{'courseCode': 'FAKE101', 'courseName': 'Imported course'}],
            'amsRegisteredCourses': [{'courseCode': 'FAKE101', 'source': 'ams'}],
        }))
        # Storage must also reject protected keys even if an internal caller did
        # not use the public import parser first.
        data['profile']['amsOfficialProfile'] = {'branch': 'Forged branch'}
        data['profile']['portalVerifiedPrincipal'] = 'fake'
        result = store_student_import(self.db, self.sid, data)
        self.assertTrue(result['success'])
        user = self.user()
        self.assertEqual(user['branch'], 'Imported branch')
        self.assertNotIn('amsOfficialProfile', user)
        self.assertNotIn('portalVerifiedPrincipal', user)
        self.assertNotIn('amsRegisteredCourses', self.db.timetable_metadata.find_one({'studentId': self.sid}))
        self.assertEqual(snapshot(user, self.db)['officialAcademic'], {'profile': {}, 'courses': [], 'source': 'ams'})

    def test_snapshot_never_promotes_legacy_display_profile_or_courses(self):
        self.db.users.update_one({'_id': ObjectId(self.sid)}, {'$set': {
            'branch': 'Mutable branch', 'section': 'Z', 'regulation': 'Display regulation',
            'portalVerifiedPrincipal': 'vtu00000', 'portalPrincipalVerifiedAt': datetime.now(timezone.utc),
        }})
        self.db.timetable_metadata.insert_one({'studentId': self.sid, 'source': 'ams',
                                               'profile': {'branch': 'Legacy branch', 'semester': '9'},
                                               'courses': [{'courseCode': 'LEGACY101', 'source': 'ams'}]})
        result = snapshot(self.user(), self.db)
        self.assertEqual(result['officialAcademic'], {'profile': {}, 'courses': [], 'source': 'ams'})
        self.assertEqual(result['profile']['regulation'], 'Display regulation')
        self.assertEqual(result['academic']['courses'][0]['courseCode'], 'LEGACY101')

    def test_actual_ams_profile_writes_only_source_fields_and_merges_prior_official_values(self):
        self.db.users.update_one({'_id': ObjectId(self.sid)}, {'$set': {
            'branch': 'Mutable branch', 'batch': 'Mutable batch', 'regulation': 'Mutable regulation', 'section': 'Mutable section',
        }})
        service = StudentService(self.db)
        service._save_ams_profile(self.sid, {'department': 'Computer Science', 'semester': '7'})
        self.assertEqual(self.user()['amsOfficialProfile'], {'branch': 'Computer Science', 'department': 'Computer Science', 'semester': '7'})
        service._save_ams_profile(self.sid, {'section': 'A', 'batch': '2023-2027', 'regulation': '2021'})
        expected = {'branch': 'Computer Science', 'department': 'Computer Science', 'semester': '7',
                    'section': 'A', 'batch': '2023-2027', 'regulation': '2021'}
        self.assertEqual(self.user()['amsOfficialProfile'], expected)
        result = snapshot(self.user(), self.db)
        self.assertEqual(result['officialAcademic']['profile'], expected)
        self.assertEqual(result['profile']['regulation'], '2021')

    def test_source_registration_writes_protected_courses_and_unknown_layout_retains_them(self):
        self.db.timetable_metadata.insert_one({'studentId': self.sid, 'courses': [{'courseCode': 'IMPORTED', 'source': 'student-import'}]})
        store_source_modules(self.db, self.sid, {'registeredCourses': [{'courseCode': 'CS101', 'courseName': 'Algorithms'}]})
        metadata = self.db.timetable_metadata.find_one({'studentId': self.sid})
        self.assertEqual(metadata['amsRegisteredCourses'][0]['courseCode'], 'CS101')
        self.assertEqual(metadata['amsRegisteredCourses'][0]['source'], 'ams')
        store_source_modules(self.db, self.sid, {'registeredCourses': [], 'modules': []})
        official = snapshot(self.user(), self.db)['officialAcademic']
        self.assertEqual([row['courseCode'] for row in official['courses']], ['CS101'])
        self.assertEqual(official['source'], 'ams')

    def test_actual_html_regulation_label_is_parsed_without_inferring_it(self):
        from app.college.parser import parse_ams_profile

        self.assertEqual(parse_ams_profile('<dl><dt>Regulation</dt><dd>VTRUGE2021</dd></dl>')['regulation'], 'VTRUGE2021')
        self.assertNotIn('regulation', parse_ams_profile('<p>Course CS2021 and batch 2023</p>'))


class OfficialTimetableCourseTests(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        self.mongo = MongoClient('mongodb://127.0.0.1:27017', serverSelectionTimeoutMS=1000)
        self.db = self.mongo['campus_official_timetable_' + uuid4().hex]
        self.sid = str(ObjectId())
        self.db.users.insert_one({'_id': ObjectId(self.sid), 'role': 'student', 'active': True})
        self.db.timetable_metadata.insert_one({'studentId': self.sid, 'courses': [{'courseCode': 'IMPORTED', 'source': 'student-import'}]})

    async def asyncTearDown(self):
        self.mongo.drop_database(self.db.name)
        self.mongo.close()

    async def test_only_fresh_ams_registered_courses_enter_protected_timetable_metadata(self):
        class Adapter:
            details = {}

            async def get_timetable_details(self, session):
                return self.details

        adapter = Adapter()
        service = TimetableService(self.db, ams_adapter=adapter)
        adapter.details = {'profile': {}, 'courses': [], 'timetable': []}
        await service.sync_timetable(self.sid, {'owner': 'fixture'})
        metadata = self.db.timetable_metadata.find_one({'studentId': self.sid})
        self.assertNotIn('amsRegisteredCourses', metadata)
        adapter.details = {'profile': {}, 'courses': [{'courseCode': 'AMS101', 'courseName': 'Source course'}], 'timetable': []}
        result = await service.sync_timetable(self.sid, {'owner': 'fixture'})
        self.assertEqual(result['sourceCoursesCount'], 1)
        metadata = self.db.timetable_metadata.find_one({'studentId': self.sid})
        self.assertEqual([row['courseCode'] for row in metadata['amsRegisteredCourses']], ['AMS101'])
        self.assertEqual(metadata['amsRegisteredCourses'][0]['source'], 'ams')
        self.db.timetable_metadata.update_one({'studentId': self.sid}, {'$set': {'courses': [{'courseCode': 'MUTABLE'}]}})
        adapter.details = {'profile': {}, 'courses': [], 'timetable': []}
        await service.sync_timetable(self.sid, {'owner': 'fixture'})
        metadata = self.db.timetable_metadata.find_one({'studentId': self.sid})
        self.assertEqual([row['courseCode'] for row in metadata['amsRegisteredCourses']], ['AMS101'])
