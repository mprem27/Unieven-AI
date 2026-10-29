"""Fictional records reproducing the inspected AMS layout; no student data."""
import unittest
from app.services.ams.academic_pages import parse_academic_page, discover_academic_pages
from app.services.ams.source_modules import parse_registration_page

ATTENDANCE = '''<table><tr><th>Date</th><th>HR 1</th><th>HR 2</th><th>HR 3</th></tr>
<tr><td class="date-column">15-10-2026</td><td class="present">ABCDEFGLAB(P)</td>
<td class="absent">ABCDEFGLAB(A)</td><td class="no-class">-</td></tr>
<tr><td class="date-column">16-10-2026</td><td class="present">ABCDEFGLAB(A)</td>
<td class="absent">UNRELATEDX(A)</td><td class="no-class">-</td></tr></table>
<table><tr><th>Course</th><th>Faculty</th><th>Total Session</th><th>Faculty Session</th>
<th>Student Session</th><th>Present</th><th>Absent</th><th>Present %</th><th>Overall %</th><th>Status</th></tr>
<tr><td class="course-cell"><div class="code">ABCDEFGLAB</div><div class="name">Fictional laboratory</div></td>
<td>Fictional faculty</td><td>60</td><td>10</td><td>10</td><td>8</td><td>2</td><td><span>80</span></td><td>13</td><td>Eligible</td></tr></table>'''

class LiveLayoutTests(unittest.TestCase):
    def test_student_sessions_are_the_attendance_denominator_not_planned_sessions(self):
        data = parse_academic_page(ATTENDANCE)
        self.assertEqual(len(data['summary']), 1)
        row = data['summary'][0]
        self.assertEqual((row['subjectCode'],row['subjectName']),('ABCDEFGLAB','Fictional laboratory'))
        self.assertEqual((row['totalCount'],row['presentCount'],row['percentage']),(10,8,80))

    def test_date_hour_grid_uses_explicit_matching_marks_and_course_identity(self):
        data = parse_academic_page(ATTENDANCE)
        self.assertEqual(data['records'],[
            {'subjectCode':'ABCDEFGLAB','subjectName':'Fictional laboratory','date':'2026-10-15','period':'1','status':'present'},
            {'subjectCode':'ABCDEFGLAB','subjectName':'Fictional laboratory','date':'2026-10-15','period':'2','status':'absent'},
        ])

    def test_conflicting_counts_are_not_used_to_create_an_attendance_summary(self):
        data = parse_academic_page(ATTENDANCE.replace('<td>2</td>','<td>5</td>'))
        self.assertEqual(data['summary'],[])

    def test_registered_alphabetic_codes_are_valid_in_the_official_code_column(self):
        html = '<table id="MainContent_GridView3"><tr><th>Course Code</th><th>Course Name</th></tr><tr><td>ABCDEFGLAB</td><td>Fictional laboratory</td></tr></table>'
        self.assertEqual(parse_registration_page(html)['registeredCourses'][0]['courseCode'],'ABCDEFGLAB')

    def test_feedback_is_not_fees_and_only_the_discovered_payment_landing_is_readable(self):
        html = '''<a href="StudentFeedback.aspx">Interim Feedback</a>
        <a href="Payment.aspx">Payment</a><a href="Fees.aspx">Fees</a>
        <a href="Payment.aspx?action=pay">Pay now</a><a href="PayFees.aspx">Pay fees</a>'''
        pages = discover_academic_pages(html,include_modules=True)
        self.assertEqual(pages,[{'url':'https://ams.veltech.edu.in/Payment.aspx','kind':'fees'},
                               {'url':'https://ams.veltech.edu.in/Fees.aspx','kind':'fees'}])

    def test_actual_result_columns_are_owner_scoped_and_do_not_invent_credits(self):
        html='''<table><tr><th>SNo</th><th>Stu Id</th><th>Semester</th><th>Coursecode</th><th>Coursename</th><th>Result</th><th>Grade</th></tr>
        <tr><td>1</td><td>OWN</td><td>6</td><td>ABCDEFGLAB</td><td>Fictional laboratory</td><td>PASS</td><td>A</td></tr>
        <tr><td>2</td><td>OTHER</td><td>6</td><td>ABCDEFGLAB</td><td>Fictional laboratory</td><td>PASS</td><td>B</td></tr></table>'''
        rows=parse_academic_page(html,['own'])['results']
        self.assertEqual(rows,[{'courseCode':'ABCDEFGLAB','courseName':'Fictional laboratory','grade':'A','semester':'6','status':'PASS'}])

    def test_internal_and_assessment_marks_remain_distinct_from_final_grades(self):
        html='''<table><tr><th>Coursecode</th><th>Coursename</th><th>FinalInternal</th></tr>
        <tr><td>ABCDEFGLAB</td><td>Fictional laboratory</td><td>24</td></tr></table>
        <table><tr><th>Coursecode</th><th>Coursename</th><th>TestMark1</th><th>TestMark2</th><th>TestMark3</th></tr>
        <tr><td>ABCDEFGLAB</td><td>Fictional laboratory</td><td>16</td><td>AB</td><td>-</td></tr></table>'''
        rows=parse_academic_page(html)['results']
        self.assertEqual(len(rows),2)
        self.assertEqual(rows[0]['resultType'],'Final internal')
        self.assertEqual(rows[1]['testMark2'],'AB')
        self.assertTrue(all('gradePoints' not in row and 'grade' not in row for row in rows))
