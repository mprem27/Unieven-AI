"""Bounded read-only reports from the three inspected AMS report forms.

These ASP.NET POSTs select an existing report. They never submit registrations,
feedback, payments, profile changes, print or export actions.
"""
import asyncio
import re
from urllib.parse import urljoin,urlsplit
from bs4 import BeautifulSoup

MAX_REPORT_VIEWS = 36
REPORT_SECONDS = 50
_STATE = re.compile(r'__(?:VIEWSTATE\d*|VIEWSTATEFIELDCOUNT|VIEWSTATEGENERATOR|EVENTVALIDATION|EVENTTARGET|EVENTARGUMENT|LASTFOCUS)\Z')
_FORMS = {
    '/SemesterMark.aspx':('ctl00$MainContent$YoPList',None,None,r'(?:May|Nov)\.20\d{2}','semester-grades'),
    '/InternalMark.aspx':('ctl00$MainContent$Semlist','ctl00$MainContent$Button1','Get Internal Marks',r'(?:SS|WS)\d{4}','internal-marks'),
    '/Marks.aspx':('ctl00$MainContent$Semlist','ctl00$MainContent$Button1','Get Marks',r'(?:SS|WS)\d{4}','assessment-marks'),
}


def report_choices(html,url):
    spec = _FORMS.get(urlsplit(url).path)
    if not spec or urlsplit(url).query:
        return []
    name,button,label,pattern,kind = spec
    soup = BeautifulSoup(html,'html.parser')
    selects = soup.find_all('select',attrs={'name':name})
    if len(selects) != 1:
        return []
    form = selects[0].find_parent('form')
    if not form or str(form.get('method','')).lower() != 'post' or urljoin(url,form.get('action','')) != url:
        return []
    if button:
        inputs = form.find_all('input',attrs={'type':'submit','name':button,'value':label})
        if len(inputs) != 1:
            return []
    elif not re.fullmatch(r"javascript:setTimeout\('__doPostBack\(\\'ctl00\$MainContent\$YoPList\\',\\'\\'\)', 0\)",str(selects[0].get('onchange',''))):
        return []
    values = list(dict.fromkeys(str(node.get('value','')) for node in selects[0].find_all('option')
                               if not node.has_attr('disabled') and re.fullmatch(pattern,str(node.get('value','')))))
    if kind == 'semester-grades' and form.select('input[type="radio"]'):
        modes = []
        for number,title in ((1,'Regular'),(2,'Arrear'),(3,'Revaluation')):
            radio = form.find('input',attrs={'type':'radio','id':f'MainContent_RadioButton{number}',
                'name':'ctl00$MainContent$group1','value':f'RadioButton{number}'})
            text = form.find('label',attrs={'for':f'MainContent_RadioButton{number}'})
            handler = f"javascript:setTimeout('__doPostBack(\\'ctl00$MainContent$RadioButton{number}\\',\\'\\')', 0)"
            if radio and text and text.get_text(' ',strip=True) == title and radio.get('onclick') == handler:
                modes.append({'resultType':title,'radioValue':f'RadioButton{number}',
                              'eventTarget':f'ctl00$MainContent$RadioButton{number}'})
        if not modes:
            return []
        values.sort(key=lambda value:(value.split('.')[1],value.startswith('Nov')),reverse=True)
        return [{'value':value,'kind':kind,**mode} for mode in modes for value in values[:12]]
    return [{'value':value,'kind':kind} for value in values[:12]]


def report_payload(html,url,value,result_type=None):
    choices = report_choices(html,url)
    choice = next((choice for choice in choices if choice['value'] == value and
                   (result_type is None or choice.get('resultType') == result_type)),None)
    if not choice:
        return None
    name,button,label,_,_ = _FORMS[urlsplit(url).path]
    soup = BeautifulSoup(html,'html.parser')
    form = soup.find('select',attrs={'name':name}).find_parent('form')
    fields = {}
    for node in form.select('input[type="hidden"][name]'):
        key = node['name']
        if _STATE.fullmatch(key):
            if key in fields:
                return None
            fields[key] = str(node.get('value',''))
    if not fields.get('__VIEWSTATE') or not fields.get('__EVENTVALIDATION'):
        return None
    fields.update({name:value,'__EVENTTARGET':name if not button else '','__EVENTARGUMENT':''})
    if button:
        fields[button] = label
    if choice.get('radioValue'):
        fields['ctl00$MainContent$group1'] = choice['radioValue']
        fields['__EVENTTARGET'] = choice['eventTarget']
    return fields


async def iter_read_only_reports(session,response,adapter,budget,deadline):
    from app.services.ams.academic_pages import fetch_bounded_html,_login_or_error
    url = str(response.url)
    current = response
    for choice in report_choices(response.text,url):
        if budget[0] >= MAX_REPORT_VIEWS:
            return
        remaining = deadline - asyncio.get_running_loop().time()
        if remaining <= 0:
            return
        payload = report_payload(current.text,url,choice['value'],choice.get('resultType'))
        if payload is None:
            return
        budget[0] += 1
        try:
            async with asyncio.timeout(remaining):
                next_view = await fetch_bounded_html(session['client'],url,method='POST',data=payload)
        except TimeoutError:
            return
        if _login_or_error(next_view.text,adapter):
            raise ValueError('AMS report returned an authentication page.')
        next_view.extensions['ams_report'] = choice
        session.setdefault('_ams_view_cache',{})[url+'#report-'+choice['value']+'-'+choice.get('resultType','')] = next_view
        current = next_view
        yield next_view
