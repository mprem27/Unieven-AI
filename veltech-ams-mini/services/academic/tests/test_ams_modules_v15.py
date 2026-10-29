"""Synthetic labeled fixtures; no claim about the private live AMS layout."""
import unittest
import gzip
from uuid import uuid4
from unittest.mock import AsyncMock,patch

import httpx
from bson import ObjectId
from pymongo import MongoClient

from app.services.ams.academic_pages import discover_academic_pages, parse_academic_page,fetch_bounded_html,MAX_PAGE_BYTES
from app.services.ams.source_modules import parse_fee_rows, parse_document_rows, collect_source_modules, store_source_modules
from app.services.ams.sync_status import begin_sync, report_module, finish_sync, fail_sync, read_sync_status
from app.routes.campus import academic_document


def table(headers, rows):
    return '<table><tr>'+''.join('<th>'+v+'</th>' for v in headers)+'</tr>'+''.join('<tr>'+''.join('<td>'+v+'</td>' for v in row)+'</tr>' for row in rows)+'</table>'


class ModuleParserTests(unittest.TestCase):
    def test_documents_need_labeled_rows_and_preserve_exact_link_associations(self):
        html=table(['Document Name','Document Type','Reference Number','Download'],[
            ['Bonafide','Certificate','REF1','<a href="/files/own.pdf">Download</a>'],
            ['Transcript','Academic','REF2','<a href="https://evil.example/file.pdf">Download</a>'],
            ['Pending','Letter','REF3','<a href="/files/own.pdf?studentId=other">Download</a>'],
        ])+'<a href="/files/unrelated.pdf">Unrelated footer</a>'
        rows=parse_document_rows(html,'https://ams.veltech.edu.in/Documents.aspx',['mine'])
        self.assertEqual(len(rows),3)
        self.assertEqual(rows[0]['url'],'https://ams.veltech.edu.in/files/own.pdf')
        self.assertNotIn('url',rows[1]);self.assertNotIn('url',rows[2])
        self.assertEqual(parse_document_rows('<a href="/files/one.pdf">Document</a>'),[])

    def test_receipts_and_unknown_grades_remain_source_text(self):
        html=table(['Fee Type','Amount','Receipt Number','Receipt'],[
            ['Semester','₹ 1,250.00','R1','<a href="Receipts/one.pdf">View</a>'],
            ['Library','100','R2','<a href="/Logout.aspx">View</a>'],
        ])
        rows=parse_fee_rows(html,'https://ams.veltech.edu.in/Fees.aspx',['mine'])
        self.assertEqual(rows[0]['url'],'https://ams.veltech.edu.in/Receipts/one.pdf')
        self.assertNotIn('url',rows[1])
        result=parse_academic_page(table(['Course Code','Grade','Result'],[['CS101','WITHHELD','Awaiting review']]))['results'][0]
        self.assertEqual(result['grade'],'WITHHELD');self.assertEqual(result['status'],'Awaiting review')

    def test_mutating_registration_links_are_never_fetch_candidates(self):
        html=''.join('<a href="'+path+'">'+label+'</a>' for path,label in [
            ('/CourseRegistration.aspx','Submit course registration'),('/RegisterCourses.aspx','Register courses'),
            ('/PayFees.aspx','Pay fees'),('/UploadDocuments.aspx','Upload documents'),
            ('/CourseRegistration.aspx','Course registration'),('/Documents.aspx','Documents')])
        rows=discover_academic_pages(html,include_modules=True)
        self.assertEqual([row['kind'] for row in rows],['course-registration','documents'])


