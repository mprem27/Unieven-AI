"""Structural reproductions derived from reader contracts, not verified private pages."""
from pathlib import Path
import unittest
from unittest.mock import AsyncMock, MagicMock
from unittest.mock import patch
from uuid import uuid4

import httpx
from bson import ObjectId
from pymongo import MongoClient

from app.services.ams.academic_pages import collect_academic_pages, discover_academic_pages, parse_academic_page
from app.services.ams.ams_adapter import AmsAdapter
from app.services.ams.source_modules import parse_registration_page, collect_source_modules
from app.services.timetable_service import TimetableService


FIXTURES = Path(__file__).parent / 'fixtures' / 'ams_v16'


def fixture(name):
    return (FIXTURES / name).read_text()


class StructuralParsingTests(unittest.TestCase):
    def test_nested_aspnet_grouped_headers_keep_column_associations(self):
        parsed = parse_academic_page(fixture('nested-academic.html'))
        self.assertEqual(parsed['summary'], [{'subjectCode': 'CS101', 'subjectName': 'Fictional Computing',
            'totalCount': 10, 'presentCount': 8, 'percentage': 80.0}])
        self.assertEqual(parsed['records'], [])
        self.assertEqual(parsed['results'], [{'courseCode': 'CS101', 'courseName': 'Fictional Computing',
            'grade': 'WITHHELD', 'credits': '3.0', 'gradePoints': 'Pending', 'semester': 'II'}])

    def test_registered_grid_from_original_adapter_needs_no_new_heading(self):
        parsed = parse_registration_page(fixture('registered-courses.html'))
        self.assertEqual([row['courseCode'] for row in parsed['registeredCourses']], ['CS101'])
        self.assertEqual(parsed['offerings'], [])

    def test_literal_navigation_and_iframe_module_links_remain_owner_scoped(self):
        pages = discover_academic_pages(fixture('student-shell.html'),
            'https://ams.veltech.edu.in/Default.aspx', ['OWN'], include_modules=True)
        self.assertEqual(pages, [
            {'url': 'https://ams.veltech.edu.in/StudentAttendance.aspx?StudentId=OWN&semester=II', 'kind': 'attendance'},
            {'url': 'https://ams.veltech.edu.in/SemesterResults.aspx?semester=II', 'kind': 'results'},
            {'url': 'https://ams.veltech.edu.in/StudentProfile.aspx?StudentId=OWN', 'kind': 'profile'},
            {'url': 'https://ams.veltech.edu.in/TimeTable.aspx', 'kind': 'timetable'},
            {'url': 'https://ams.veltech.edu.in/TimeTable.aspx', 'kind': 'course-registration'},
        ])

    def test_unrelated_merged_body_cells_and_duplicate_headers_still_reject(self):
        html = '''<table><tr><th rowspan="2">Course Code</th><th colspan="2">Attendance</th></tr>
        <tr><th>Total Classes</th><th>Total Classes</th></tr><tr><td>CS101</td><td>10</td><td>8</td></tr></table>'''
        self.assertEqual(parse_academic_page(html), {'summary': [], 'records': [], 'results': []})


class Adapter:
    BASE_URL = 'https://ams.veltech.edu.in'
    _looks_like_student_page = staticmethod(lambda html: 'Student dashboard' in html)


