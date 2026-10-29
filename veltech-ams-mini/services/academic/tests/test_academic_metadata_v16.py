import unittest
from uuid import uuid4
from bson import ObjectId
from pymongo import MongoClient
from app.services.ams.sync_status import begin_sync
from app.services.timetable_service import TimetableService
from app.routes.campus import snapshot
from app.services.student_service import StudentService

class AcademicMetadataTests(unittest.TestCase):
 def setUp(self):
  self.client=MongoClient('mongodb://127.0.0.1:27017');self.db=self.client['campus_test_metadata_'+uuid4().hex];self.sid=str(ObjectId())
 def tearDown(self):self.client.drop_database(self.db.name);self.client.close()
 def test_first_login_sync_telemetry_and_registered_courses_share_one_document(self):
  begin_sync(self.db,self.sid)
  TimetableService(self.db)._save_metadata(self.sid,{},'Fictional curriculum',[{'courseCode':'ABCDEFGLAB','courseName':'Fictional lab','credit':'2'}])
  result=snapshot({'id':self.sid},self.db)
  self.assertEqual(len(result['academic']['courses']),1)
  self.assertEqual(result['academic']['sectionSources']['courses']['source'],'ams')
  self.assertEqual(self.db.timetable_metadata.count_documents({'studentId':self.sid}),1)
 def test_previous_split_metadata_does_not_hide_owned_source_rows(self):
  begin_sync(self.db,self.sid)
  self.db.timetable_metadata.insert_one({'studentId':self.sid,'source':'ams','courses':[{'courseCode':'CS101','courseName':'Fictional course'}],'profile':{'community':'Source community'}})
  result=snapshot({'id':self.sid},self.db)
  self.assertEqual(len(result['academic']['courses']),1)
  self.assertEqual(result['profile']['community'],'Source community')
  self.assertEqual(len(TimetableService(self.db).get_student_timetable_details(self.sid)['courses']),1)
 def test_official_vtu_and_roll_number_survive_as_distinct_fields(self):
  self.db.users.insert_one({'_id':ObjectId(self.sid),'role':'student','active':True,'email':'internal@portal.invalid','portalVerifiedPrincipal':'vtu00000'})
  StudentService(self.db)._save_ams_profile(self.sid,{'name':'Fictional Student','vtuNumber':'VTU00000','rollNumber':'23UECS0000','community':'Fictional community'})
  user=self.db.users.find_one({'_id':ObjectId(self.sid)});result=snapshot({'id':self.sid,**user},self.db)
  self.assertEqual(result['profile']['vtuNumber'],'VTU00000')
  self.assertEqual(result['profile']['rollNumber'],'23UECS0000')
  self.assertEqual(result['profile']['email'],'vtu00000@veltech.edu.in')
  self.assertEqual(user['email'],'internal@portal.invalid')

 def test_credit_summary_without_course_ledger_remains_a_supported_source_section(self):
  user={'id':self.sid,'creditSummary':[{'label':'CGPA','value':'8.75','source':'ams'}]}
  result=snapshot(user,self.db)
  self.assertEqual(result['academic']['coverage']['credits'],'available')
  self.assertEqual(result['academic']['sectionSources']['credits']['source'],'ams')
