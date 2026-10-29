"""Allowlisted report selection never submits a university write action."""
import asyncio
import unittest
import httpx
from app.services.ams.report_views import report_choices,report_payload,iter_read_only_reports

URL='https://ams.veltech.edu.in/SemesterMark.aspx'
FORM='''<form method="post" action="./SemesterMark.aspx">
<input type="hidden" name="__VIEWSTATE" value="fictional-state">
<input type="hidden" name="__EVENTVALIDATION" value="fictional-validation">
<input type="hidden" name="UnexpectedWrite" value="never-send">
<select name="ctl00$MainContent$YoPList" onchange="javascript:setTimeout('__doPostBack(\\'ctl00$MainContent$YoPList\\',\\'\\')', 0)">
<option value="0">Select YoR</option><option value="May.2025">May.2025</option>
<option value="Nov.2025">Nov.2025</option><option value="May.2025">May.2025</option>
<option value="OTHER-STUDENT">Must not send</option></select>
<input type="submit" name="ctl00$MainContent$Button3" value="Print">
<input type="submit" name="ctl00$MainContent$Button2" value="Excel"></form>'''

class ReportFormTests(unittest.TestCase):
    def test_only_existing_valid_report_choices_are_deduplicated(self):
        self.assertEqual([row['value'] for row in report_choices(FORM,URL)],['May.2025','Nov.2025'])

    def test_payload_keeps_required_state_but_never_export_or_write_controls(self):
        payload=report_payload(FORM,URL,'May.2025')
        self.assertEqual(payload['__VIEWSTATE'],'fictional-state')
        self.assertEqual(payload['__EVENTTARGET'],'ctl00$MainContent$YoPList')
        self.assertNotIn('UnexpectedWrite',payload)
        self.assertFalse(any('Button' in key for key in payload))
        self.assertIsNone(report_payload(FORM,URL,'May.2026'))

    def test_unexpected_path_action_query_handler_and_missing_state_are_rejected(self):
        for html,url in [(FORM,URL+'?StudentId=OTHER'),(FORM,URL.replace('SemesterMark','Payment')),
                         (FORM.replace('./SemesterMark.aspx','https://elsewhere.test/collect'),URL),
                         (FORM.replace('javascript:setTimeout','otherFunction'),URL),
                         (FORM.replace('__EVENTVALIDATION','other-state'),URL)]:
            self.assertIsNone(report_payload(html,url,'May.2025'))

class ReportFetchTests(unittest.IsolatedAsyncioTestCase):
    async def test_reports_are_bounded_read_only_posts_and_use_fresh_state(self):
        from urllib.parse import parse_qs
        calls=[]
        def handle(request):
            calls.append(parse_qs(request.content.decode()))
            return httpx.Response(200,text=FORM.replace('fictional-state','next-state'),headers={'content-type':'text/html'})
        async with httpx.AsyncClient(transport=httpx.MockTransport(handle)) as client:
            response=httpx.Response(200,text=FORM,request=httpx.Request('GET',URL))
            views=[view async for view in iter_read_only_reports({'client':client},response,object(),[0],asyncio.get_running_loop().time()+10)]
        self.assertEqual(len(views),2)
        self.assertEqual(calls[1]['__VIEWSTATE'],['next-state'])

    async def test_expired_budget_does_not_make_a_request(self):
        calls=[]
        async with httpx.AsyncClient(transport=httpx.MockTransport(lambda r:calls.append(r))) as client:
            response=httpx.Response(200,text=FORM,request=httpx.Request('GET',URL))
            views=[view async for view in iter_read_only_reports({'client':client},response,object(),[36],asyncio.get_running_loop().time()+10)]
        self.assertEqual((views,calls),([],[]))

    async def test_semester_result_radio_is_an_explicit_read_only_report_control(self):
        radio='''<input type="radio" id="MainContent_RadioButton1" name="ctl00$MainContent$group1" value="RadioButton1" onclick="javascript:setTimeout('__doPostBack(\\'ctl00$MainContent$RadioButton1\\',\\'\\')', 0)"><label for="MainContent_RadioButton1">Regular</label>'''
        html=FORM.replace('</form>',radio+'</form>')
        choices=report_choices(html,URL)
        self.assertEqual(choices[0]['resultType'],'Regular')
        payload=report_payload(html,URL,choices[0]['value'],'Regular')
        self.assertEqual(payload['ctl00$MainContent$group1'],'RadioButton1')
        self.assertEqual(payload['__EVENTTARGET'],'ctl00$MainContent$RadioButton1')
        self.assertIsNone(report_payload(html,URL,choices[0]['value'],'Arrear'))
