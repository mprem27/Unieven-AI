import unittest
from fastapi import HTTPException

class StudentImportTests(unittest.TestCase):
    def test_rejects_identity_and_nested_credentials_and_excess_bytes(self):
        from app.services.student_import import parse_student_import
        result=parse_student_import('json','{"profile":{"name":"Own name","role":"admin","email":"other@example.edu","portalPassword":"secret"}}')
        self.assertEqual(result['profile'],{'name':'Own name'})
        with self.assertRaises(HTTPException):parse_student_import('json',' '*5_000_001)
    def test_csv_requires_kind_and_validates_periods(self):
        from app.services.student_import import parse_student_import
        data=parse_student_import('csv','kind,subjectCode,subjectName,date,period,status\nrecords,CS101,Algorithms,2026-10-15,1,present\n')
        self.assertEqual(data['records'][0]['subjectCode'],'CS101')
        with self.assertRaises(HTTPException):parse_student_import('csv','subjectCode,date,status\nCS101,2026-10-15,present\n')
    def test_html_only_accepts_explicit_labeled_academic_rows(self):
        from app.services.student_import import parse_student_import
        result=parse_student_import('html','<table><tr><th>Course Code</th><th>Course Name</th><th>Grade</th></tr><tr><td>CS101</td><td>Algorithms</td><td>A</td></tr></table>')
        self.assertEqual(result['results'][0]['courseCode'],'CS101')
        self.assertEqual(parse_student_import('html','<div>100% attendance</div>')['summary'],[])
