import unittest
from bson import ObjectId
from pymongo import MongoClient
from app.services.ams.storage import store_academic_rows
from app.routes.campus import snapshot

class StorageTests(unittest.TestCase):
 def setUp(self):
  self.client=MongoClient('mongodb://127.0.0.1:27017');self.db=self.client['campus_storage_test'];self.id=ObjectId()
  self.db.users.insert_one({'_id':self.id,'name':'Own student','amsAttendanceSummary':[{'subjectCode':'OLD1','totalCount':10,'presentCount':7}],'amsClassRecords':[{'subjectCode':'OLD1','date':'2026-10-13','period':'1','status':'present'}]})
 def tearDown(self):
  self.client.drop_database(self.db.name);self.client.close()
 def test_period_records_persist_without_inventing_daily_marks_and_are_owned(self):
  other=ObjectId();self.db.users.insert_one({'_id':other,'name':'Other student'})
  rows={'summary':[{'subjectCode':'CS101','totalCount':10,'presentCount':8,'percentage':80}], 'records':[{'subjectCode':'CS101','date':'2026-10-14','period':'1','status':'present'},{'subjectCode':'CS101','date':'2026-10-14','period':'2','status':'absent'}],'results':[{'courseCode':'CS101','grade':'A'}]}
  store_academic_rows(self.db,str(self.id),rows)
  user=self.db.users.find_one({'_id':self.id});result=snapshot({'id':str(self.id),**user},self.db)
  self.assertEqual(len(result['attendanceRecords']),3);self.assertEqual(len(result['attendanceSummary']),2)
  self.assertEqual(result['academic']['results'][0]['grade'],'A');self.assertNotIn('amsClassRecords',self.db.users.find_one({'_id':other}))
 def test_empty_or_failed_partial_source_preserves_previous_rows(self):
  store_academic_rows(self.db,str(self.id),{'summary':[],'records':[],'results':[]})
  user=self.db.users.find_one({'_id':self.id});self.assertEqual(len(user['amsAttendanceSummary']),1);self.assertEqual(len(user['amsClassRecords']),1)
 def test_conflicting_marks_remain_unknown(self):
  records=[{'subjectCode':'CS101','date':'2026-10-14','period':'1','status':s} for s in ['present','absent']]
  store_academic_rows(self.db,str(self.id),{'records':records})
  self.assertEqual(self.db.users.find_one({'_id':self.id})['amsClassRecords'][-1]['status'],'unknown')
 def test_result_attempts_and_assessment_reports_keep_their_distinct_source_keys(self):
  rows=[{'courseCode':'CS101','semester':'6','resultType':'Regular','examinationSession':'May.2026','grade':'A'},
        {'courseCode':'CS101','semester':'6','resultType':'Arrear','examinationSession':'Nov.2026','grade':'B'},
        {'courseCode':'CS101','semester':'6','resultType':'Test marks','testMark1':'18'},
        {'courseCode':'CS101','semester':'6','resultType':'Final internal','internalMark':'25'}]
  result=store_academic_rows(self.db,str(self.id),{'results':rows})
  self.assertEqual(result['results'],4)
  self.assertEqual(len(self.db.users.find_one({'_id':self.id})['results']),4)
