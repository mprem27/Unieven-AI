"""Synthetic examples only; these fixtures do not verify the live AMS layout."""
import unittest

import httpx

from app.services.ams.academic_pages import (
    collect_academic_pages, discover_academic_pages, parse_academic_page,
)


def table(headers, rows):
    return '<table><tr>' + ''.join(f'<th>{h}</th>' for h in headers) + '</tr>' + ''.join(
        '<tr>' + ''.join(f'<td>{v}</td>' for v in row) + '</tr>' for row in rows
    ) + '</table>'


SUMMARY = table(['Course Code', 'Course Name', 'Total Classes', 'Present Classes', 'Attendance %'], [
    ['CS101', 'Computing', '10', '8', '80%'],
])


class DiscoveryTests(unittest.TestCase):
    def test_only_descriptive_read_only_same_origin_aspx_links(self):
        html = '''<a href="/AttendanceView.aspx">Attendance</a>
        <a href="Results.aspx">Semester grades</a>
        <a href="/TimeTable.aspx">Schedule</a>
        <a href="https://elsewhere.test/Attendance.aspx">Attendance</a>
        <a href="http://ams.veltech.edu.in/Attendance.aspx">Attendance</a>
        <a href="https://ams.veltech.edu.in:444/Attendance.aspx">Attendance</a>
        <a href="javascript:doAttendance()">Attendance</a>
        <a href="/Attendance.aspx">Edit attendance</a>
        <a href="/SaveAttendance.aspx">Attendance</a>
        <a href="/Login.aspx">Results</a>
        <a href="/Logout.aspx">Results</a>
        <a href="/Validation.aspx">Results</a>
        <a href="/ForgotPassword.aspx">Results</a>
        <a href="/Attendance.aspx?action=delete">Attendance</a>
        <a href="/Attendance.csv">Attendance</a>
        <a href="/AttendanceView.aspx">Attendance</a>'''
        self.assertEqual(discover_academic_pages(html), [
            {'url': 'https://ams.veltech.edu.in/AttendanceView.aspx', 'kind': 'attendance'},
            {'url': 'https://ams.veltech.edu.in/Results.aspx', 'kind': 'results'},
        ])

    def test_identifier_queries_must_belong_to_the_session(self):
        html = '''<a href="/Marks.aspx?StudentId=OWN">Marks</a>
        <a href="/Marks.aspx?StudentId=OTHER">Marks</a>
        <a href="/Marks.aspx?id=OWN&amp;id=OTHER">Marks</a>
        <a href="/Marks.aspx?rollNo=OWN">Marks</a>'''
        self.assertEqual(discover_academic_pages(html), [])
        self.assertEqual(len(discover_academic_pages(html, identifiers=['OWN'])), 2)

    def test_encoded_mutations_userinfo_and_untrusted_base_are_rejected(self):
        html = '''<a href="/Delete%41ttendance.aspx">Attendance</a>
        <a href="https://user@ams.veltech.edu.in/Results.aspx">Results</a>
        <a href="/Attendance.aspx?%61ction=view">Attendance</a>'''
        self.assertEqual(discover_academic_pages(html), [])
        self.assertEqual(discover_academic_pages('<a href="/Results.aspx">Results</a>', 'https://elsewhere.test'), [])


