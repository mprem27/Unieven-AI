"""Synthetic slow views prove completed owner records are visible during sync."""
import asyncio
import unittest
from types import SimpleNamespace
from unittest.mock import AsyncMock,patch
from uuid import uuid4
import httpx
from bson import ObjectId
from pymongo import MongoClient
from app.routes.campus import course_registration,snapshot
from app.services.ams.sync_service import sync_authenticated_records
from app.services.ams.sync_status import begin_sync,read_sync_status
from app.services.ams.storage import store_academic_rows


def table(caption,headers,rows):
    return '<table><caption>'+caption+'</caption><tr>'+''.join('<th>'+v+'</th>' for v in headers)+'</tr>'+''.join('<tr>'+''.join('<td>'+v+'</td>' for v in row)+'</tr>' for row in rows)+'</table>'

SUMMARY=table('Attendance',['Course Code','Course Name','Total','Present','Percentage'],[['CS101','Fictional course','10','8','80']])
COURSES=table('Registered courses',['Course Code','Course Name','Credits'],[['CS101','Fictional course','3']])
GRADES=table('Results',['Course Code','Course Name','Grade','Credits'],[['CS101','Fictional course','A','3']])


class IncrementalSyncTests(unittest.IsolatedAsyncioTestCase):
    def setUp(self):
        self.client=MongoClient('mongodb://127.0.0.1:27017',serverSelectionTimeoutMS=1000)
        self.db=self.client['campus_test_incremental_v18_'+uuid4().hex]
        self.sid=str(ObjectId())
        self.other=str(ObjectId())
        self.db.users.insert_many([{'_id':ObjectId(self.sid),'role':'student','active':True}, {'_id':ObjectId(self.other),'role':'student','active':True}])

    def tearDown(self):
        self.client.drop_database(self.db.name)
        self.client.close()

    async def test_a_later_conflict_restores_the_pre_sync_grade(self):
        previous={'courseCode':'CS101','grade':'B','source':'ams'}
        self.db.users.update_one({'_id':ObjectId(self.sid)},{'$set':{'results':[previous]}})
        baseline=self.db.users.find_one({'_id':ObjectId(self.sid)})
        first={'courseCode':'CS101','grade':'A'}
        second={'courseCode':'CS101','grade':'F'}
        store_academic_rows(self.db,self.sid,{'results':[first]},previous=baseline)
        store_academic_rows(self.db,self.sid,{'results':[first,second]},previous=baseline)
        self.assertEqual(self.db.users.find_one({'_id':ObjectId(self.sid)})['results'],[previous])

    async def test_incremental_absence_alerts_use_only_new_persisted_class_keys(self):
        original=[{'subjectCode':'CS100','date':'2026-10-19','period':'1','status':'absent'},
                  {'subjectCode':'CS101','date':'2026-10-19','period':'1','status':'present'}]
        self.db.users.update_one({'_id':ObjectId(self.sid)},{'$set':{'amsClassRecords':original}})
        baseline=self.db.users.find_one({'_id':ObjectId(self.sid)})
        fresh={'subjectCode':'CS102','date':'2026-10-19','period':'2','status':'absent'}
        revised={**original[1],'status':'absent'}
        contradictory={**fresh,'subjectCode':'CS103'}
        rows=[original[0],revised,fresh,contradictory,{**contradictory,'status':'present'}]
        received=[]
        def notify(student_id,entries):
            self.assertEqual(student_id,self.sid)
            saved=self.db.users.find_one({'_id':ObjectId(self.sid)})['amsClassRecords']
            self.assertTrue(all(row in saved for row in entries))
            received.extend(entries)
            return len(entries)
        with patch('app.services.notification_service.NotificationService.notify_new_absences',side_effect=notify):
            store_academic_rows(self.db,self.sid,{'records':rows},previous=baseline)
            store_academic_rows(self.db,self.sid,{'records':rows},previous=baseline)
        self.assertEqual([row['subjectCode'] for row in received],['CS102'])

    async def test_attendance_is_persisted_while_a_later_report_is_still_loading(self):
        entered=asyncio.Event();release=asyncio.Event()
        async def handle(request):
            if request.url.path=='/Results.aspx':entered.set();await release.wait();html=GRADES
            else:html=SUMMARY
            return httpx.Response(200,text=html,headers={'content-type':'text/html'})
        adapter=SimpleNamespace(BASE_URL='https://ams.veltech.edu.in',_looks_like_student_page=lambda html:'Student dashboard' in html)
        async with httpx.AsyncClient(transport=httpx.MockTransport(handle)) as client:
            portal={'client':client,'url':adapter.BASE_URL+'/Default.aspx','username':'fixture','dashboard_html':'Student dashboard<a href="Attendance.aspx">Attendance</a><a href="Results.aspx">Results</a>'}
            begin_sync(self.db,self.sid)
            with patch('app.services.ams.sync_service.TimetableService') as timetable:
                timetable.return_value.sync_timetable=AsyncMock(return_value={'inserted':0,'sourceCoursesCount':0})
                task=asyncio.create_task(sync_authenticated_records(self.db,self.sid,portal,adapter,{'name':'Fictional Student'}))
                try:
                    await asyncio.wait_for(entered.wait(),1)
                    current=snapshot({'id':self.sid,**self.db.users.find_one({'_id':ObjectId(self.sid)})},self.db)
                    self.assertEqual(current.get('attendanceSummary',[])[0]['subjectCode'] if current.get('attendanceSummary') else None,'CS101')
                    status=read_sync_status(self.db,self.sid)
                    self.assertEqual(status['state'],'syncing')
                    self.assertEqual(next(m for m in status['modules'] if m['id']=='attendance')['state'],'available')
                    self.assertNotIn('amsAttendanceSummary',self.db.users.find_one({'_id':ObjectId(self.other)}))
                finally:release.set();await task

    async def test_registered_courses_are_persisted_before_optional_fee_views_finish(self):
        entered=asyncio.Event();release=asyncio.Event()
        async def handle(request):
            if request.url.path=='/Fees.aspx':entered.set();await release.wait();html='<p>No supported fee statement</p>'
            else:html=COURSES
            return httpx.Response(200,text=html,headers={'content-type':'text/html'})
        adapter=SimpleNamespace(BASE_URL='https://ams.veltech.edu.in',_looks_like_student_page=lambda html:'Student dashboard' in html)
        async with httpx.AsyncClient(transport=httpx.MockTransport(handle)) as client:
            portal={'client':client,'url':adapter.BASE_URL+'/Default.aspx','username':'fixture','dashboard_html':'Student dashboard<a href="CourseRegistration.aspx">Course registration</a><a href="Fees.aspx">Fees</a>'}
            begin_sync(self.db,self.sid)
            with patch('app.services.ams.sync_service.TimetableService') as timetable:
                timetable.return_value.sync_timetable=AsyncMock(return_value={'inserted':0,'sourceCoursesCount':0})
                task=asyncio.create_task(sync_authenticated_records(self.db,self.sid,portal,adapter,{'name':'Fictional Student'}))
                try:
                    await asyncio.wait_for(entered.wait(),1)
                    self.assertEqual([row['courseCode'] for row in course_registration({'id':self.sid},self.db)['registeredCourses']],['CS101'])
                    self.assertEqual(read_sync_status(self.db,self.sid)['state'],'syncing')
                finally:release.set();await task
