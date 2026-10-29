"""Bounded local schedule extraction; every result remains a staff-reviewed draft.

PDF positions are used to recover columns and centered, merged date/session cells.
Those assignments are explicitly flagged for review; OCR characters are never fixed.
"""
import csv
import io
import json
import math
import re
import statistics
import zipfile
from datetime import date, datetime, time
from xml.etree import ElementTree

MAX_BYTES = 8 * 1024 * 1024
MAX_ROWS = 500
MAX_LINES = MAX_ROWS + 101
MAX_COLUMNS = 40
MAX_TEXT = 500_000
FIELDS = {
    'courseCode': {'coursecode', 'subjectcode', 'code', 'papercode'},
    'courseName': {'coursename', 'coursetitle', 'subjectname', 'subjecttitle', 'papername'},
    'date': {'date', 'examdate', 'examinationdate', 'testdate', 'datedayof', 'datedayoftest'},
    'startTime': {'starttime', 'examstarttime', 'start', 'from', 'fromtime'},
    'endTime': {'endtime', 'examendtime', 'end', 'to', 'totime'},
    'timeRange': {'time', 'timing', 'examtime', 'timeofexam'},
    'session': {'session'},
    'department': {'department', 'dept', 'branch'},
    'semester': {'semester', 'sem'},
    'section': {'section'},
    'room': {'room', 'roomno', 'roomnumber', 'venue'},
}
DATE_PATTERN = re.compile(r'\b(?:\d{4}[-/.]\d{1,2}[-/.]\d{1,2}|\d{1,2}[-/.]\d{1,2}[-/.]\d{4})\b')
TIME_PATTERN = r'\d{1,2}(?:[:.]\d{2})(?:\s*[ap]\.?m\.?)?'
TIME_RANGE = re.compile(rf'({TIME_PATTERN})\s*(?:to|[-–—])\s*({TIME_PATTERN})', re.I)
WEEKDAY = re.compile(r'^(?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)$', re.I)


def _heading(value):
    return re.sub(r'[^a-z0-9]', '', str(value or '').lower())


def _cell(value):
    text = str(value if value is not None else '').strip()
    if len(text) > 500 or '\x00' in text or text.startswith(('=', '+', '-', '@')):
        raise ValueError('A schedule cell is too long or contains a spreadsheet formula.')
    return text


def _warn(warnings, message):
    if message not in warnings and len(warnings) < 40:
        warnings.append(message)


def _date(value):
    if isinstance(value, (date, datetime)):
        return value.date().isoformat() if isinstance(value, datetime) else value.isoformat()
    text = _cell(value).strip().rstrip('/')
    for pattern in ('%Y-%m-%d', '%Y/%m/%d', '%Y.%m.%d', '%d.%m.%Y', '%d-%m-%Y', '%d/%m/%Y'):
        try:
            return datetime.strptime(text, pattern).date().isoformat()
        except ValueError:
            pass
    return ''


def _time(value):
    if isinstance(value, (datetime, time)):
        return value.strftime('%H:%M')
    text = re.sub(r'\s+', '', _cell(value).lower()).replace('.', ':')
    text = text.replace('a:m:', 'am').replace('p:m:', 'pm')
    for pattern in ('%H:%M', '%H:%M:%S', '%I:%M%p'):
        try:
            return datetime.strptime(text, pattern).strftime('%H:%M')
        except ValueError:
            pass
    return ''


def _range(value):
    match = TIME_RANGE.search(_cell(value))
    return (_time(match[1]), _time(match[2])) if match else ('', '')


def _headers(line):
    result = {}
    for position, value in enumerate(line):
        label = _heading(value)
        for field, aliases in FIELDS.items():
            if label in aliases:
                if field in result:
                    raise ValueError('The table has ambiguous duplicate column labels.')
                result[field] = position
    return result


