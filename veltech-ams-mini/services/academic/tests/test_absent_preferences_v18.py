import unittest
from app.schemas.user import ProfileUpdate,UserPublic
from app.services.user_service import UserService
from pymongo import MongoClient
from bson import ObjectId
class AbsentPreferenceTests(unittest.TestCase):
 def test_absence_alert_preference_is_explicit_opt_in_and_survives_profile_update(self):
  self.assertIn('absentAlertsEnabled',ProfileUpdate.model_fields)
  self.assertFalse(UserPublic.model_fields['absentAlertsEnabled'].default)
  client=MongoClient('mongodb://127.0.0.1:27017',serverSelectionTimeoutMS=1000);db=client['campus_test_absent_pref_v18'];sid=ObjectId()
  try:
   db.users.insert_one({'_id':sid,'name':'Fictional Student','email':'fictional@example.invalid','active':True,'role':'student'})
   updated=UserService(db).update_profile(str(sid),ProfileUpdate(absentAlertsEnabled=True));self.assertTrue(updated['absentAlertsEnabled'])
   updated=UserService(db).update_profile(str(sid),ProfileUpdate(notificationsEnabled=False));self.assertTrue(updated['absentAlertsEnabled']);self.assertFalse(updated['notificationsEnabled'])
  finally:client.drop_database(db.name);client.close()
