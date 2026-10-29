"""Explicitly labeled, discovered AMS sections; never guess private routes.

Readers support inspected registered courses and conservative labeled fixtures.
Fee statements, documents and schedules remain unavailable without source rows.
"""
import re
from urllib.parse import urljoin,urlsplit,parse_qsl,unquote
from bs4 import BeautifulSoup
from bson import ObjectId
import httpx
from app.services.ams.academic_pages import (
    discover_academic_pages, _same_origin, _login_or_error, MAX_PAGE_BYTES,
    REQUEST_TIMEOUT, _date, _CODE, MAX_ROWS, MAX_PAGES, _UNSAFE, _identifier_key, fetch_bounded_html,
    iter_module_views, session_identifiers, module_notes, layout_diagnostics, merge_diagnostics,
)
from app.utils.dates import utc_now
from app.services.ams.labeled_tables import labeled_rows

MAX_SOURCE_PAGES=8
MAX_FILES=4
MAX_FILE_BYTES=2_000_000
MAX_CACHED_FILES=MAX_FILES*2


def _resource_url(value,base,identifiers=()):
    """Only GET resources explicitly linked from the accepted owner's table row."""
    if not isinstance(value,str) or not value or '\\' in value or any(ord(c)<32 for c in value) or not _same_origin(base):return None
    url=urljoin(base,value);parts=urlsplit(url)
    path=unquote(unquote(parts.path))
    if not _same_origin(url) or '%' in path or _UNSAFE.search(path):return None
    if not (re.search(r'\.(?:pdf|png|jpe?g)$',path,re.I) or re.search(r'(?:download|receipt|document|certificate|file)[A-Za-z0-9_-]*\.aspx$',path,re.I)):return None
    own={str(v) for v in identifiers if v}
    for key,value in parse_qsl(parts.query,keep_blank_values=True):
        normalized=_normalized(key)
        if _UNSAFE.search(key) or _UNSAFE.search(value):return None
        if normalized in {'documentid','docid','fileid','receiptid','certificateid'}:
            if not re.fullmatch(r'[A-Za-z0-9_-]{1,100}',value):return None
        elif _identifier_key(key):
            if value not in own:return None
        elif normalized not in {'type','view','format'} or not re.fullmatch(r'[A-Za-z0-9_-]{1,40}',value):return None
    return parts._replace(fragment='').geturl()


def _row_resource(cells,columns,base,identifiers):
    field='file' if 'file' in columns else 'name' if 'name' in columns else None
    if not field:return None
    cell=cells[columns[field]]
    anchors=cell.find_all('a',href=True)
    # Multiple files in a cell have no unambiguous row association.
    if len(anchors)!=1 or anchors[0].get('onclick') or _UNSAFE.search(anchors[0].get_text(' ',strip=True)+' '+str(anchors[0].get('title',''))):return None
    return _resource_url(str(anchors[0]['href']).strip(),base,identifiers)


def _normalized(value):
    return re.sub(r'[^a-z0-9]', '', value.lower())


def _table_rows(table, mapping, required):
    yield from labeled_rows(table, mapping, required)


def _source_date(row):
    if row.get('date'):
        raw = row['date']
        parsed = _date(raw)
        if parsed:
            row['date'] = parsed
        else:
            row['dateText'] = raw
            row.pop('date')


def parse_fee_rows(html,base_url='https://ams.veltech.edu.in',identifiers=()):
    output = []
    mapping = {'description': 'name', 'feetype': 'name', 'feename': 'name', 'particulars': 'name',
               'feeamount': 'amount', 'amount': 'amount', 'paymentstatus': 'status', 'status': 'status',
               'paiddate': 'date', 'duedate': 'date', 'transactionreference': 'reference',
               'receiptnumber': 'reference', 'referencenumber': 'reference',
               'receipt':'file','viewreceipt':'file','downloadreceipt':'file','receiptdownload':'file'}
    for table in BeautifulSoup(html, 'html.parser').find_all('table'):
        for row, cells, columns in _table_rows(table, mapping, {'name', 'amount'}):
            amount = re.sub(r'^(?:INR|Rs\.?|₹)\s*', '', row['amount']).replace(',', '')
            if not row['name'] or not re.fullmatch(r'\d{1,10}(?:\.\d{1,2})?', amount):
                continue
            row['amount'] = float(amount)
            row.pop('file',None)
            link=_row_resource(cells,columns,base_url,identifiers)
            if link:row['url']=link
            _source_date(row)
            output.append(row)
            if len(output) >= MAX_ROWS:
                return output
    return output


