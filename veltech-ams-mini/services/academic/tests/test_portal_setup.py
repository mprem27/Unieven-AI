import unittest
from uuid import uuid4
from unittest.mock import patch
from cryptography.fernet import Fernet
from fastapi import BackgroundTasks, HTTPException
from pymongo import MongoClient
from app.routes.profile import update_portal_credentials
from app.schemas.user import PortalCredentialsUpdate
from app.config.settings import settings
from app.security.portal_credentials import decrypt_portal_password

class PortalSetupTests(unittest.IsolatedAsyncioTestCase):
 def setUp(self):
  self.client=MongoClient('mongodb://127.0.0.1:27017');self.db=self.client['portal_setup_test_'+uuid4().hex]
  self.id=self.db.users.insert_one({'name':'New student','role':'student','active':True,'email':'own@example.edu'}).inserted_id
 def tearDown(self):
  self.client.drop_database(self.db.name);self.client.close()
 async def test_new_workspace_can_save_ams_username_without_college_roll_and_does_not_sync_automatically(self):
  key=Fernet.generate_key().decode();task=BackgroundTasks()
  with patch.object(settings,'portal_credential_encryption_key',key):
   result=await update_portal_credentials(PortalCredentialsUpdate(portalUsername='vtu00000',portalPassword='Fixture only password'),task,{'id':str(self.id),'role':'student'},self.db)
   stored=self.db.users.find_one({'_id':self.id})
   self.assertEqual(result['portalUsername'],'vtu00000');self.assertEqual(decrypt_portal_password(stored['portalPasswordEncrypted']),'Fixture only password');self.assertNotIn('vtuNumber',stored)
   self.assertEqual(task.tasks,[])
 async def test_roll_number_is_not_mistaken_for_ams_login_and_admin_cannot_save_student_credentials(self):
  with patch.object(settings,'portal_credential_encryption_key',Fernet.generate_key().decode()):
   await update_portal_credentials(PortalCredentialsUpdate(portalUsername='VTU00000',portalPassword='Fixture only password'),BackgroundTasks(),{'id':str(self.id),'role':'student','vtuNumber':'23UECS0000'},self.db)
   with self.assertRaises(HTTPException) as error:
    await update_portal_credentials(PortalCredentialsUpdate(portalUsername='VTU00000',portalPassword='Fixture only password'),BackgroundTasks(),{'id':str(self.id),'role':'admin'},self.db)
   self.assertEqual(error.exception.status_code,403)
