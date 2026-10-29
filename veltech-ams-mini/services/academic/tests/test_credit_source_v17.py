"""Fictional rows matching the authenticated CreditDetails header structure."""
import unittest
from app.services.ams.credits import parse_credit_details

class CreditSourceV17Tests(unittest.TestCase):
 def test_inspected_credit_report_keeps_ams_column_names_and_division(self):
  html='''<h2>Credit Report</h2><table id="MainContent_gvCreditReport"><tr><th>Category</th><th>Course Code</th><th>Course Name</th><th>Credit Registered</th><th>Credit Earned</th></tr><tr><td>Professional Core</td><td>FI101</td><td>Fictional systems</td><td>4</td><td>4</td></tr></table>'''
  rows=parse_credit_details(html)['credits']
  self.assertEqual(len(rows),1)
  self.assertEqual(rows[0]['sourceReport'],'Credit Report')
  self.assertEqual(rows[0]['rowType'],'course')
  self.assertEqual(list(rows[0]['sourceColumns'].values()),['Category','Course Code','Course Name','Credit Registered','Credit Earned'])
  self.assertEqual(rows[0]['sourceColumns']['credits'],'Credit Registered')
  self.assertEqual(rows[0]['earnedCredits'],'4')
 def test_category_and_semester_summaries_keep_separate_row_types(self):
  html='''<h2>Category credits</h2><table><tr><th>Category</th><th>Minimum Credits</th><th>Credits Earned</th></tr><tr><td>Core</td><td>60</td><td>42</td></tr></table><h2>Semester credits</h2><table><tr><th>Semester</th><th>Credits Earned</th></tr><tr><td>II</td><td>21</td></tr></table>'''
  rows=parse_credit_details(html)['credits']
  self.assertEqual([r['rowType'] for r in rows],['category','semester'])
  self.assertEqual([r['sourceReport'] for r in rows],['Category credits','Semester credits'])
 def test_unknown_layout_and_unrelated_heading_are_not_claimed_as_source_metadata(self):
  html='<h2>Account details</h2><table><tr><th>Course Code</th><th>Credit</th></tr><tr><td>FI101</td><td>4</td></tr></table>'
  row=parse_credit_details(html)['credits'][0]
  self.assertNotIn('sourceReport',row)
  self.assertEqual(parse_credit_details('<table><tr><td>FI101</td><td>4</td></tr></table>')['credits'],[])
