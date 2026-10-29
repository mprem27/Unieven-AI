"""Optional read-only extraction from discovered, authenticated AMS pages.

Supports inspected AMS date/hour attendance and explicitly labeled result/mark
tables, plus conservative discovered view/frame readers. Unknown layouts produce
no rows; summary counts never create daily records.
"""
from __future__ import annotations

import re
import asyncio
from datetime import datetime
from typing import Any
from urllib.parse import parse_qsl, unquote, urljoin, urlsplit

from bs4 import BeautifulSoup
import httpx
from app.services.ams.labeled_tables import labeled_rows
from app.services.ams.attendance_grid import parse_attendance_grid, COURSE_CODE


AMS_ORIGIN = 'https://ams.veltech.edu.in'
MAX_ROWS = 4000
MAX_PAGE_BYTES = 2_000_000
MAX_PAGES = 4
REQUEST_TIMEOUT = 10.0
_UNSAFE = re.compile(r'login|logout|validation|forgotpassword|delete|edit|save|update|action|submit|upload|withdraw|remove|enroll|confirm|payment|payfees|paynow|registercourses|dropcourse|addcourse', re.I)
_CODE = COURSE_CODE


def unsafe_view_path(path):
    # Payment.aspx is the dashboard's read-only landing page. Only its discovered
    # GET is allowed; no payment form, action URL or checkout is submitted.
    return bool(_UNSAFE.search(path)) and path not in {'/Payment.aspx','/CreditDetails.aspx'}

# Matching is explicit; column positions, element IDs and unlabeled text never
# substitute for source labels. Result values retain the source's text.
_HEADERS = {
    'code': {'coursecode', 'subjectcode', 'papercode'},
    'name': {'coursename', 'subjectname', 'papername', 'subject', 'course'},
    'total': {'total', 'totalclasses', 'totalcount', 'classesconducted', 'totalclassesconducted', 'conductedclasses', 'totalperiods'},
    'present': {'present', 'presentcount', 'presentclasses', 'classesattended', 'attendedclasses', 'attended', 'presentperiods'},
    'percentage': {'percentage', 'attendancepercentage', 'attendancepercent', 'attendance', 'percent'},
    'date': {'date', 'attendancedate', 'classdate'},
    'period': {'period', 'periodno', 'periodnumber', 'classperiod', 'hour', 'hourno'},
    'status': {'status', 'attendancestatus'},
    'grade': {'grade', 'lettergrade', 'resultgrade'},
    'gradePoints': {'gradepoints', 'gradepoint'},
    'credits': {'credits', 'credit', 'coursecredits', 'subjectcredits'},
    'semester': {'semester', 'sem'},
    'cgpa': {'cgpa', 'cumulativegradepointaverage'},
    'gpa': {'gpa', 'sgpa', 'semestergradepointaverage', 'gradepointaverage'},
    'overallPercentage': {'overallpercentage','aggregatepercentage','cumulativepercentage'},
    'resultStatus': {'result', 'resultstatus', 'passfail'},
    'studentIdentifier': {'stuid', 'studentid', 'vtunumber', 'rollnumber'},
    'testMark1': {'testmark1'}, 'testMark2': {'testmark2'}, 'testMark3': {'testmark3'},
    'midTestMark1': {'midtestmark1'}, 'midTestMark2': {'midtestmark2'},
    'labMark': {'labmark'}, 'assignmentMark': {'assignmentmark'}, 'internalMark': {'finalinternal'},
}


def _normalized(value: str) -> str:
    return re.sub(r'[^a-z0-9]', '', value.lower())


def _same_origin(url: str) -> bool:
    try:
        parts = urlsplit(url)
        return (parts.scheme == 'https' and parts.hostname == 'ams.veltech.edu.in'
                and parts.port in (None, 443) and not parts.username and not parts.password)
    except ValueError:
        return False


def _identifier_key(key: str) -> bool:
    normalized = _normalized(key)
    return (normalized == 'id' or normalized.endswith('id') or any(
        token in normalized for token in ('student', 'username', 'vtu', 'roll', 'registration', 'regno')
    ))


