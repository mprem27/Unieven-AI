import unittest
from app.services.ams.source_modules import parse_fee_rows
from app.services.ams.academic_pages import discover_academic_pages
class SourceModulesTests(unittest.TestCase):
 def test_supported_fee_table_has_actual_amount_status_and_unambiguous_date_only(self):
  rows=parse_fee_rows('<table><tr><th>Fee Type</th><th>Amount</th><th>Status</th><th>Paid Date</th></tr><tr><td>Semester fee</td><td>₹ 1,250.00</td><td>Paid</td><td>2026-10-15</td></tr></table>')
  self.assertEqual(rows,[{'name':'Semester fee','amount':1250.0,'status':'Paid','date':'2026-10-15'}])
  self.assertEqual(parse_fee_rows('<p>Paid 1,250 rupees</p>'),[])
 def test_module_urls_must_exist_in_own_dashboard_and_foreign_identity_is_rejected(self):
  rows=discover_academic_pages('<a href="CourseRegistration.aspx">Course registration</a><a href="Fees.aspx?studentId=other">Fees</a><a href="https://evil.example/Fees.aspx">Fees</a>','https://ams.veltech.edu.in/Default.aspx',['mine'],include_modules=True)
  self.assertEqual(rows,[{'url':'https://ams.veltech.edu.in/CourseRegistration.aspx','kind':'course-registration'}])