def _record(raw, label, warnings):
    row = {field: _cell(raw.get(field, '')) for field in ('courseCode', 'courseName')}
    row['date'] = _date(raw.get('date', ''))
    start, end = _range(raw.get('timeRange', ''))
    row['startTime'] = _time(raw.get('startTime', '')) or start
    row['endTime'] = _time(raw.get('endTime', '')) or end
    for field in ('department', 'semester', 'section', 'room'):
        if _cell(raw.get(field, '')):
            row[field] = _cell(raw[field])
    code = row['courseCode']
    if not re.search(r'[A-Za-z]', code) or not re.search(r'\d', code) or (
        re.match(r'^[0-9JIOl]{4,}', code) and not re.fullmatch(r'\d{5}[A-Z]{2}\d{3}', code)
    ):
        _warn(warnings, f'{label}: verify the course code "{code}" against the original; it was not corrected.')
    if not row['courseName']:
        _warn(warnings, f'{label}: enter the missing course title.')
    if not row['date']:
        _warn(warnings, f'{label}: enter a valid examination date; dates are never copied from an unrelated row.')
    if not row['startTime'] or not row['endTime']:
        _warn(warnings, f'{label}: enter explicit start and end times; session names alone do not define a time.')
    elif row['endTime'] <= row['startTime']:
        _warn(warnings, f'{label}: the end time must be after the start time.')
    return row


def _table(lines, warnings, merged=None):
    mapping = None
    rows = []
    title = None
    merged = merged or {}
    for index, values in enumerate(lines, start=1):
        if index > MAX_LINES or len(values) > MAX_COLUMNS:
            raise ValueError('Use at most 500 schedule rows and 40 columns.')
        line = [_cell(value) for value in values]
        if not any(line):
            continue
        headers = _headers(line)
        if 'courseCode' in headers and 'courseName' in headers:
            mapping = headers
            continue
        if mapping is None:
            if len([value for value in line if value]) == 1 and re.search(r'\b(schedule|timetable)\b', ' '.join(line), re.I):
                title = next(value for value in line if value)[:240]
            continue
        raw = {}
        for field, position in mapping.items():
            raw[field] = values[position] if position < len(values) else ''
            if not _cell(raw[field]) and field not in {'courseCode', 'courseName'}:
                raw[field] = merged.get((index, position + 1), '')
        if not _cell(raw.get('courseCode')):
            _warn(warnings, f'Row {index}: no course code was found; this row was not imported.')
            continue
        rows.append(_record(raw, f'Row {index}', warnings))
        if len(rows) > MAX_ROWS:
            raise ValueError('Use at most 500 schedule rows.')
    if mapping is None:
        _warn(warnings, 'No supported Course Code / Course Title header was found. Enter the schedule in the review table.')
    return rows, title