def discover_academic_pages(
    html: str, base_url: str = AMS_ORIGIN, identifiers=(), include_modules=False,
) -> list[dict[str, str]]:
    """Return safe view links actually present in the student dashboard.

    Identity-bearing query parameters require an exact session identifier match.
    Non-identity parameters are limited to ordinary academic view filters.
    """
    if not _same_origin(base_url):
        return []
    own_identifiers = {str(item).strip() for item in identifiers if str(item).strip()}
    found = []
    seen = set()
    for anchor in BeautifulSoup(html or '', 'html.parser').find_all(['a', 'iframe', 'frame']):
        href = str(anchor.get('href') if anchor.name == 'a' else anchor.get('src') or '').strip()
        if anchor.get('onclick'):
            # Extract one literal navigation assignment; never execute JavaScript,
            # postbacks, concatenation, handlers or arbitrary function calls.
            match = re.fullmatch(r'''\s*(?:window\.)?location(?:\.href)?\s*=\s*(['"])([^'"\\\r\n]+)\1\s*;?\s*(?:return\s+false\s*;?)?\s*''', str(anchor['onclick']))
            if not match:
                continue
            href = match.group(2)
        if not href or any(ord(char) < 32 for char in href) or '\\' in href:
            continue
        url = urljoin(base_url, href)
        if not _same_origin(url):
            continue
        parts = urlsplit(url)
        path = unquote(parts.path)
        label = anchor.get_text(' ', strip=True) + ' ' + str(anchor.get('title', ''))
        credit_landing = path == '/CreditDetails.aspx' and not parts.query and _normalized(label) in {'creditearneddetails','creditdetails'}
        payment_landing = path == '/Payment.aspx' and not parts.query and label.strip().lower() == 'payment'
        if not path.lower().endswith('.aspx') or '%' in unquote(path) or (not (payment_landing or credit_landing) and _UNSAFE.search(unquote(path) + ' ' + label)):
            continue
        descriptive = path + ' ' + label
        if re.search(r'attendance', descriptive, re.I):
            kind = 'attendance'
        elif re.search(r'results?|marks?|grades?', descriptive, re.I):
            kind = 'results'
        elif include_modules and re.search(r'course.?registration|course.?offer|offered.?courses|registered.?courses|course.?registered', label, re.I):
            kind = 'course-registration'
        elif include_modules and re.search(r'credit.?details|credit.?earn|earned.?credits',descriptive,re.I):
            kind = 'credits'
        elif include_modules and re.search(r'time.?table', descriptive, re.I):
            kind = 'timetable'
        elif include_modules and re.search(r'profile|student.?details|personal.?details', descriptive, re.I):
            kind = 'profile'
        elif include_modules and re.search(r'course.?registration|course.?offer|offered.?courses|registered.?courses|course.?registered', descriptive, re.I):
            kind = 'course-registration'
        elif include_modules and (payment_landing or re.search(r'\b(?:fees?|receipts?)\b', re.sub(r'([a-z])([A-Z])',r'\1 \2',descriptive), re.I)):
            kind = 'fees'
        elif include_modules and re.search(r'examinations?|exam.?schedule', descriptive, re.I):
            kind = 'examinations'
        elif include_modules and re.search(r'documents?|certificates?|course.?material|syllabus', descriptive, re.I):
            kind = 'documents'
        else:
            continue
        allowed = True
        for key, value in parse_qsl(parts.query, keep_blank_values=True):
            if _UNSAFE.search(key):
                allowed = False
            elif _identifier_key(key):
                allowed = allowed and value in own_identifiers
            elif _normalized(key) not in {'semester', 'sem', 'year', 'academicyear', 'exam', 'examtype', 'type', 'view'}:
                allowed = False
            elif _UNSAFE.search(value) or not re.fullmatch(r'[A-Za-z0-9 _./-]{1,40}', value):
                allowed = False
        if not allowed:
            continue
        # Fragments do not distinguish server pages.
        url = parts._replace(fragment='').geturl()
        if (url, kind) not in seen:
            found.append({'url': url, 'kind': kind})
            seen.add((url, kind))
    return found


