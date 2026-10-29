"""Explicit source credit ledgers, totals and published grade definitions."""
import re
from bs4 import BeautifulSoup
from app.services.ams.labeled_tables import labeled_rows,own_cells,own_rows,normalized
_MAPPING={'coursecode':'courseCode','subjectcode':'courseCode','coursename':'courseName','subjectname':'courseName','semester':'semester','sem':'semester','credit':'credits','credits':'credits','coursecredits':'credits','registeredcredits':'credits','creditregistered':'credits','creditearned':'earnedCredits','creditsearned':'earnedCredits','earnedcredits':'earnedCredits','creditpoints':'creditPoints','creditpoint':'creditPoints','grade':'grade','gradepoints':'gradePoints','gradepoint':'gradePoints','category':'category','bucket':'category','minimumcredits':'requiredCredits','requiredcredits':'requiredCredits','creditrequired':'requiredCredits','status':'status'}
def parse_grade_scale(html):
 soup=BeautifulSoup(html or '','html.parser');rows=[]
 for node in soup.select('.grade-list,.grade-block,.legend-section'):
  container=node.find_parent(class_='legend-section') or node
  if not re.search(r'grade\s*points?',container.get_text(' ',strip=True),re.I):continue
  for grade,point in re.findall(r'\b([A-Z]{1,3}[+-]?)\s*[:=–-]\s*(\d{1,2}(?:\.\d+)?)(?![\d.]|\s*(?:[%–-]|to\b))\b',node.get_text(' ',strip=True)):
   row={'grade':grade,'points':float(point)}
   if row not in rows:rows.append(row)
 for table in soup.find_all('table'):
  for row,_,_ in labeled_rows(table,{'grade':'grade','gradepoints':'points','gradepoint':'points'},{'grade','points'}):
   if re.fullmatch(r'[A-Z]{1,3}[+-]?',row['grade']) and re.fullmatch(r'\d{1,2}(?:\.\d+)?',row['points']):
    item={'grade':row['grade'],'points':float(row['points'])}
    if item not in rows:rows.append(item)
 return rows[:50]
def parse_credit_details(html):
 soup=BeautifulSoup(html or '','html.parser');rows=[];summary=[]
 for table in soup.find_all('table'):
  heading=table.find('caption',recursive=False) or table.find_previous(['h1','h2','h3','h4','legend'])
  report=heading.get_text(' ',strip=True) if heading else ''
  if len(report)>120 or not re.search(r'\b(?:credit|credits|ledger|curriculum|category|bucket|semester|course)\b',report,re.I):report=''
  for required in ({'courseCode'},{'category','earnedCredits'},{'semester','earnedCredits'}):
   for row,_,columns in labeled_rows(table,_MAPPING,required):
    if not any(row.get(field) for field in ('credits','earnedCredits','requiredCredits','creditPoints')):continue
    if row.get('courseCode') and not re.fullmatch(r'[A-Za-z0-9._/-]{2,40}',row['courseCode']):continue
    row['rowType']='course' if row.get('courseCode') else 'category' if row.get('category') else 'semester'
    if report:row['sourceReport']=report
    # Preserve exact inspected header wording and order, without inferring values.
    source_columns={}
    for header in own_rows(table):
     cells=own_cells(header)
     if not cells or not all(c.name=='th' for c in cells):continue
     for field,index in sorted(columns.items(),key=lambda item:item[1]):
      if index>=len(cells):continue
      label=cells[index].get_text(' ',strip=True)
      if _MAPPING.get(normalized(label))==field:source_columns[field]=label
    if source_columns:row['sourceColumns']=source_columns
    if row not in rows:rows.append(row)
  for tr in table.find_all('tr'):
   if tr.find_parent('table') is not table:continue
   cells=own_cells(tr)
   if len(cells)!=2:continue
   label,value=(c.get_text(' ',strip=True) for c in cells)
   summary_labels={'cgpa','overallcgpa','gpa','sgpa','totalcredits','creditsearned','registeredcredits','requiredcredits','cumulativegradepointaverage','percentage','overallpercentage','aggregatepercentage','cumulativepercentage'}
   if normalized(label) in summary_labels and re.fullmatch(r'\d+(?:\.\d+)?\s*%?',value):
    item={'label':label,'value':value}
    if item not in summary:summary.append(item)
 return {'credits':rows[:4000],'creditSummary':summary[:30]}
