import unittest
from uuid import uuid4
from unittest.mock import patch
from bson import ObjectId
from pymongo import MongoClient
from fastapi import FastAPI
from fastapi.testclient import TestClient
from app.routes import campus
from app.config.database import get_db
from app.security.permissions import get_current_user


class WorkspaceBundleTests(unittest.TestCase):
    def setUp(self):
        self.mongo=MongoClient('mongodb://127.0.0.1:27017',serverSelectionTimeoutMS=1000)
        self.db=self.mongo['campus_test_workspace_bundle_'+uuid4().hex]
        self.sid=str(ObjectId());self.other=str(ObjectId())
        self.user={'id':self.sid,'name':'Fictional Student','email':'student@example.test','role':'student','active':True,
                   'passwordHash':'private-hash','portalPasswordEncrypted':'private-seal',
                   'amsAttendanceSummary':[{'subjectCode':'OWN','presentCount':8,'totalCount':10}],
                   'amsClassRecords':[{'subjectCode':'OWN','date':'2026-10-20','status':'present'}]}
        self.db.users.insert_many([{'_id':ObjectId(self.sid),**{k:v for k,v in self.user.items() if k!='id'}},
                                  {'_id':ObjectId(self.other),'name':'Other private student','role':'student','active':True}])
        self.db.timetable.insert_many([{'studentId':self.sid,'subjectName':'Owned class','active':True,'day':'Monday','startTime':'09:00'},
                                       {'studentId':self.other,'subjectName':'Other private class','active':True}])
        self.app=FastAPI();self.app.include_router(campus.router)
        self.app.dependency_overrides[get_db]=lambda:self.db
        self.app.dependency_overrides[get_current_user]=lambda:self.user
        self.client=TestClient(self.app)

    def tearDown(self):
        self.client.close();self.mongo.drop_database(self.db.name);self.mongo.close()

    def test_one_authenticated_cached_read_returns_the_owned_workspace_without_secrets(self):
        response=self.client.get('/campus/workspace')
        self.assertEqual(response.status_code,200,response.text)
        body=response.json()
        self.assertEqual(body['workspaceVersion'],1)
        self.assertEqual(body['profile']['name'],'Fictional Student')
        self.assertEqual(body['summary'][0]['subjectCode'],'OWN')
        self.assertEqual(body['records'][0]['subjectCode'],'OWN')
        self.assertEqual([row['subjectName'] for row in body['timetable']],['Owned class'])
        self.assertNotIn('private-hash',response.text);self.assertNotIn('private-seal',response.text)
        self.assertNotIn('Other private',response.text)
        self.assertEqual(response.headers['cache-control'],'private, no-store')

    def test_staff_cannot_use_the_student_workspace_bundle(self):
        self.user['role']='faculty'
        self.assertEqual(self.client.get('/campus/workspace').status_code,403)

    def test_a_failed_optional_section_keeps_the_profile_and_safe_error(self):
        with patch('app.routes.timetable.get_timetable',side_effect=RuntimeError('private exception data')):
            response=self.client.get('/campus/workspace')
        self.assertEqual(response.status_code,200,response.text)
        self.assertEqual(response.json()['profile']['name'],'Fictional Student')
        self.assertIn('timetable',response.json()['errors'])
        self.assertNotIn('private exception data',response.text)