def parse_document_rows(html,base_url='https://ams.veltech.edu.in',identifiers=()):
    output=[]
    mapping={'documentname':'name','documenttitle':'name','certificatename':'name','circulartitle':'name','circularname':'name','notificationtitle':'name','title':'name',
             'coursename':'name','description':'name','documenttype':'type','type':'type','category':'type','referencenumber':'reference','documentnumber':'reference','referenceno':'reference','documentno':'reference','circularno':'reference',
             'issuedate':'date','dateofissue':'date','publisheddate':'date','publicationdate':'date','publicationpublisheddate':'date','date':'date','download':'file','document':'file','file':'file',
             'downloadfile':'file','material':'file','viewdocument':'file','downloaddocument':'file','certificate':'file','view':'file'}
    for table in BeautifulSoup(html or '','html.parser').find_all('table'):
        caption=table.find('caption',recursive=False)
        heading=caption or table.find_previous(['h1','h2','h3','h4','legend'])
        context=heading.get_text(' ',strip=True) if heading else ''
        headers={_normalized(cell.get_text(' ',strip=True)) for cell in table.find_all(['th','td']) if cell.find_parent('table') is table and cell.find_parent('tr')}
        explicit=bool(headers & {'documentname','documenttitle','certificatename','circulartitle','circularname','notificationtitle','documenttype'})
        if not explicit and not re.search(r'\b(?:documents?|circulars?|certificates?|materials?|downloads?|letters?)\b',context,re.I):continue
        for row,cells,columns in _table_rows(table,mapping,{'name'}):
            if not row['name']:continue
            row.pop('file',None)
            link=_row_resource(cells,columns,base_url,identifiers)
            if link:row['url']=link
            _source_date(row);output.append(row)
            if len(output)>=MAX_ROWS:return output
    return output


async def _cache_linked_files(output,session):
    """Fetch at most four files during the live session; never retain cookies."""
    output['files']=[];attempts=0;seen={}
    for field in ('documents','fees'):
        for row in output[field]:
            url=row.pop('url',None)
            if not url:continue
            if url in seen:
                row['downloadId']=seen[url];continue
            if attempts>=MAX_FILES:continue
            attempts+=1
            try:
                async with session['client'].stream('GET',url,timeout=REQUEST_TIMEOUT,follow_redirects=False) as response:
                    content_type=response.headers.get('content-type','').split(';')[0].strip().lower()
                    if response.status_code!=200 or not _same_origin(str(response.url)) or content_type not in {'application/pdf','image/png','image/jpeg'}:continue
                    length=response.headers.get('content-length')
                    if length and (not length.isdigit() or int(length)>MAX_FILE_BYTES):continue
                    content=bytearray()
                    async for chunk in response.aiter_bytes():
                        if len(content)+len(chunk)>MAX_FILE_BYTES:
                            content=bytearray();break
                        content.extend(chunk)
                    if not content or len(content)>MAX_FILE_BYTES:continue
                    signatures={'application/pdf':b'%PDF-','image/png':b'\x89PNG\r\n\x1a\n','image/jpeg':b'\xff\xd8\xff'}
                    if not content.startswith(signatures[content_type]):continue
                    file_id=str(ObjectId());extension={'application/pdf':'.pdf','image/png':'.png','image/jpeg':'.jpg'}[content_type]
                    name=re.sub(r'[^\w .-]','',row.get('name','AMS document'))[:100].strip() or 'AMS document'
                    output['files'].append({'id':file_id,'content':bytes(content),'contentType':content_type,'name':name+extension})
                    row['downloadId']=file_id;seen[url]=file_id
            except httpx.HTTPError:
                continue