class StructuralCollectionTests(unittest.IsolatedAsyncioTestCase):
    async def test_inline_dashboard_rows_are_read_without_redundant_view_fetches(self):
        calls = []
        def handle(request):
            calls.append(request)
            return httpx.Response(500)
        async with httpx.AsyncClient(transport=httpx.MockTransport(handle)) as client:
            session = {'client': client, 'url': Adapter.BASE_URL + '/Default.aspx',
                'dashboard_html': 'Student dashboard' + fixture('nested-academic.html') + fixture('registered-courses.html')}
            academic = await collect_academic_pages(session, Adapter())
            modules = await collect_source_modules(session, Adapter())
        self.assertEqual(len(academic['summary']), 1)
        self.assertEqual(len(academic['results']), 1)
        self.assertEqual(len(modules['registeredCourses']), 1)
        self.assertEqual(calls, [])

    async def test_explicit_same_kind_frame_is_read_but_cross_origin_frame_is_not(self):
        calls = []
        def handle(request):
            calls.append(request.url.path)
            if request.url.path == '/Attendance.aspx':
                return httpx.Response(200, text='<iframe src="StudentAttendance.aspx"></iframe>'
                    '<iframe src="https://elsewhere.test/Attendance.aspx"></iframe>', headers={'content-type': 'text/html'})
            return httpx.Response(200, text=fixture('nested-academic.html'), headers={'content-type': 'text/html'})
        async with httpx.AsyncClient(transport=httpx.MockTransport(handle)) as client:
            data = await collect_academic_pages({'client': client, 'url': Adapter.BASE_URL + '/Default.aspx',
                'dashboard_html': 'Student dashboard<a href="Attendance.aspx">Attendance</a>'}, Adapter())
        self.assertEqual(calls, ['/Attendance.aspx', '/StudentAttendance.aspx'])
        self.assertEqual(len(data['summary']), 1)
        self.assertEqual(data['modules'][0]['status'], 'available')

    async def test_profile_is_read_from_a_discovered_owner_frame(self):
        calls = []
        def handle(request):
            calls.append(request.url.path)
            return httpx.Response(200, text='<span id="MainContent_lblStuname">Fictional Student</span>'
                '<span id="MainContent_lblID">OWN</span>', headers={'content-type': 'text/html'})
        async with httpx.AsyncClient(transport=httpx.MockTransport(handle)) as client:
            profile = await AmsAdapter().get_student_profile({'client': client, 'username': 'OWN',
                'url': Adapter.BASE_URL + '/Default.aspx', 'dashboard_html': 'Student academic semester'
                '<iframe title="Student profile" src="StudentProfile.aspx?StudentId=OWN"></iframe>'})
        self.assertEqual(profile.get('name'), 'Fictional Student')
        self.assertEqual(calls, ['/StudentProfile.aspx'])

    async def test_timetable_sync_loads_one_complete_upstream_response(self):
        db = MagicMock()
        db.__getitem__.return_value.find_one.return_value = {}
        adapter = MagicMock()
        adapter.get_timetable = AsyncMock(return_value=[])
        adapter.get_timetable_details = AsyncMock(return_value={'profile': {}, 'courses': [], 'timetable': []})
        await TimetableService(db, ams_adapter=adapter).sync_timetable('own', {'client': 'fixture'})
        adapter.get_timetable_details.assert_awaited_once()
        adapter.get_timetable.assert_not_awaited()

    async def test_timetable_follows_its_discovered_frame_and_reuses_session_html(self):
        calls = []
        def handle(request):
            calls.append(request.url.path)
            if request.url.path == '/TimeTable.aspx':
                body = '<iframe src="ViewTimeTable.aspx"></iframe>'
            else:
                body = fixture('registered-courses.html') + '''<table id="MainContent_GridTimetable">
                <tr><th>Day</th><th>09:00 - 10:00</th></tr>
                <tr><td>Monday</td><td>CS101</td></tr></table>'''
            return httpx.Response(200, text=body, headers={'content-type': 'text/html'})
        async with httpx.AsyncClient(transport=httpx.MockTransport(handle)) as client:
            session = {'client': client, 'url': Adapter.BASE_URL + '/Default.aspx', 'username': 'OWN',
                'dashboard_html': 'Student dashboard<a href="TimeTable.aspx">Timetable</a>'}
            adapter = AmsAdapter()
            first = await adapter.get_timetable_details(session)
            second = await adapter.get_timetable_details(session)
        self.assertEqual(calls, ['/TimeTable.aspx', '/ViewTimeTable.aspx'])
        self.assertEqual(len(first['timetable']), 1)
        self.assertEqual(first['timetable'][0]['subjectCode'], 'CS101')
        self.assertEqual(first['courses'], second['courses'])

    async def test_unsupported_views_keep_safe_diagnostics_and_one_note_per_module(self):
        html = '<table><tr><th>Unrecognized label</th></tr><tr><td>PRIVATE STUDENT VALUE</td></tr></table>'
        async with httpx.AsyncClient(transport=httpx.MockTransport(lambda request:
                httpx.Response(200, text=html, headers={'content-type': 'text/html'}))) as client:
            data = await collect_academic_pages({'client': client, 'url': Adapter.BASE_URL + '/Default.aspx',
                'dashboard_html': 'Student dashboard<a href="Attendance.aspx">Attendance</a>'
                '<a href="AttendanceDetails.aspx">Attendance details</a>'}, Adapter())
        self.assertEqual(len(data['notes']), 1)
        self.assertEqual(len(data['modules']), 2)
        for module in data['modules']:
            self.assertEqual(module['status'], 'unsupported')
            self.assertEqual(module['diagnostics']['tableCount'], 1)
            self.assertEqual(module['diagnostics']['headerRowCount'], 1)
            self.assertEqual(module['diagnostics']['acceptedRowCount'], 0)
            self.assertNotIn('PRIVATE', str(module['diagnostics']))