def _empty() -> dict[str, list]:
    return {'summary': [], 'records': [], 'results': []}


def _date(value: str) -> str | None:
    # ISO and textual month forms are unambiguous. Numeric day/month order is
    # intentionally unsupported until a source format has been verified.
    for pattern in ('%Y-%m-%d', '%d-%b-%Y', '%d %b %Y', '%d-%B-%Y', '%d %B %Y'):
        try:
            return datetime.strptime(value, pattern).date().isoformat()
        except ValueError:
            pass
    return None


def _count(value: str) -> int | None:
    if not re.fullmatch(r'\d{1,9}', value):
        return None
    return int(value)


def _percentage(value: str) -> float | None:
    if not re.fullmatch(r'\d{1,3}(?:\.\d{1,4})?\s*%?', value):
        return None
    number = float(value.rstrip('%').strip())
    return number if 0 <= number <= 100 else None


def _status(value: str) -> str:
    return {
        'p': 'present', 'present': 'present',
        'a': 'absent', 'absent': 'absent',
        'od': 'on-duty', 'onduty': 'on-duty',
    }.get(_normalized(value), 'unknown')


def _append_unique(output: dict, seen: dict, kind: str, row: dict) -> None:
    key = tuple(sorted(row.items()))
    if key not in seen[kind] and sum(len(output[k]) for k in seen) < MAX_ROWS:
        output[kind].append(row)
        seen[kind].add(key)


def parse_academic_page(html: str, identifiers=()) -> dict[str, list[dict[str, Any]]]:
    """Extract supported, labeled summaries, period records and course results.

    A row needs an identifiable course code. Source summary percentage and counts
    must agree within half a percentage point (rounded source percentages).
    Credits, grade, semester and GPA remain source text, without inferred values.
    """
    output = _empty()
    seen = {key: set() for key in output}
    examined = 0
    soup = BeautifulSoup(html or '', 'html.parser')
    grid = parse_attendance_grid(soup)
    for kind, rows in grid.items():
        for row in rows:
            _append_unique(output, seen, kind, row)
    mapping = {alias: field for field, aliases in _HEADERS.items() for alias in aliases}
    owners = {str(value).strip().casefold() for value in identifiers if value}
    for table in soup.find_all('table'):
        for row, _, _ in labeled_rows(table, mapping, {'code'}):
            examined += 1
            if examined > MAX_ROWS:
                return output
            code = row['code']
            if not _CODE.fullmatch(code):
                continue
            if owners and 'studentIdentifier' in row and row['studentIdentifier'].strip().casefold() not in owners:
                continue
            name = row.get('name', '')
            if {'total', 'present', 'percentage'} <= row.keys():
                total, present, percentage = _count(row['total']), _count(row['present']), _percentage(row['percentage'])
                if total is not None and present is not None and percentage is not None and 0 <= present <= total:
                    expected = 100 * present / total if total else 0
                    if abs(percentage - expected) <= 0.51:
                        _append_unique(output, seen, 'summary', {
                            'subjectCode': code, 'subjectName': name, 'totalCount': total,
                            'presentCount': present, 'percentage': percentage,
                        })
            if {'date', 'period', 'status'} <= row.keys() and row['period']:
                date = _date(row['date'])
                if date:
                    _append_unique(output, seen, 'records', {
                        'subjectCode': code, 'subjectName': name, 'date': date,
                        'period': row['period'], 'status': _status(row['status']),
                    })
            if any(row.get(field) for field in ('grade', 'gradePoints', 'cgpa', 'gpa')):
                result = {'courseCode': code}
                if name:
                    result['courseName'] = name
                result.update({field: row[field] for field in ('grade', 'gradePoints', 'credits', 'semester', 'cgpa', 'gpa', 'overallPercentage') if row.get(field)})
                if row.get('resultStatus'):
                    result['status'] = row['resultStatus']
                _append_unique(output, seen, 'results', result)
            for label,fields in (
                ('Test marks',('testMark1','testMark2','testMark3')),
                ('Mid-test marks',('midTestMark1','midTestMark2')),
                ('Lab marks',('labMark',)),('Assignment marks',('assignmentMark',)),
                ('Final internal',('internalMark',)),
            ):
                marks = {field:row[field] for field in fields if row.get(field)}
                if marks:
                    result = {'courseCode':code,'resultType':label,**marks}
                    if name:result['courseName'] = name
                    if row.get('semester'):result['semester'] = row['semester']
                    _append_unique(output,seen,'results',result)
    return output