class ParsingTests(unittest.TestCase):
    def test_source_summary_does_not_invent_daily_records(self):
        data = parse_academic_page(SUMMARY)
        self.assertEqual(data['summary'], [{'subjectCode': 'CS101', 'subjectName': 'Computing', 'totalCount': 10, 'presentCount': 8, 'percentage': 80.0}])
        self.assertEqual(data['records'], [])
        self.assertEqual(data['results'], [])

    def test_invalid_counts_percentages_and_missing_codes_are_skipped(self):
        html = table(['Subject Code', 'Subject Name', 'Total', 'Present', 'Percentage'], [
            ['CS101', 'One', '5', '6', '120'], ['CS102', 'Two', '-1', '0', '0'],
            ['CS103', 'Three', 'ten', '8', '80'], ['', 'Four', '10', '8', '80'],
            ['Total', 'Five', '10', '8', '80'], ['CS104', 'Six', '10', '8', '30'],
            ['CS105', 'Seven', '10', '-2', '0'],
        ])
        self.assertEqual(parse_academic_page(html)['summary'], [])

    def test_labeled_per_period_records_preserve_od_unknown_and_deduplicate(self):
        rows = [['CS101', 'Computing', '2026-10-14', 'P1', 'P'],
                ['CS101', 'Computing', '14-Oct-2026', 'P2', 'OD'],
                ['CS101', 'Computing', '2026-10-14', 'P3', 'Absent'],
                ['CS101', 'Computing', '2026-10-14', 'P4', 'Pending'],
                ['CS101', 'Computing', '2026-10-14', 'P1', 'P']]
        html = table(['Course Code', 'Course Name', 'Date', 'Period', 'Status'], rows)
        records = parse_academic_page(html)['records']
        self.assertEqual([r['status'] for r in records], ['present', 'on-duty', 'absent', 'unknown'])
        self.assertEqual([r['period'] for r in records], ['P1', 'P2', 'P3', 'P4'])
        self.assertTrue(all(r['date'] == '2026-10-14' for r in records))

    def test_invalid_dates_missing_period_and_unlabeled_rows_are_skipped(self):
        html = table(['Course Code', 'Date', 'Period', 'Status'], [
            ['CS101', '2026-02-30', '1', 'Present'], ['CS101', '2026-10-14', '', 'Present'],
        ]) + '<table><tr><td>CS101</td><td>2026-10-14</td><td>1</td><td>P</td></tr></table>'
        self.assertEqual(parse_academic_page(html)['records'], [])

    def test_result_values_are_preserved_only_from_labeled_columns(self):
        html = table(['Subject Code', 'Subject Name', 'Grade', 'Credits', 'Semester', 'CGPA', 'GPA'], [
            ['CS101', 'Computing', 'A+', '3.0', 'II', '8.75', '9.0'],
            ['', 'Total', 'A', '20', 'II', '8.75', '9.0'],
        ])
        self.assertEqual(parse_academic_page(html)['results'], [{'courseCode': 'CS101', 'courseName': 'Computing', 'grade': 'A+', 'credits': '3.0', 'semester': 'II', 'cgpa': '8.75', 'gpa': '9.0'}])

    def test_unknown_layout_and_merged_cells_are_not_guessed(self):
        html = '<h1>Attendance</h1><p>CS101: 8/10, 80%</p>' + table(['Code', 'Value'], [['CS101', '80']])
        html += '<table><tr><th>Course Code</th><th>Date</th><th>Period</th><th>Status</th></tr><tr><td colspan="2">CS101</td><td>1</td><td>P</td></tr></table>'
        self.assertEqual(parse_academic_page(html), {'summary': [], 'records': [], 'results': []})

    def test_all_output_rows_are_capped(self):
        html = table(['Course Code', 'Date', 'Period', 'Status'], [
            ['CS101', '2026-10-14', str(i), 'P'] for i in range(4100)
        ])
        self.assertEqual(len(parse_academic_page(html)['records']), 4000)


    def test_cap_counts_rows_across_output_kinds(self):
        html = table(['Course Code', 'Total', 'Present', 'Percentage', 'Grade'], [
            [f'CS{i}', '10', '8', '80', 'A'] for i in range(1, 3001)
        ])
        parsed = parse_academic_page(html)
        self.assertEqual(sum(len(rows) for rows in parsed.values()), 4000)

    def test_ambiguous_numeric_dates_are_not_assumed(self):
        html = table(['Course Code', 'Date', 'Period', 'Status'], [
            ['CS101', '10/11/2026', '1', 'P'],
        ])
        self.assertEqual(parse_academic_page(html)['records'], [])


class FakeAdapter:
    BASE_URL = 'https://ams.veltech.edu.in'

    @staticmethod
    def _looks_like_student_page(html):
        return 'Student dashboard' in html

    @staticmethod
    def _contains_authentication_error(html):
        return 'invalid credentials' in html.lower()