def _xlsx(content, warnings):
    from openpyxl import load_workbook
    from openpyxl.utils.cell import coordinate_from_string, column_index_from_string, range_boundaries

    merges = []
    with zipfile.ZipFile(io.BytesIO(content)) as archive:
        files = archive.infolist()
        if len(files) > 3000 or sum(item.file_size for item in files) > 64 * 1024 * 1024 or any(item.file_size > 24 * 1024 * 1024 for item in files):
            raise ValueError('The spreadsheet expands beyond the import limit.')
        if len({item.filename for item in files}) != len(files):
            raise ValueError('Duplicate spreadsheet archive entries are not supported.')
        for item in files:
            name = item.filename.lower()
            if 'vbaproject' in name or name.startswith('xl/externallinks/') or name.startswith('xl/embeddings/'):
                raise ValueError('Macros, embedded files and external workbook links are not supported.')
            if not name.endswith(('.xml', '.rels')):
                continue
            data = archive.read(item)
            # XML may use UTF-16/32; ASCII-only scans miss those declarations.
            if re.search(br'<!\s*(?:DOCTYPE|ENTITY)\b', data.replace(b'\x00', b''), re.I):
                raise ValueError('XML document types and entities are not supported.')
            for _, element in ElementTree.iterparse(io.BytesIO(data), events=('end',)):
                tag = element.tag.rsplit('}', 1)[-1]
                if tag == 'Relationship' and element.get('TargetMode', '').lower() == 'external':
                    raise ValueError('External spreadsheet relationships are not supported.')
                if name.startswith('xl/worksheets/'):
                    if tag == 'row' and int(element.get('r', '0')) > MAX_LINES:
                        raise ValueError('Use at most 500 schedule rows.')
                    if tag == 'c':
                        column, row = coordinate_from_string(element.get('r', 'A1'))
                        if column_index_from_string(column) > MAX_COLUMNS or row > MAX_LINES:
                            raise ValueError('Use at most 500 schedule rows and 40 columns.')
                    if tag == 'f':
                        raise ValueError('Replace formulas with plain schedule values.')
                    if tag == 'mergeCell':
                        bounds = range_boundaries(element.get('ref', ''))
                        if not all(isinstance(value, int) for value in bounds) or bounds[2] > MAX_COLUMNS or bounds[3] > MAX_LINES:
                            raise ValueError('A merged cell exceeds the schedule import limit.')
                        merges.append(bounds)
                        if len(merges) > MAX_ROWS:
                            raise ValueError('Too many merged schedule cells.')
                element.clear()
    book = load_workbook(io.BytesIO(content), read_only=True, data_only=False, keep_links=False)
    try:
        if len(book.worksheets) != 1:
            raise ValueError('Use one schedule worksheet per upload.')
        sheet = book.worksheets[0]
        if (sheet.max_column or 0) > MAX_COLUMNS or (sheet.max_row or 0) > MAX_LINES:
            raise ValueError('Use at most 500 schedule rows and 40 columns.')
        lines = []
        for row in sheet.iter_rows(max_row=sheet.max_row or MAX_LINES, max_col=sheet.max_column or MAX_COLUMNS):
            values = []
            for cell in row:
                if cell.data_type == 'f':
                    raise ValueError('Replace formulas with plain schedule values.')
                values.append(cell.value)
            lines.append(values)
            if len(lines) > MAX_LINES:
                raise ValueError('Use at most 500 schedule rows.')
    finally:
        book.close()
    merged = {}
    for left, top, right, bottom in merges:
        value = lines[top - 1][left - 1] if top <= len(lines) and left <= len(lines[top - 1]) else ''
        for row in range(top, bottom + 1):
            for column in range(left, right + 1):
                merged[(row, column)] = value
                if len(merged) > MAX_LINES * MAX_COLUMNS:
                    raise ValueError('Merged cells exceed the schedule import limit.')
    if merges:
        _warn(warnings, 'Explicit merged spreadsheet date/audience cells were expanded; verify each affected row.')
    return _table(lines, warnings, merged)


def _centered_groups(row_positions, labels):
    """Partition consecutive PDF rows by centered date labels, with a hard work cap.

    A label in a merged cell belongs to its entire contiguous row span. Nearest
    label matching alone is wrong at the edges of differently sized merged cells.
    Reject weak fits instead of assigning dates to unsupported layouts.
    """
    count, groups = len(row_positions), len(labels)
    if not count or not groups or groups > count or count * count * groups > 2_000_000:
        return None
    gaps = [a - b for a, b in zip(row_positions, row_positions[1:]) if a > b]
    tolerance = max(5, statistics.median(gaps) * 0.45) if gaps else 12
    previous = {0: (0.0, [])}
    for number, label in enumerate(labels):
        current = {}
        remaining = groups - number - 1
        for start, (cost, spans) in previous.items():
            for end in range(start + 1, count - remaining + 1):
                center = (row_positions[start] + row_positions[end - 1]) / 2
                error = abs(center - label['y'])
                if error > tolerance:
                    continue
                candidate = (cost + error * error, spans + [(start, end)])
                if end not in current or candidate[0] < current[end][0]:
                    current[end] = candidate
        previous = current
    return previous[count][1] if count in previous else None


