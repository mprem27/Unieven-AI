import unittest
from app.services.ams.credits import parse_credit_details
from app.services.ams.academic_pages import parse_academic_page

class ResultSummaryFixTests(unittest.TestCase):
 def test_credit_summary_retains_labelled_overall_percentage_with_percent_sign(self):
  data=parse_credit_details('<table><tr><td>Overall CGPA</td><td>8.40</td></tr><tr><td>Overall Percentage</td><td>84.0%</td></tr></table>')
  self.assertEqual(data['creditSummary'],[{'label':'Overall CGPA','value':'8.40'},{'label':'Overall Percentage','value':'84.0%'}])

 def test_result_row_preserves_explicit_overall_percentage_alongside_published_gpa(self):
  data=parse_academic_page('<table><tr><th>Course Code</th><th>Grade</th><th>Semester</th><th>SGPA</th><th>CGPA</th><th>Overall Percentage</th></tr><tr><td>TEST101</td><td>A</td><td>II</td><td>8.60</td><td>8.40</td><td>84%</td></tr></table>')
  self.assertEqual(data['results'][0]['overallPercentage'],'84%')

class ResultSummaryCollectorTests(unittest.IsolatedAsyncioTestCase):
 async def test_summary_only_result_report_is_supported_and_retained(self):
  import httpx
  from app.services.ams.academic_pages import collect_academic_pages
  class Adapter:BASE_URL='https://ams.veltech.edu.in'
  def handler(request):return httpx.Response(200,headers={'content-type':'text/html'},text='<table><tr><td>CGPA</td><td>8.40</td></tr><tr><td>Overall Percentage</td><td>84%</td></tr></table>',request=request)
  async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as client:
   result=await collect_academic_pages({'client':client,'url':Adapter.BASE_URL+'/Default.aspx','dashboard_html':'<a href="SemesterMark.aspx">Results</a>'},Adapter())
  self.assertEqual(len(result['resultSummary']),2)
  self.assertEqual(result['modules'][0]['status'],'available')

class ResultSummaryStorageTests(unittest.TestCase):
 def test_conflicting_published_summaries_are_preserved_for_ambiguity_checks(self):
  from bson import ObjectId
  from app.services.ams.storage import store_academic_rows
  class Users:
   value={'_id':ObjectId()}
   def find_one(self,*args):return self.value
   def update_one(self,query,update):self.value.update(update['$set']);return type('Saved',(),{'matched_count':1})()
  class DB:users=Users()
  db=DB();store_academic_rows(db,str(db.users.value['_id']),{'resultSummary':[{'label':'CGPA','value':'8.4'},{'label':'CGPA','value':'8.5'}]})
  self.assertEqual([row['value'] for row in db.users.value['resultSummary']],['8.4','8.5'])