class CollectionTests(unittest.IsolatedAsyncioTestCase):
    async def test_decoded_html_is_bounded_and_not_decoded_twice(self):
        html=b'<p>Supported body</p>'
        def handle(request):
            body=html if request.url.path=='/Results.aspx' else b'x'*(MAX_PAGE_BYTES+1)
            return httpx.Response(200,content=gzip.compress(body),headers={'content-type':'text/html','content-encoding':'gzip'})
        async with httpx.AsyncClient(transport=httpx.MockTransport(handle)) as client:
            response=await fetch_bounded_html(client,'https://ams.veltech.edu.in/Results.aspx')
            self.assertEqual(response.content,html)
            with self.assertRaises(ValueError):await fetch_bounded_html(client,'https://ams.veltech.edu.in/Fees.aspx')

    async def test_only_own_discovered_document_gets_are_used_and_files_are_bounded(self):
        calls=[]
        def handle(request):
            calls.append(request)
            if request.url.path=='/Documents.aspx':
                return httpx.Response(200,text=table(['Document Name','Download'],[
                    ['Own PDF','<a href="/files/one.pdf">Open</a>'],
                    ['Redirect','<a href="/files/redirect.pdf">Open</a>'],
                    ['HTML','<a href="/files/notpdf.pdf">Open</a>'],
                    ['Foreign','<a href="https://evil.example/file.pdf">Open</a>'],
                ]),headers={'content-type':'text/html'})
            if request.url.path=='/files/one.pdf':return httpx.Response(200,content=b'%PDF-1.7\nsynthetic fixture',headers={'content-type':'application/pdf'})
            if request.url.path=='/files/redirect.pdf':return httpx.Response(302,headers={'location':'https://evil.example/'})
            return httpx.Response(200,text='<input type="password">',headers={'content-type':'text/html'})
        class Adapter:
            BASE_URL='https://ams.veltech.edu.in'
            _looks_like_student_page=staticmethod(lambda html:'Student dashboard' in html)
        async with httpx.AsyncClient(transport=httpx.MockTransport(handle),follow_redirects=True) as client:
            result=await collect_source_modules({'client':client,'url':Adapter.BASE_URL+'/Default.aspx','username':'mine','dashboard_html':'Student dashboard<a href="/Documents.aspx">Documents</a>'},Adapter())
        self.assertEqual(len(result['documents']),4)
        self.assertEqual(len(result['files']),1)
        self.assertEqual(result['files'][0]['content'],b'%PDF-1.7\nsynthetic fixture')
        self.assertTrue(all(request.method=='GET' and request.url.host=='ams.veltech.edu.in' for request in calls))
        self.assertEqual(len(calls),4)
        self.assertTrue(all('url' not in row for row in result['documents']))
        self.assertIn('downloadId',result['documents'][0]);self.assertNotIn('downloadId',result['documents'][1])