def _positioned_page(tokens, session_times, warnings, page_number):
    headers = {}
    for token in tokens:
        label = _heading(token['text'])
        for field, aliases in FIELDS.items():
            if label in aliases and field not in headers:
                headers[field] = token
    if not all(field in headers for field in ('courseCode', 'courseName')):
        return []
    code_header, name_header = headers['courseCode'], headers['courseName']
    if name_header['x'] <= code_header['x']:
        _warn(warnings, f'PDF page {page_number}: unsupported column layout; enter these rows manually.')
        return []
    gap = name_header['x'] - code_header['x']
    code_left, code_right = code_header['x'] - gap * 0.55, (code_header['x'] + name_header['x']) / 2
    header_y = min(code_header['y'], name_header['y'])
    codes = []
    for token in tokens:
        text = re.sub(r'^\d{1,4}\.\s+(?=[A-Za-z0-9])', '', token['text'])
        if code_left <= token['x'] < code_right and token['y'] < header_y - 4 and re.search(r'[A-Za-z]', text) and re.search(r'\d', text) and len(text) <= 40:
            codes.append({**token, 'text': text})
    codes.sort(key=lambda value: -value['y'])
    if len(codes) > MAX_ROWS:
        raise ValueError('Use at most 500 schedule rows.')
    if not codes:
        return []
    table_bottom = codes[-1]['y'] - max(15, codes[-1]['height'] * 1.8)
    date_header = headers.get('date')
    name_right = (name_header['x'] + date_header['x']) / 2 if date_header else name_header['x'] + gap * 2
    title_tokens = [token for token in tokens if name_header['x'] - gap * 0.15 <= token['x'] < name_right and table_bottom <= token['y'] < header_y - 4]
    names = [[] for _ in codes]
    for token in sorted(title_tokens, key=lambda value: (-value['y'], value['x'])):
        # Wrapped text remains in the preceding course cell. Small baseline skew
        # is common in OCR and is bounded by the extracted font height.
        choices = [index for index, code in enumerate(codes) if code['y'] >= token['y'] - max(3, token['height'] * 0.65)]
        if choices:
            names[choices[-1]].append(token['text'])
    labels = []
    if date_header:
        date_left = (name_header['x'] + date_header['x']) / 2
        next_columns = [token['x'] for field, token in headers.items() if field not in {'courseCode', 'courseName', 'date'} and token['x'] > date_header['x']]
        date_right = (date_header['x'] + min(next_columns)) / 2 if next_columns else date_header['x'] + gap
        date_tokens = [token for token in tokens if date_left <= token['x'] < date_right and table_bottom <= token['y'] < header_y - 4]
        for token in date_tokens:
            match = DATE_PATTERN.search(token['text'])
            if not match:
                continue
            parsed = _date(match[0])
            if not parsed:
                continue
            weekdays = [item for item in date_tokens if WEEKDAY.fullmatch(item['text']) and 0 <= token['y'] - item['y'] <= max(18, token['height'] * 1.8)]
            center = (token['y'] + max(weekdays, key=lambda item: item['y'])['y']) / 2 if weekdays else token['y']
            labels.append({'y': center, 'date': parsed})
    labels.sort(key=lambda value: -value['y'])
    spans = _centered_groups([code['y'] for code in codes], labels)
    dates = [''] * len(codes)
    sessions = [''] * len(codes)
    if spans:
        for label, (start, end) in zip(labels, spans):
            for index in range(start, end):
                dates[index] = label['date']
            session_header = headers.get('session')
            if session_header:
                choices = [token for token in tokens if abs(token['x'] - session_header['x']) < gap * 0.6 and token['text'].upper() in {'AN', 'FN'} and abs(token['y'] - label['y']) < max(18, token['height'] * 2)]
                if len(choices) == 1:
                    for index in range(start, end):
                        sessions[index] = choices[0]['text'].upper()
        if any(end - start > 1 for start, end in spans):
            _warn(warnings, 'Centered merged PDF dates and sessions were assigned by table position; compare every row with the original before publishing.')
    else:
        _warn(warnings, f'PDF page {page_number}: dates could not be assigned confidently to rows; enter them in the review table.')
    rows = []
    for index, code in enumerate(codes):
        raw = {'courseCode': code['text'], 'courseName': ' '.join(names[index]), 'date': dates[index]}
        if sessions[index] in session_times:
            raw['startTime'], raw['endTime'] = session_times[sessions[index]]
        for field in ('startTime', 'endTime', 'timeRange', 'department', 'semester', 'section', 'room'):
            if field not in headers:
                continue
            column = headers[field]
            candidates = [token for token in tokens if abs(token['x'] - column['x']) < gap * 0.4 and abs(token['y'] - code['y']) < max(5, token['height'] * 0.65) and token['y'] < header_y - 4]
            if len(candidates) == 1:
                raw[field] = candidates[0]['text']
        rows.append(_record(raw, f'PDF page {page_number}, row {index + 1}', warnings))
    return rows