def _login_or_error(html: str, adapter: Any) -> bool:
    soup = BeautifulSoup(html, 'html.parser')
    if soup.select_one('input[type="password"]'):
        return True
    text = soup.get_text(' ', strip=True).lower()
    if any(phrase in text for phrase in ('invalid credentials', 'login failed', 'authentication failed', 'session expired', 'please login', 'please log in')):
        return True
    checker = getattr(adapter, '_contains_authentication_error', None)
    return bool(checker and checker(html))


async def fetch_bounded_html(client, url, method='GET', data=None):
    """Stream an explicitly discovered view, including decompressed size limits."""
    async with client.stream(method,url,data=data,timeout=REQUEST_TIMEOUT,follow_redirects=False) as response:
        if not _same_origin(str(response.url)) or response.status_code!=200:
            raise ValueError('AMS view returned an error or redirect.')
        content_type=response.headers.get('content-type','').lower()
        if content_type and not any(kind in content_type for kind in ('text/html','application/xhtml+xml')):
            raise ValueError('AMS view did not return HTML.')
        length=response.headers.get('content-length')
        if length and (not length.isdigit() or int(length)>MAX_PAGE_BYTES):
            raise ValueError('AMS view exceeded the size limit.')
        content=bytearray()
        async for chunk in response.aiter_bytes():
            if len(content)+len(chunk)>MAX_PAGE_BYTES:raise ValueError('AMS view exceeded the size limit.')
            content.extend(chunk)
        # aiter_bytes already decoded compressed transfer bodies.
        headers={key:value for key,value in response.headers.items() if key not in {'content-encoding','content-length','transfer-encoding'}}
        return httpx.Response(response.status_code,headers=headers,content=bytes(content),request=response.request)


async def fetch_session_view(session, url, adapter):
    """Cache accepted HTML only inside the current owner's live AMS session."""
    if not _same_origin(url) or unsafe_view_path(unquote(urlsplit(url).path)):
        raise ValueError('Unsafe AMS view.')
    cache = session.setdefault('_ams_view_cache', {})
    if url not in cache:
        response = await fetch_bounded_html(session['client'], url)
        if _login_or_error(response.text, adapter):
            raise ValueError('AMS view returned an authentication page.')
        cache[url] = response
    return cache[url]


async def iter_module_views(session, page, adapter, budget, max_pages=MAX_PAGES):
    """Read a discovered view and its directly embedded, same-module frames.

    The total read budget includes frames. There is no arbitrary script execution,
    arbitrary postback submission, redirect following, guessed URL, or recursive crawling.
    """
    pending = [page['url']]
    seen = set()
    while pending and budget[0] < max_pages:
        url = pending.pop(0)
        if url in seen:
            continue
        seen.add(url)
        budget[0] += 1
        response = await fetch_session_view(session, url, adapter)
        yield response
        if url == page['url']:
            frames = ''.join(str(node) for node in BeautifulSoup(response.text, 'html.parser').find_all(['iframe', 'frame']))
            identifiers = session_identifiers(session)
            pending.extend(view['url'] for view in discover_academic_pages(frames, url, identifiers, include_modules=True)
                           if view['kind'] == page['kind'] and view['url'] not in seen)


def session_identifiers(session):
    return [session.get(key) for key in ('username', 'portalUsername', 'vtuNumber', 'studentId', 'rollNumber', 'registrationNumber') if session.get(key)]