class CollectionTests(unittest.IsolatedAsyncioTestCase):
    def session(self, client, links):
        return {'client': client, 'dashboard_html': 'Student dashboard' + links, 'username': 'OWN', 'url': 'https://ams.veltech.edu.in/Default.aspx'}

    async def test_same_client_session_at_most_four_read_only_requests(self):
        calls = []
        def handle(request):
            calls.append(request)
            return httpx.Response(200, text=SUMMARY, headers={'content-type': 'text/html'})
        async with httpx.AsyncClient(transport=httpx.MockTransport(handle), follow_redirects=True, cookies={'session': 'fake'}) as client:
            links = ''.join(f'<a href="/Attendance{i}.aspx?id=OWN">Attendance</a>' for i in range(6))
            data = await collect_academic_pages(self.session(client, links), FakeAdapter())
        self.assertEqual(len(calls), 4)
        self.assertEqual(data['pagesLoaded'], 4)
        self.assertEqual(len(data['summary']), 1)
        self.assertTrue(data['notes'])
        self.assertTrue(all(r.method == 'GET' and r.headers['cookie'] == 'session=fake' for r in calls))
        self.assertTrue(all(max(r.extensions['timeout'].values()) <= 10 for r in calls))

    async def test_redirect_login_error_oversize_pages_preserve_partial_notes(self):
        calls = []
        def handle(request):
            calls.append(str(request.url))
            name = request.url.path
            if name == '/Attendance1.aspx':
                return httpx.Response(302, headers={'location': 'https://elsewhere.test/Results.aspx'})
            if name == '/Attendance2.aspx':
                return httpx.Response(200, text='<form><input type="password"></form>' + SUMMARY)
            if name == '/Attendance3.aspx':
                return httpx.Response(500, text=SUMMARY)
            return httpx.Response(200, text='x' * 2_000_001 + SUMMARY)
        async with httpx.AsyncClient(transport=httpx.MockTransport(handle), follow_redirects=True) as client:
            links = ''.join(f'<a href="/Attendance{i}.aspx">Attendance</a>' for i in range(1, 5))
            data = await collect_academic_pages(self.session(client, links), FakeAdapter())
        self.assertEqual(len(calls), 4)
        self.assertEqual(data['pagesLoaded'], 0)
        self.assertEqual(data['summary'], [])
        self.assertEqual(len(data['notes']), 1)
        self.assertEqual(len(data['modules']), 4)
        self.assertTrue(all(module['status'] == 'unavailable' for module in data['modules']))

    async def test_transport_failure_does_not_discard_supported_rows(self):
        def handle(request):
            if request.url.path == '/Results.aspx':
                raise httpx.ConnectError('private diagnostic content', request=request)
            return httpx.Response(200, text=SUMMARY, headers={'content-type': 'text/html'})
        async with httpx.AsyncClient(transport=httpx.MockTransport(handle)) as client:
            data = await collect_academic_pages(self.session(client, '<a href="/Attendance.aspx">Attendance</a><a href="/Results.aspx">Results</a>'), FakeAdapter())
        self.assertEqual(len(data['summary']), 1)
        self.assertEqual(data['pagesLoaded'], 1)
        self.assertTrue(data['notes'])
        self.assertNotIn('private diagnostic content', str(data))

    async def test_no_dashboard_links_never_guesses_pages(self):
        def handle(request):
            self.fail('No URL may be guessed')
        async with httpx.AsyncClient(transport=httpx.MockTransport(handle)) as client:
            data = await collect_academic_pages(self.session(client, ''), FakeAdapter())
        self.assertEqual(data['pagesLoaded'], 0)
        self.assertTrue(data['notes'])

    async def test_unsupported_layout_is_explicitly_reported(self):
        async with httpx.AsyncClient(transport=httpx.MockTransport(lambda request: httpx.Response(200, text='<p>Unverified layout</p>', headers={'content-type': 'text/html'}))) as client:
            data = await collect_academic_pages(self.session(client, '<a href="/Results.aspx">Results</a>'), FakeAdapter())
        self.assertEqual(data['pagesLoaded'], 1)
        self.assertTrue(any('no supported' in note.lower() for note in data['notes']))

    async def test_untrusted_or_login_dashboard_does_not_fetch(self):
        def handle(request):
            self.fail('An untrusted dashboard must not be fetched')
        async with httpx.AsyncClient(transport=httpx.MockTransport(handle)) as client:
            session = self.session(client, '<a href="/Attendance.aspx">Attendance</a>')
            session['url'] = 'https://elsewhere.test/Default.aspx'
            data = await collect_academic_pages(session, FakeAdapter())
            session['url'] = 'https://ams.veltech.edu.in/Login.aspx'
            session['dashboard_html'] = '<input type="password"><a href="/Attendance.aspx">Attendance</a>'
            login = await collect_academic_pages(session, FakeAdapter())
        self.assertEqual(data['pagesLoaded'], 0)
        self.assertEqual(login['pagesLoaded'], 0)
