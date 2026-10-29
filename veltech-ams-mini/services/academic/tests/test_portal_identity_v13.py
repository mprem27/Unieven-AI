import unittest
from uuid import uuid4
from unittest.mock import AsyncMock,patch
from fastapi import FastAPI,HTTPException
from fastapi.testclient import TestClient
from pymongo import MongoClient
from app.config.database import get_db
from app.config.settings import settings
from app.routes.portal_login import router,resolve_portal_student
from app.routes.campus import course_registration,snapshot
from app.services.student_import import parse_student_import,store_student_import

class PortalIdentityTests(unittest.TestCase):
 def setUp(self):
  self.mongo=MongoClient('mongodb://127.0.0.1:27017',serverSelectionTimeoutMS=1000);self.db=self.mongo['campus_test_identity_v13_'+uuid4().hex]
  self.db.users.create_index('email',unique=True)
 def tearDown(self):self.mongo.drop_database(self.db.name);self.mongo.close()
 def test_verified_exact_principal_has_stable_own_identity_without_email_claims(self):
  old=self.db.users.insert_one({'email':'reported@example.edu','role':'admin','active':True}).inserted_id
  first=resolve_portal_student(self.db,'vtu00000',{'name':'Student','email':'reported@example.edu'})
  self.assertNotEqual(first['_id'],old);self.assertTrue(first['email'].endswith('@portal.invalid'))
  self.assertEqual(resolve_portal_student(self.db,'vtu00000',{'name':'Student'})['_id'],first['_id'])
  other=resolve_portal_student(self.db,'VTU00000',{'name':'Second identity'})
  self.assertNotEqual(first['_id'],other['_id'])
 def test_unverified_old_username_and_admin_principal_never_produce_student_tokens(self):
  self.db.users.insert_one({'portalUsername':'vtu00000','email':'old@example.edu','role':'student','active':True})
  with self.assertRaises(HTTPException) as error:resolve_portal_student(self.db,'vtu00000',{'name':'Student'})
  self.assertEqual(error.exception.status_code,409)
  self.db.users.insert_one({'portalVerifiedPrincipal':'adminprincipal','role':'admin','active':True})
  with self.assertRaises(HTTPException):resolve_portal_student(self.db,'adminprincipal',{'name':'Admin'})
 def test_service_key_required(self):
  old=settings.campus_service_key;settings.campus_service_key='a'*64
  try:
   app=FastAPI();app.include_router(router);app.dependency_overrides[get_db]=lambda:self.db;client=TestClient(app)
   with patch('app.routes.portal_login.prepare_challenge',new_callable=AsyncMock) as prepare:
    self.assertEqual(client.post('/campus/portal-login/challenge',json={'owner':'a'*64}).status_code,403);prepare.assert_not_awaited()
  finally:settings.campus_service_key=old
 def test_import_only_owner_without_live_verification(self):
  mine=self.db.users.insert_one({'role':'student','active':True,'name':'Mine','email':'mine@example.edu'}).inserted_id;other=self.db.users.insert_one({'role':'student','active':True,'name':'Other','email':'other@example.edu'}).inserted_id
  raw='{"profile":{"name":"Updated","role":"admin","portalVerifiedPrincipal":"other"},"courses":[{"code":"CS101","name":"Course"}],"fees":[{"title":"Semester fee","amount":1000,"status":"Paid"}]}'
  result=store_student_import(self.db,str(mine),parse_student_import('json',raw));self.assertFalse(result['liveVerified'])
  me=self.db.users.find_one({'_id':mine});self.assertEqual(me['role'],'student');self.assertNotIn('portalVerifiedPrincipal',me);self.assertEqual(self.db.users.find_one({'_id':other})['name'],'Other')
  snap=snapshot({'id':str(mine),**me},self.db);self.assertEqual(snap['academic']['fees'][0]['amount'],1000);self.assertFalse(snap['academic']['liveVerified'])
  registration=course_registration({'id':str(mine)},self.db);self.assertFalse(registration['submissionSupported']);self.assertIsNone(registration['officialUrl']);self.assertEqual(registration['registeredCourses'][0]['code'],'CS101')
