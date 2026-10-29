import unittest
from uuid import uuid4
import httpx
from bson import ObjectId
from pymongo import MongoClient
from app.services.ams.source_modules import parse_fee_rows,parse_registration_page,parse_examination_rows,collect_source_modules,store_source_modules
from app.routes.campus import course_registration,snapshot

def table(caption,headers,rows):
    return '<table><caption>'+caption+'</caption><tr>'+''.join('<th>'+value+'</th>' for value in headers)+'</tr>'+''.join('<tr>'+''.join('<td>'+value+'</td>' for value in row)+'</tr>' for row in rows)+'</table>'

class SectionParserTests(unittest.TestCase):
    def test_offerings_are_not_invented_from_registered_or_unlabeled_courses(self):
        headers=['Course Code','Course Name','Credits','Faculty','Slot']
        html=table('Registered courses',headers,[['CS101','Algorithms','3','Faculty One','A1']])+table('Offered courses',headers,[['CS202','Networks','4','Faculty Two','B2']])+table('Course registration',headers,[['CS303','Unknown category','3','Faculty','C3']])+'<p role="alert">Confirm your source eligibility.</p>'
        parsed=parse_registration_page(html)
        self.assertEqual([row['courseCode'] for row in parsed['registeredCourses']],['CS101'])
        self.assertEqual([row['courseCode'] for row in parsed['offerings']],['CS202'])
        self.assertEqual(parsed['offerings'][0]['credits'],'4')
        self.assertEqual(parsed['warnings'],['Confirm your source eligibility.'])
    def test_duplicate_headers_merged_cells_and_ambiguous_fee_dates_do_not_get_guessed(self):
        html=table('Fees',['Fee Type','Amount','Fee Amount'],[['Semester','100','200']])
        self.assertEqual(parse_fee_rows(html),[])
        html=table('Fees',['Fee Type','Amount','Paid Date'],[['Semester','₹ 1,250','10/11/2026']])
        self.assertEqual(parse_fee_rows(html)[0]['dateText'],'10/11/2026')
        self.assertNotIn('date',parse_fee_rows(html)[0])
        merged='<table><tr><th>Fee Type</th><th>Amount</th></tr><tr><td colspan="2">Semester ₹100</td></tr></table>'
        self.assertEqual(parse_fee_rows(merged),[])
    def test_examinations_preserve_source_fields_and_unknown_dates_as_text(self):
        parsed=parse_examination_rows(table('Examinations',['Exam Name','Exam Date','Exam Time','Venue','Course Code'],[['Mid semester','10/11/2026','FN','Hall A','CS101']]))
        self.assertEqual(parsed,[{'name':'Mid semester','dateText':'10/11/2026','time':'FN','room':'Hall A','courseCode':'CS101'}])
        self.assertEqual(parse_examination_rows('<p>CS101 examination soon</p>'),[])

class ModuleCollectionTests(unittest.IsolatedAsyncioTestCase):
    async def test_discovered_get_only_and_redirect_nonhtml_login_layouts_stay_unavailable(self):
        requests=[]
        def handle(request):
            requests.append(request)
            if request.url.path=='/Fees.aspx':return httpx.Response(302,headers={'location':'https://evil.example/'})
            if request.url.path=='/Examinations.aspx':return httpx.Response(200,text=table('Exam',['Exam Name','Date'],[['Test','2026-10-15']]),headers={'content-type':'application/json'})
            return httpx.Response(200,text='<input type="password">')
        class Adapter:
            BASE_URL='https://ams.veltech.edu.in'
            _looks_like_student_page=staticmethod(lambda html:'Student dashboard' in html)
        async with httpx.AsyncClient(transport=httpx.MockTransport(handle),follow_redirects=True) as client:
            session={'client':client,'url':Adapter.BASE_URL+'/Default.aspx','username':'mine','dashboard_html':'Student dashboard<a href="Fees.aspx">Fees</a><a href="Examinations.aspx">Examinations</a><a href="CourseRegistration.aspx">Course registration</a><a href="Fees.aspx?studentId=other">Fees</a>'}
            parsed=await collect_source_modules(session,Adapter())
        self.assertEqual(len(requests),3)
        self.assertTrue(all(request.method=='GET' for request in requests))
        self.assertEqual(parsed['fees'],[]);self.assertEqual(parsed['examinations'],[])
        self.assertTrue(all(module['status']=='unavailable' for module in parsed['modules']))

class SectionStorageTests(unittest.TestCase):
    def setUp(self):
        self.client=MongoClient('mongodb://127.0.0.1:27017',serverSelectionTimeoutMS=1000);self.db=self.client['campus_test_sections_v14_'+uuid4().hex];self.id=ObjectId()
        self.db.users.insert_one({'_id':self.id,'role':'student','fees':[{'name':'Imported fee','amount':100,'source':'student-import'}]})
    def tearDown(self):self.client.drop_database(self.db.name);self.client.close()
    def test_partial_updates_preserve_existing_sections_and_private_owner(self):
        other=ObjectId();self.db.users.insert_one({'_id':other})
        store_source_modules(self.db,str(self.id),{'modules':[{'kind':'fees','status':'unsupported'}],'registeredCourses':[{'courseCode':'CS101','courseName':'Algorithms'}],'fees':[],'offerings':[]})
        me=self.db.users.find_one({'_id':self.id});snap=snapshot({'id':str(self.id),**me},self.db)
        self.assertEqual(snap['academic']['sectionSources']['courses']['source'],'ams')
        self.assertEqual(snap['academic']['sectionSources']['fees']['source'],'student-import')
        self.assertEqual(snap['academic']['sectionSources']['results']['status'],'unavailable')
        self.assertNotIn('fees',self.db.users.find_one({'_id':other}))
        registration=course_registration({'id':str(self.id)},self.db)
        self.assertEqual(registration['offerings'],[]);self.assertFalse(registration['submissionSupported'])
    def test_handoff_rejects_host_confusion_and_returns_source_warnings(self):
        self.db.timetable_metadata.insert_one({'studentId':str(self.id),'sourceModules':[{'kind':'course-registration','url':'https://ams.veltech.edu.in@evil.example/Registration.aspx'}],'registrationWarnings':['Source warning']})
        registration=course_registration({'id':str(self.id)},self.db)
        self.assertIsNone(registration['officialUrl']);self.assertEqual(registration['warnings'],['Source warning'])