def module_notes(modules):
    """At most one safe summary per module; detailed states stay in metadata."""
    labels = {'attendance': 'Attendance', 'results': 'Results', 'course-registration': 'Courses',
              'credits':'Credits', 'fees': 'Fees', 'examinations': 'Examinations', 'documents': 'Documents'}
    return [f'{label}: no supported records from some AMS views; previous records retained.'
            for kind, label in labels.items() if any(row.get('kind') == kind and row.get('status') != 'available' for row in modules)]


def layout_diagnostics(html, accepted_rows=0):
    """Only structural counts and allowlisted field names, never source values."""
    soup = BeautifulSoup(html or '', 'html.parser')
    headers = [row for row in soup.find_all('tr')
               if row.find_all(['th', 'td'], recursive=False)
               and all(cell.name == 'th' for cell in row.find_all(['th', 'td'], recursive=False))]
    aliases = {alias: field for field, names in _HEADERS.items() for alias in names}
    fields = {aliases[_normalized(cell.get_text(' ', strip=True))]
              for row in headers for cell in row.find_all('th', recursive=False)
              if _normalized(cell.get_text(' ', strip=True)) in aliases}
    return {'viewCount': 1, 'tableCount': len(soup.find_all('table')), 'headerRowCount': len(headers),
            'frameCount': len(soup.find_all(['iframe', 'frame'])), 'acceptedRowCount': accepted_rows,
            'recognizedHeaderFields': sorted(fields)}


def merge_diagnostics(previous, incoming):
    if not previous:
        return incoming
    return {**{key: previous.get(key, 0) + incoming.get(key, 0)
               for key in ('viewCount', 'tableCount', 'headerRowCount', 'frameCount', 'acceptedRowCount')},
            'recognizedHeaderFields': sorted(set(previous.get('recognizedHeaderFields', []))
                                             | set(incoming.get('recognizedHeaderFields', [])))}