def _pdf(content, warnings):
    from pypdf import PdfReader, apply_configuration
    from pypdf.generic import ArrayObject, DictionaryObject, IndirectObject, StreamObject

    if not content.startswith(b'%PDF-'):
        raise ValueError('The uploaded PDF does not match its format.')
    with apply_configuration(
        maximum_declared_stream_length=8 * 1024 * 1024,
        zlib_maximum_output_length=8 * 1024 * 1024,
        array_based_stream_maximum_output_length=8 * 1024 * 1024,
        lzw_maximum_output_length=8 * 1024 * 1024,
        run_length_maximum_output_length=8 * 1024 * 1024,
        stream_decoding_work_maximum_length=24 * 1024 * 1024,
        stream_parsing_work_maximum_count=250_000,
        page_tree_maximum_entries=2000,
        xform_maximum_invocations_per_extraction=500,
    ):
        reader = PdfReader(io.BytesIO(content), strict=True)
        if reader.is_encrypted:
            raise ValueError('Encrypted PDFs are not supported.')
        if len(reader.pages) > 30:
            raise ValueError('Use a PDF with at most 30 pages.')
        objects = [reader.trailer]
        visited = set()
        stream_bytes = 0
        while objects:
            item = objects.pop()
            if isinstance(item, IndirectObject):
                identity = (item.idnum, item.generation)
                if identity in visited:
                    continue
                visited.add(identity)
                item = item.get_object()
            else:
                identity = id(item)
                if identity in visited:
                    continue
                visited.add(identity)
            if len(visited) > 20_000:
                raise ValueError('This PDF is too complex to import safely.')
            if isinstance(item, DictionaryObject):
                if '/EF' in item:
                    # Adobe Scan stores a tiny capture descriptor as a private
                    # associated file. Accept only that inert, exact schema.
                    reference = item['/EF']
                    permitted = str(item.get('/AFRelationship')) == '/ADBE_Contact_Private' and str(item.get('/F')) == 'pageEntities.json' and set(reference) == {'/F'}
                    if permitted:
                        descriptor = reference['/F']
                        permitted = isinstance(descriptor, StreamObject) and str(descriptor.get('/Subtype')) == '/application/json'
                    if permitted:
                        payload = descriptor.get_data()
                        permitted = len(payload) <= 256
                    if permitted:
                        metadata = json.loads(payload)
                        permitted = isinstance(metadata, dict) and set(metadata) == {'type', 'isBackSide'} and metadata['type'] in {'Document', 'Form'} and isinstance(metadata['isBackSide'], bool)
                    if not permitted:
                        raise ValueError('PDF embedded files are not supported.')
                if any(str(key) in {'/JS', '/JavaScript', '/EmbeddedFiles', '/Launch', '/RichMedia', '/XFA', '/OpenAction', '/AA'} for key in item) or str(item.get('/S')) in {'/JavaScript', '/Launch', '/SubmitForm', '/ImportData', '/GoToR', '/URI'}:
                    raise ValueError('PDF scripts, active actions and embedded files are not supported.')
                if isinstance(item, StreamObject) and str(item.get('/Subtype')) != '/Image':
                    stream_bytes += len(item.get_data())
                    if stream_bytes > 16 * 1024 * 1024:
                        raise ValueError('The PDF expands beyond the import limit.')
                objects.extend(value for key, value in item.items() if str(key) != '/Parent')
            elif isinstance(item, ArrayObject):
                objects.extend(item)
        pages = []
        total_text = 0
        session_times = {}
        title = None
        for page in reader.pages:
            tokens = []

            def visit(text, cm, tm, font, font_size):
                nonlocal total_text
                text = text.strip()
                if not text:
                    return
                total_text += len(text)
                if total_text > MAX_TEXT or len(tokens) >= 20_000:
                    raise ValueError('The PDF text is too large.')
                x = tm[4] * cm[0] + tm[5] * cm[2] + cm[4]
                y = tm[4] * cm[1] + tm[5] * cm[3] + cm[5]
                height = abs(font_size) * math.hypot(tm[2] * cm[0] + tm[3] * cm[2], tm[2] * cm[1] + tm[3] * cm[3])
                if not all(math.isfinite(value) for value in (x, y, height)):
                    raise ValueError('The PDF contains invalid text positions.')
                # Multiple rendered lines in one visitor chunk cannot be positioned
                # safely as separate cells. The plain table fallback handles those.
                tokens.append({'text': text, 'x': x, 'y': y, 'height': max(1, height)})

            plain = page.extract_text(visitor_text=visit) or ''
            pages.append((tokens, plain))
            for token in tokens:
                text = token['text']
                if not title and re.search(r'\b(schedule|timetable)\b', text, re.I) and not re.match(r'\s*(?:the schedule|note)', text, re.I):
                    title = _cell(text)[:240]
                match = re.search(r'\b(FN|AN)\s*:\s*(.+)', text, re.I)
                if match:
                    value = _range(match[2])
                    if all(value):
                        key = match[1].upper()
                        if key in session_times and session_times[key] != value:
                            raise ValueError('The PDF defines conflicting times for the same session; enter times manually.')
                        session_times[key] = value
        _warn(warnings, 'PDF text may contain OCR errors. Course codes and titles are preserved without character corrections; check the original document.')
        _warn(warnings, 'Confirm the visible examination heading and exam type against the original; OCR text and the filename may describe different tests.')
        rows = []
        for number, (tokens, plain) in enumerate(pages, start=1):
            extracted = _positioned_page(tokens, session_times, warnings, number)
            if not extracted:
                lines = [re.split(r'\s*\|\s*|\t+| {2,}', line.strip()) for line in plain.splitlines() if line.strip()]
                extracted, _ = _table(lines, warnings)
            rows.extend(extracted)
            if len(rows) > MAX_ROWS:
                raise ValueError('Use at most 500 schedule rows.')
        return rows, title


