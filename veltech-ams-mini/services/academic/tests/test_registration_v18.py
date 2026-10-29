"""Owner-local registration reads tolerate unsupported legacy metadata shapes."""
import unittest
from uuid import uuid4
from bson import ObjectId
from pymongo import MongoClient
from app.routes.campus import course_registration


class RegistrationReadTests(unittest.TestCase):
    def setUp(self):
        self.client=MongoClient('mongodb://127.0.0.1:27017',serverSelectionTimeoutMS=1000)
        self.db=self.client['campus_test_registration_v18_'+uuid4().hex]
        self.sid=str(ObjectId())

    def tearDown(self):
        self.client.drop_database(self.db.name)
        self.client.close()

    def test_null_legacy_rows_are_not_sent_to_the_course_view(self):
        own={'courseCode':'CS101','courseName':'Fictional course','source':'ams'}
        self.db.timetable_metadata.insert_one({'studentId':self.sid,'courses':[None,'unsupported',own],
            'offerings':[None], 'registrationWarnings':[None,{'message':'unsupported'},'Check official eligibility.']})
        self.db.timetable_metadata.insert_one({'studentId':str(ObjectId()),'courses':[{'courseCode':'FOREIGN','courseName':'Another owner'}]})
        result=course_registration({'id':self.sid},self.db)
        self.assertEqual(result['registeredCourses'],[own])
        self.assertEqual(result['offerings'],[])
        self.assertEqual(result['warnings'],['Check official eligibility.'])
        self.assertEqual(result['sections']['registered']['recordCount'],1)
        self.assertFalse(result['submissionSupported'])

    def test_nonlist_legacy_sections_do_not_raise_an_internal_error(self):
        self.db.timetable_metadata.insert_one({'studentId':self.sid,'sourceModules':'unsupported',
            'courses':42,'offerings':{'courseCode':'CS202'},'amsSync':{'modules':{'courses':None}},
            'registrationWindow':{'start':{'invalid':'shape'},'end':'2026-11-01'}})
        result=course_registration({'id':self.sid},self.db)
        self.assertEqual(result['registeredCourses'],[])
        self.assertEqual(result['offerings'],[])
        self.assertIsNone(result['registrationWindow'])
        self.assertIsNone(result['officialUrl'])
        self.assertEqual(result['sections']['registered']['status'],'unavailable')