def parse_registration_page(html):
    """Registered courses and offerings need separate explicit table labels."""
    soup = BeautifulSoup(html, 'html.parser')
    output = {'registeredCourses': [], 'offerings': [], 'warnings': []}
    mapping = {'coursecode': 'courseCode', 'subjectcode': 'courseCode', 'coursename': 'courseName',
               'subjectname': 'courseName', 'credits': 'credits', 'credit': 'credits',
               'facultyname': 'facultyName', 'faculty': 'facultyName', 'facultyid': 'facultyId',
               'category': 'category', 'slot': 'slot', 'room': 'room', 'seats': 'seats',
               'availableseats': 'seats', 'prerequisites': 'prerequisites', 'status': 'status',
               'semester': 'semester', 'section': 'section'}
    for table in soup.find_all('table'):
        caption = table.find('caption', recursive=False)
        heading = caption or table.find_previous(['h1', 'h2', 'h3', 'h4', 'legend'])
        label = heading.get_text(' ', strip=True).lower() if heading else ''
        if re.search(r'\b(?:offered|available)\s+courses\b|\bcourse\s+offerings\b', label):
            target = 'offerings'
        elif re.search(r'\bregistered\s+courses\b|\bcourses?\s+registered\b', label):
            target = 'registeredCourses'
        elif table.get('id') == 'MainContent_GridView3':
            # This exact registered-course grid is supported by the original AMS
            # timetable adapter; its page uses a span instead of a heading.
            target = 'registeredCourses'
        else:
            continue
        for row, _, _ in _table_rows(table, mapping, {'courseCode', 'courseName'}):
            if _CODE.fullmatch(row['courseCode']) and row['courseName']:
                output[target].append(row)
                if sum(len(output[key]) for key in ('registeredCourses', 'offerings')) >= MAX_ROWS:
                    break
    for node in soup.select('[role="alert"], .alert-warning, .warning'):
        text = node.get_text(' ', strip=True)
        if text and len(text) <= 1000 and text not in output['warnings']:
            output['warnings'].append(text)
        if len(output['warnings']) >= 20:
            break
    return output


def parse_examination_rows(html):
    output = []
    mapping = {'examname': 'name', 'examination': 'name', 'examinationname': 'name',
               'exam': 'name', 'coursename': 'name', 'subjectname': 'name',
               'examdate': 'date', 'examinationdate': 'date', 'date': 'date',
               'time': 'time', 'examtime': 'time', 'session': 'time', 'room': 'room',
               'venue': 'room', 'coursecode': 'courseCode', 'subjectcode': 'courseCode', 'status': 'status'}
    for table in BeautifulSoup(html, 'html.parser').find_all('table'):
        for row, _, _ in _table_rows(table, mapping, {'name', 'date'}):
            if not row['name'] or not row['date']:
                continue
            _source_date(row)
            output.append(row)
            if len(output) >= MAX_ROWS:
                return output
    return output


async def collect_source_modules(session, adapter, *, on_progress=None):
    base = session.get('url') or adapter.BASE_URL
    html = session.get('dashboard_html', '')
    output = {'modules': [], 'fees': [], 'documents': [], 'files': [], 'examinations': [], 'registeredCourses': [],
              'offerings': [], 'warnings': [], 'notes': [],'credits':[],'creditSummary':[]}
    checker = getattr(adapter, '_looks_like_student_page', None)
    if (not session.get('client') or not html or len(html.encode('utf-8')) > MAX_PAGE_BYTES
            or not _same_origin(base) or _UNSAFE.search(unquote(urlsplit(base).path)) or _login_or_error(html, adapter) or (checker and not checker(html))):
        return output
    identifiers = session_identifiers(session)
    kinds = ('credits', 'fees', 'documents', 'examinations', 'course-registration')

    def parse(kind, body, url):
        if kind == 'credits':
            from app.services.ams.credits import parse_credit_details
            return parse_credit_details(body)
        if kind == 'course-registration':
            return parse_registration_page(body)
        parser = {'fees': parse_fee_rows, 'documents': parse_document_rows, 'examinations': parse_examination_rows}[kind]
        return {kind: parser(body) if kind == 'examinations' else parser(body, url, identifiers)}

    def append(parsed):
        for field, rows in parsed.items():
            for row in rows:
                if row not in output[field] and len(output[field]) < (20 if field == 'warnings' else MAX_ROWS):
                    output[field].append(row)

    def row_count(parsed):
        return sum(len(rows) for field, rows in parsed.items() if field != 'warnings')

    for kind in kinds:
        inline = parse(kind, html, base)
        append(inline)
        count = row_count(inline)
        if count:
            output['modules'].append({'url': base, 'kind': kind, 'status': 'available', 'layoutSupported': True,
                                      'rowCount': count, 'error': None, 'checkedAt': utc_now().isoformat(),
                                      'diagnostics': layout_diagnostics(html, count)})
    modules = [module for module in discover_academic_pages(html, base, identifiers, include_modules=True) if module['kind'] in kinds]
    fetched_modules = [{**module, 'layoutSupported': False, 'status': 'not-loaded'} for module in modules]
    output['modules'].extend(fetched_modules)
    if on_progress and any(output[field] for field in ('fees','documents','examinations','registeredCourses','offerings','credits','creditSummary')):
        on_progress(output)
    budget = [0]
    for module in fetched_modules:
        if budget[0] >= MAX_SOURCE_PAGES:
            break
        module['status'] = 'unavailable'
        module['checkedAt']=utc_now().isoformat()
        module['error']='Data not available: AMS page could not be loaded.'
        count = 0
        failure = None
        try:
            async for response in iter_module_views(session, module, adapter, budget, max_pages=MAX_SOURCE_PAGES):
                parsed = parse(module['kind'], response.text, str(response.url))
                append(parsed)
                accepted = row_count(parsed)
                count += accepted
                module['diagnostics'] = merge_diagnostics(module.get('diagnostics'), layout_diagnostics(response.text, accepted))
                if module['kind'] == 'course-registration':
                    module['registeredRowCount'] = module.get('registeredRowCount', 0) + len(parsed['registeredCourses'])
                    module['offeredRowCount'] = module.get('offeredRowCount', 0) + len(parsed['offerings'])
        except httpx.HTTPError:
            failure = 'error'
        except ValueError:
            failure = 'unavailable'
        module.update(layoutSupported=bool(count), rowCount=count,
                      status='available' if count else failure or 'unsupported',
                      error=None if count else 'Data not available: AMS page could not be loaded.' if failure
                      else 'Data not available: AMS page has no supported labeled rows.')
        if (not count and not failure and module['kind']=='fees'
                and urlsplit(module['url']).path=='/Payment.aspx'):
            module.update(status='unavailable',error='Data not available: AMS exposes a payment-entry form, not a fee statement or receipt history.')
        if on_progress:
            on_progress(output)
    output['notes'] = module_notes(output['modules'])
    await _cache_linked_files(output,session)
    return output