def parse_exam_schedule_file(filename, content):
    if not isinstance(content, bytes) or not content or len(content) > MAX_BYTES:
        raise ValueError('Upload one file between 1 byte and 8 MB.')
    extension = str(filename).lower().rsplit('.', 1)[-1]
    warnings = []
    try:
        if extension == 'csv':
            text = content.decode('utf-8-sig')
            if '\x00' in text:
                raise ValueError('Use a UTF-8 CSV file.')
            try:
                delimiter = csv.Sniffer().sniff(text[:8192], delimiters=',;\t').delimiter
            except csv.Error:
                delimiter = ','
            rows, title = _table(csv.reader(io.StringIO(text), delimiter=delimiter), warnings)
        elif extension == 'xlsx':
            rows, title = _xlsx(content, warnings)
        elif extension == 'pdf':
            rows, title = _pdf(content, warnings)
        else:
            raise ValueError('Upload a CSV, XLSX or text PDF examination schedule.')
        if not rows:
            _warn(warnings, 'No examination rows were extracted. Use the CSV template or enter rows manually before publishing.')
        result = {'rows': rows, 'warnings': warnings, 'requiresReview': True}
        if title:
            result['title'] = title
        return result
    except ValueError:
        raise
    except Exception as exc:
        raise ValueError('This file could not be parsed safely. Use the CSV template or enter rows manually.') from exc
