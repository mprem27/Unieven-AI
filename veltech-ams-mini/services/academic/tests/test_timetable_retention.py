import unittest
from unittest.mock import AsyncMock, MagicMock
from app.services.timetable_service import TimetableService
class RetentionTests(unittest.IsolatedAsyncioTestCase):
 async def test_failed_replacement_insert_leaves_previous_rows_active(self):
  db=MagicMock();adapter=MagicMock()
  adapter.get_student_profile=AsyncMock(return_value={})
  adapter.get_timetable=AsyncMock(return_value={'timetable':[{'day':'Wednesday','startTime':'09:00','endTime':'10:00','subjectCode':'CS101','subjectName':'Fixture class'}]})
  adapter.get_registered_courses=AsyncMock(return_value=[])
  db.__getitem__.return_value.find_one.return_value={}
  db.__getitem__.return_value.insert_many.side_effect=RuntimeError('synthetic insert failure')
  service=TimetableService(db,ams_adapter=adapter)
  with self.assertRaises(RuntimeError):
   await service.sync_timetable('own',{'client':'fixture'},profile={})
  db.__getitem__.return_value.update_many.assert_not_called()