class SyncIntegrationTests(unittest.IsolatedAsyncioTestCase):
    def setUp(self):
        self.mongo = MongoClient('mongodb://127.0.0.1:27017', serverSelectionTimeoutMS=1000)
        self.db = self.mongo['campus_test_ams_v16_' + uuid4().hex]
        self.sid = str(ObjectId())
        self.db.users.insert_one({'_id': ObjectId(self.sid), 'role': 'student', 'active': True})

    def tearDown(self):
        self.mongo.drop_database(self.db.name)
        self.mongo.close()

    async def test_inline_module_mapping_and_safe_diagnostics_survive_full_sync(self):
        from app.services.ams.sync_service import sync_authenticated_records
        from app.services.ams.sync_status import begin_sync, read_sync_status
        async with httpx.AsyncClient(transport=httpx.MockTransport(lambda request: httpx.Response(500))) as client:
            session = {'client': client, 'url': Adapter.BASE_URL + '/Default.aspx', 'username': 'OWN',
                'dashboard_html': 'Student dashboard' + fixture('nested-academic.html') + fixture('registered-courses.html')}
            begin_sync(self.db, self.sid)
            with patch('app.services.ams.sync_service.TimetableService.sync_timetable',
                    new=AsyncMock(return_value={'inserted': 0, 'sourceCoursesCount': 0})):
                result = await sync_authenticated_records(self.db, self.sid, session, Adapter(), {'name': 'Fictional Student'})
        status = read_sync_status(self.db, self.sid)
        for key in ('attendance', 'results', 'courses'):
            module = next(row for row in status['modules'] if row['id'] == key)
            self.assertEqual(module['state'], 'available')
        attendance = next(row for row in status['modules'] if row['id'] == 'attendance')
        self.assertGreater(attendance['diagnostics']['tableCount'], 0)
        self.assertEqual(len(result['notes']), 1)
        self.assertNotIn('PRIVATE', str(status))

    async def test_identity_only_profile_does_not_report_official_details_as_available(self):
        from app.services.ams.sync_service import sync_authenticated_records
        from app.services.ams.sync_status import begin_sync, read_sync_status
        async with httpx.AsyncClient(transport=httpx.MockTransport(lambda request: httpx.Response(500))) as client:
            begin_sync(self.db, self.sid)
            with patch('app.services.ams.sync_service.TimetableService.sync_timetable',
                    new=AsyncMock(return_value={'inserted': 0, 'sourceCoursesCount': 0})):
                await sync_authenticated_records(self.db, self.sid, {'client': client,
                    'url': Adapter.BASE_URL + '/Default.aspx', 'dashboard_html': 'Student dashboard'},
                    Adapter(), {'portalUsername': 'OWN'})
        profile = next(row for row in read_sync_status(self.db, self.sid)['modules'] if row['id'] == 'profile')
        self.assertEqual(profile['state'], 'unsupported')

    async def test_refresh_reads_fresh_dashboard_and_drops_previous_html_cache(self):
        from app.services.ams.sync_service import sync_authenticated_records
        from app.services.ams.sync_status import begin_sync
        calls = []
        def handle(request):
            calls.append(request.url.path)
            return httpx.Response(200, text='<span id="MainContent_lblStuname">Fictional Student</span>'
                '<span id="MainContent_lblID">OWN</span>' + fixture('nested-academic.html'),
                headers={'content-type': 'text/html'})
        async with httpx.AsyncClient(transport=httpx.MockTransport(handle)) as client:
            session = {'client': client, 'username': 'OWN', 'dashboard_html': 'outdated dashboard',
                '_ams_view_cache': {'old': 'private old source response'}}
            begin_sync(self.db, self.sid)
            with patch('app.services.ams.sync_service.TimetableService.sync_timetable',
                    new=AsyncMock(return_value={'inserted': 0, 'sourceCoursesCount': 0})):
                await sync_authenticated_records(self.db, self.sid, session, AmsAdapter())
            self.assertNotIn('old', session['_ams_view_cache'])
        self.assertEqual(calls, ['/Default.aspx'])
        self.assertEqual(self.db.users.find_one({'_id': ObjectId(self.sid)})['name'], 'Fictional Student')