class SyncStatusTests(unittest.TestCase):
    def setUp(self):
        self.mongo=MongoClient('mongodb://127.0.0.1:27017',serverSelectionTimeoutMS=1000)
        self.db=self.mongo['campus_test_modules_v15_'+uuid4().hex];self.sid=str(ObjectId())
        self.db.users.insert_one({'_id':ObjectId(self.sid),'role':'student','active':True})
    def tearDown(self):self.mongo.drop_database(self.db.name);self.mongo.close()

    def test_unavailable_modules_retain_last_success_and_report_current_attempt(self):
        self.assertEqual(read_sync_status(self.db,self.sid)['state'],'not_connected')
        begin_sync(self.db,self.sid)
        self.assertEqual(read_sync_status(self.db,self.sid)['state'],'syncing')
        report_module(self.db,self.sid,'profile','available',record_count=1)
        report_module(self.db,self.sid,'fees','available',record_count=1)
        finish_sync(self.db,self.sid)
        first=read_sync_status(self.db,self.sid);old=next(m for m in first['modules'] if m['id']=='fees')['lastSuccessAt']
        self.assertEqual(first['state'],'partial');self.assertIsNotNone(first['lastSuccessAt'])
        begin_sync(self.db,self.sid)
        report_module(self.db,self.sid,'fees','unsupported',error='Data not available: source layout unsupported.')
        finish_sync(self.db,self.sid)
        second=read_sync_status(self.db,self.sid);fee=next(m for m in second['modules'] if m['id']=='fees')
        self.assertEqual(fee['state'],'unsupported');self.assertEqual(fee['lastSuccessAt'],old)
        self.assertTrue(fee['retained']);self.assertEqual(fee['recordCount'],1)
        fail_sync(self.db,self.sid,'AMS authentication failed. Load a fresh challenge.')
        self.assertEqual(read_sync_status(self.db,self.sid)['state'],'failed')
        self.assertNotIn('portalPassword',str(second))

    def test_document_download_uses_only_signed_in_owner_and_unavailable_sections_preserve_rows(self):
        other=str(ObjectId());self.db.users.insert_one({'_id':ObjectId(other)})
        download_id=str(ObjectId())
        store_source_modules(self.db,self.sid,{'modules':[{'kind':'documents','status':'available','rowCount':1}],
            'documents':[{'name':'Certificate','downloadId':download_id}],
            'files':[{'id':download_id,'content':b'%PDF-1.7\nfixture','contentType':'application/pdf','name':'Certificate.pdf'}]})
        store_source_modules(self.db,self.sid,{'modules':[{'kind':'documents','status':'unsupported'}],'documents':[]})
        self.assertEqual(self.db.users.find_one({'_id':ObjectId(self.sid)})['documents'][0]['source'],'ams')
        data=academic_document(download_id,{'id':self.sid},self.db)
        self.assertEqual(data['contentType'],'application/pdf');self.assertTrue(data['base64'])
        from fastapi import HTTPException
        with self.assertRaises(HTTPException):academic_document(download_id,{'id':other},self.db)
        self.assertNotIn('documents',self.db.users.find_one({'_id':ObjectId(other)}))

    def test_previous_rows_are_not_reported_as_a_new_timetable_success(self):
        import asyncio
        from app.services.ams.sync_service import sync_authenticated_records
        class Adapter:
            BASE_URL='https://ams.veltech.edu.in'
            _looks_like_student_page=staticmethod(lambda html:'Student dashboard' in html)
        async def run():
            async with httpx.AsyncClient(transport=httpx.MockTransport(lambda request:httpx.Response(200,text='Unsupported layout'))) as client:
                session={'client':client,'url':Adapter.BASE_URL+'/Default.aspx','dashboard_html':'Student dashboard<a href="Results.aspx">Results</a>'}
                begin_sync(self.db,self.sid)
                with patch('app.services.ams.sync_service.TimetableService.sync_timetable',new=AsyncMock(return_value={'inserted':0,'courses':[{'source':'ams'}],'timetable':[{'source':'ams'}]})):
                    await sync_authenticated_records(self.db,self.sid,session,Adapter(),{'name':'Synthetic Student'})
        asyncio.run(run())
        status=read_sync_status(self.db,self.sid)
        self.assertEqual(status['state'],'partial')
        self.assertEqual(next(m for m in status['modules'] if m['id']=='profile')['state'],'available')
        for key in ('timetable','courses','results'):
            module=next(m for m in status['modules'] if m['id']==key)
            self.assertNotEqual(module['state'],'available');self.assertIsNone(module['lastSuccessAt'])

    def test_repeated_file_syncs_replace_the_cache_and_expose_finite_mongo_capacity(self):
        for index in range(6):
            download_id=str(ObjectId())
            store_source_modules(self.db,self.sid,{'documents':[{'name':'Certificate','downloadId':download_id}],
                'files':[{'id':download_id,'content':b'%PDF-1.7\nfixture','contentType':'application/pdf','name':'Certificate.pdf'}]})
            self.assertEqual(self.db.ams_documents.count_documents({'studentId':self.sid}),1)
        status=read_sync_status(self.db,self.sid)
        self.assertEqual(status['documentCache'],{'storage':'mongodb','fileCount':1,'totalBytes':16,'maxFiles':8,'maxBytes':16_000_000})
