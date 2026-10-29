import unittest
from app.services.ams.credits import parse_credit_details,parse_grade_scale
from app.services.ams.academic_pages import discover_academic_pages
class CreditDetailsTests(unittest.TestCase):
 def test_credit_ledger_and_published_summary_preserve_source_fields(self):
  html='''<table><tr><th>Semester</th><th>Course Code</th><th>Course Name</th><th>Credit</th><th>Credit Earned</th><th>Grade</th></tr><tr><td>II</td><td>CS101</td><td>Fictional computing</td><td>4</td><td>4</td><td>A</td></tr></table><table><tr><td>CGPA</td><td>8.75</td></tr></table>'''
  data=parse_credit_details(html);self.assertEqual(data['credits'][0]['credits'],'4');self.assertEqual(data['creditSummary'],[{'label':'CGPA','value':'8.75'}])
 def test_category_totals_are_not_fabricated_into_course_credits(self):
  html='<table><tr><th>Category</th><th>Minimum Credits</th><th>Credits Earned</th></tr><tr><td>Professional Core</td><td>60</td><td>42</td></tr></table>'
  row=parse_credit_details(html)['credits'][0];self.assertEqual(row['earnedCredits'],'42');self.assertNotIn('courseCode',row)
 def test_grade_conversion_requires_explicit_source_legend_pairs(self):
  html='<div class="grade-list"><h3>Grade points</h3><p>A: 9</p><p>B - 8</p><p>WH: Withheld</p></div>'
  self.assertEqual(parse_grade_scale(html),[{'grade':'A','points':9.0},{'grade':'B','points':8.0}])
 def test_unlabeled_legend_and_mark_ranges_do_not_become_grade_points(self):
  self.assertEqual(parse_grade_scale('<div class="grade-list">A: 90–100 B: 80–89</div>'),[])
  self.assertEqual(parse_grade_scale('<div class="grade-list">A: 9 B: 8</div>'),[])
 def test_credit_and_material_links_are_discovered_as_their_own_modules(self):
  pages=discover_academic_pages('<a href="CreditDetails.aspx">Credit Earned Details</a><a href="Coursematerial.aspx">Course Material</a>',include_modules=True)
  self.assertEqual([p['kind'] for p in pages],['credits','documents'])

class ModuleReadBudgetTests(unittest.IsolatedAsyncioTestCase):
 async def test_five_academic_sections_do_not_silently_skip_the_last_section(self):
  import httpx
  from app.services.ams.source_modules import collect_source_modules
  class Adapter:BASE_URL='https://ams.veltech.edu.in'
  paths=['CreditDetails.aspx','Fees.aspx','Documents.aspx','Examinations.aspx','CourseRegistration.aspx']
  labels=['Credit Earned Details','Fees','Documents','Examinations','Course registration']
  html=''.join(f'<a href="{path}">{label}</a>' for path,label in zip(paths,labels));requests=[]
  def handler(request):
   requests.append(request.url.path);return httpx.Response(200,text='<p>No records available</p>',request=request)
  async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as client:
   result=await collect_source_modules({'client':client,'dashboard_html':html,'url':Adapter.BASE_URL+'/Default.aspx'},Adapter())
  self.assertEqual(len(requests),5)
  self.assertTrue(all(row['status']!='not-loaded' for row in result['modules']))