def store_source_modules(db, student_id, source):
    now = utc_now()
    metadata = {'sourceModules': source.get('modules', []), 'sourceModulesCheckedAt': now}
    # Empty/unknown layouts do not erase earlier successful or imported sections.
    for incoming, field in (('registeredCourses', 'courses'), ('offerings', 'offerings'), ('warnings', 'registrationWarnings')):
        if source.get(incoming):
            rows = source[incoming]
            metadata[field] = ([{**row, 'source': 'ams', 'sourceUpdatedAt': now.isoformat()} for row in rows]
                               if incoming != 'warnings' else rows)
            if incoming == 'registeredCourses':
                # Shared display courses may contain student imports. Only this
                # authenticated source reader can populate the audience cache.
                metadata['amsRegisteredCourses'] = metadata[field]
            metadata['registrationSourceUpdatedAt'] = now
    db.timetable_metadata.update_one({'studentId': student_id}, {'$set': metadata}, upsert=True)
    updates = {}
    for field in ('fees', 'examinations','documents','credits','creditSummary'):
        if source.get(field):
            updates[field] = [{**row, 'source': 'ams', 'sourceUpdatedAt': now.isoformat()} for row in source[field]][:MAX_ROWS]
    if updates:
        db.users.update_one({'_id': ObjectId(student_id)}, {'$set': updates})
    for file in source.get('files',[])[:MAX_FILES]:
        if not isinstance(file.get('content'),bytes) or len(file['content'])>MAX_FILE_BYTES:continue
        db.ams_documents.update_one({'studentId':student_id,'_id':ObjectId(file['id'])},{'$set':{
            'content':file['content'],'byteLength':len(file['content']),'contentType':file['contentType'],'name':file['name'],'sourceUpdatedAt':now}},upsert=True)
    # Keep only files still associated with the retained owner-visible source rows.
    user=db.users.find_one({'_id':ObjectId(student_id)}) or {}
    references=[ObjectId(row['downloadId']) for field in ('fees','documents') for row in user.get(field,[])
                if isinstance(row,dict) and ObjectId.is_valid(row.get('downloadId',''))]
    db.ams_documents.delete_many({'studentId':student_id,'_id':{'$nin':references}})
    latest=[row['_id'] for row in db.ams_documents.find({'studentId':student_id},{'_id':1}).sort('sourceUpdatedAt',-1).limit(MAX_CACHED_FILES)]
    db.ams_documents.delete_many({'studentId':student_id,'_id':{'$nin':latest}})