async def collect_academic_pages(session: dict[str, Any], adapter: Any, *, on_progress=None) -> dict[str, Any]:
    """Use an existing authenticated session for up to four discovered view GETs.

    No login, guessed route, recursive discovery, credential submission or redirect
    occurs here. Known report forms may receive bounded read-only selection POSTs. Failure notes are generic and never contain URLs, HTML or private
    exception details. The caller continues to own the client's cookie session.
    pagesLoaded counts accepted HTML responses, even if their layout is unsupported.
    """
    output = {**_empty(), 'notes': [], 'pagesLoaded': 0, 'modules': [],'gradeScale': [],'resultSummary': []}
    notes = output['notes']
    client = session.get('client')
    dashboard = session.get('dashboard_html', '')
    base = session.get('url') or getattr(adapter, 'BASE_URL', AMS_ORIGIN)
    if not client or not dashboard or not _same_origin(base) or _UNSAFE.search(unquote(urlsplit(base).path)):
        notes.append('Authenticated AMS student dashboard unavailable; no academic pages requested.')
        return output
    checker = getattr(adapter, '_looks_like_student_page', None)
    if len(dashboard.encode('utf-8')) > MAX_PAGE_BYTES or _login_or_error(dashboard, adapter) or (checker and not checker(dashboard)):
        notes.append('AMS student dashboard was not accepted; no academic pages requested.')
        return output
    seen = {key: set() for key in ('summary', 'records', 'results')}
    identifiers = session_identifiers(session)
    inline = parse_academic_page(dashboard,identifiers)
    for kind, rows in inline.items():
        for row in rows:
            _append_unique(output, seen, kind, row)
    for kind, count in (('attendance', len(inline['summary']) + len(inline['records'])), ('results', len(inline['results']))):
        if count:
            output['modules'].append({'url': base, 'kind': kind, 'status': 'available', 'layoutSupported': True,
                                      'rowCount': count, 'error': None, 'checkedAt': datetime.now().astimezone().isoformat(),
                                      'diagnostics': layout_diagnostics(dashboard, count)})
    if on_progress and any(inline.values()):
        on_progress(output)
    pages = discover_academic_pages(dashboard, base_url=base, identifiers=identifiers)
    fetched_modules = [{**page, 'status': 'not-loaded', 'layoutSupported': False} for page in pages]
    output['modules'].extend(fetched_modules)
    if not pages:
        if not any(inline.values()):
            notes.append('No supported academic view links or labeled records were discovered in the AMS dashboard.')
        return output
    if len(pages) > MAX_PAGES:
        notes.append('Academic page limit reached; additional dashboard links were not loaded.')
    budget = [0]
    from app.services.ams.report_views import iter_read_only_reports, REPORT_SECONDS
    report_budget = [0]
    report_deadline = asyncio.get_running_loop().time() + REPORT_SECONDS
    # Final grades take precedence over assessment reports within the bounded
    # report budget. All requests still originate in discovered dashboard links.
    fetched_modules.sort(key=lambda page:(page['kind']!='attendance',urlsplit(page['url']).path!='/SemesterMark.aspx'))
    for page in fetched_modules:
        if budget[0] >= MAX_PAGES:
            break
        page.update(status='unavailable', error='Data not available: AMS page could not be loaded.', checkedAt=datetime.now().astimezone().isoformat())
        parsed = _empty()
        published = []
        failure = None
        try:
            async for response in iter_module_views(session, page, adapter, budget):
                async def views():
                    yield response
                    if page['kind'] == 'results':
                        async for report in iter_read_only_reports(session,response,adapter,report_budget,report_deadline):
                            yield report
                async for view in views():
                    from app.services.ams.credits import parse_grade_scale
                    for scale in parse_grade_scale(view.text):
                        if scale not in output['gradeScale']:output['gradeScale'].append(scale)
                    part = parse_academic_page(view.text,identifiers)
                    selection = view.extensions.get('ams_report',{})
                    if selection:
                        for row in part['results']:
                            row.setdefault('semester',selection['value'])
                            row.setdefault('resultType',selection.get('resultType') or selection['kind'])
                            if selection['kind']=='semester-grades':
                                row['examinationSession'] = selection['value']
                    summaries=[]
                    if page['kind']=='results':
                        from app.services.ams.credits import parse_credit_details
                        summaries=parse_credit_details(view.text)['creditSummary']
                        semesters={row['semester'] for row in part['results'] if row.get('semester')}
                        for row in summaries:
                            if len(semesters)==1:row['semester']=next(iter(semesters))
                            if selection.get('kind')=='semester-grades':row['examinationSession']=selection['value']
                            if row not in published:published.append(row)
                            if row not in output['resultSummary']:output['resultSummary'].append(row)
                    count = len(part['summary']) + len(part['records']) if page['kind'] == 'attendance' else len(part['results'])+len(summaries)
                    page['diagnostics'] = merge_diagnostics(page.get('diagnostics'), layout_diagnostics(view.text, count))
                    for kind, rows in part.items():
                        for row in rows:
                            if row not in parsed[kind]:
                                parsed[kind].append(row)
                            _append_unique(output, seen, kind, row)
                    output['pagesLoaded'] += 1
                    if on_progress and (any(part.values()) or summaries):
                        count=len(parsed['summary'])+len(parsed['records']) if page['kind']=='attendance' else len(parsed['results'])+len(published)
                        page.update(status='available' if count else 'unsupported',layoutSupported=bool(count),rowCount=count,error=None if count else 'Data not available: AMS page has no supported labeled rows.')
                        on_progress(output)
        except httpx.HTTPError:
            failure = 'error'
        except ValueError:
            failure = 'unavailable'
        supported = (parsed['summary'] or parsed['records']) if page['kind'] == 'attendance' else parsed['results'] or published
        page.update(status='available' if supported else failure or 'unsupported', layoutSupported=bool(supported),
                    rowCount=len(parsed['summary'])+len(parsed['records']) if page['kind']=='attendance' else len(parsed['results'])+len(published),
                    error=None if supported else 'Data not available: AMS page could not be loaded.' if failure
                    else 'Data not available: AMS page has no supported labeled rows.')
        if on_progress:
            on_progress(output)
    notes.extend(module_notes(output['modules']))
    return output
