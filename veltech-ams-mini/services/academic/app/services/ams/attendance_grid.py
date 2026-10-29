"""AMS date/hour grid and course-session summary, inspected October 2026.

Student Session is the completed denominator. Total Session is the planned
course load; Overall % measures progress and is not attendance percentage.
"""
import re
from datetime import datetime
from collections import defaultdict
from bs4 import BeautifulSoup
from app.services.ams.labeled_tables import labeled_rows, own_rows, own_cells

COURSE_CODE = re.compile(r'(?!TOTAL\Z|OVERALL\Z|SUMMARY\Z)(?:(?=.*[A-Za-z])(?=.*\d)[A-Za-z0-9][A-Za-z0-9._/-]{1,39}|[A-Z]{2,40})\Z')
# Header normalization removes the percent sign; "Present" and "Present %"
# therefore need explicit distinct aliases before passing to labeled_rows.


def parse_attendance_grid(soup):
    summaries = []
    identities = defaultdict(set)
    for table in soup.find_all('table'):
        # Work on a copy so generic readers and diagnostic headers are unchanged.
        copy = BeautifulSoup(str(table), 'html.parser').find('table')
        for th in copy.find_all('th'):
            if th.find_parent('table') is copy and th.get_text(' ', strip=True) == 'Present %':
                th.string = 'Present percentage'
        mapping = {'course':'course','totalsession':'planned','facultysession':'faculty',
                   'studentsession':'total','present':'present','absent':'absent',
                   'presentpercentage':'percentage','overall':'overall','status':'status'}
        for row, cells, columns in labeled_rows(copy, mapping, {'course','total','present','absent','percentage'}):
            cell = cells[columns['course']]
            code_nodes, name_nodes = cell.select('div.code'), cell.select('div.name')
            if len(code_nodes) != 1 or len(name_nodes) != 1:
                continue
            code, name = code_nodes[0].get_text(' ', strip=True), name_nodes[0].get_text(' ', strip=True)
            if not COURSE_CODE.fullmatch(code) or not name:
                continue
            if not all(re.fullmatch(r'\d{1,9}', row[key]) for key in ('total','present','absent')):
                continue
            total, present, absent = (int(row[key]) for key in ('total','present','absent'))
            if present + absent != total or not re.fullmatch(r'\d{1,3}(?:\.\d+)?\s*%?',row['percentage']):
                continue
            percentage = float(row['percentage'].rstrip('%').strip())
            expected = present * 100 / total if total else 0
            if not 0 <= percentage <= 100 or abs(percentage - expected) > .51:
                continue
            summaries.append({'subjectCode':code,'subjectName':name,'totalCount':total,
                              'presentCount':present,'percentage':percentage})
            identities[code].add(name)
    names = {code: next(iter(values)) for code, values in identities.items() if len(values) == 1}
    records = []
    for table in soup.find_all('table'):
        rows = own_rows(table)
        if not rows:
            continue
        headers = own_cells(rows[0])
        labels = [cell.get_text(' ', strip=True) for cell in headers]
        if (not 2 <= len(headers) <= 21 or not all(cell.name == 'th' for cell in headers)
                or labels[0] != 'Date' or labels[1:] != [f'HR {n}' for n in range(1,len(headers))]):
            continue
        for row in rows[1:4001]:
            cells = own_cells(row)
            if len(cells) != len(headers) or 'date-column' not in cells[0].get('class',[]):
                continue
            try:
                # Verified on this particular date/hour layout, not guessed for
                # unrelated tables with ambiguous numeric dates.
                date = datetime.strptime(cells[0].get_text(strip=True),'%d-%m-%Y').date().isoformat()
            except ValueError:
                continue
            for period, cell in enumerate(cells[1:],1):
                mark = re.fullmatch(r'([A-Za-z0-9._/-]{2,40})\s*\((P|A|OD)\)',cell.get_text(' ',strip=True))
                if not mark or mark[1] not in names or cell.find('table'):
                    continue
                status = {'P':'present','A':'absent','OD':'on-duty'}[mark[2]]
                classes = set(cell.get('class',[]))
                if status not in classes or classes & {'present','absent','on-duty','no-class'} != {status}:
                    continue
                records.append({'subjectCode':mark[1],'subjectName':names[mark[1]],'date':date,
                                'period':str(period),'status':status})
                if len(records) >= 4000:
                    return {'summary':summaries,'records':records}
    return {'summary':summaries,'records':records}
