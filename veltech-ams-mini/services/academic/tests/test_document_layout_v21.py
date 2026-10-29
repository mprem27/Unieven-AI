"""Bounded deidentified layout fixtures; no live source route assumptions."""
import unittest
from app.services.ams.source_modules import parse_document_rows
class DocumentLayouts(unittest.TestCase):
 def test_grouped_circular_headers_and_file_anchor_in_title_preserve_source_fields(self):
  html='''<h2>Academic circulars</h2><table><tr><th rowspan="2">Circular Title</th><th colspan="2">Publication</th><th rowspan="2">Category</th></tr><tr><th>Reference No.</th><th>Published Date</th></tr><tr><td><a href="/files/circular.pdf">Semester circular</a></td><td>AC/2026/4</td><td>2026-10-23</td><td>Academic</td></tr></table>'''
  self.assertEqual(parse_document_rows(html,'https://ams.veltech.edu.in/Circulars.aspx'),[{'name':'Semester circular','reference':'AC/2026/4','date':'2026-10-23','type':'Academic','url':'https://ams.veltech.edu.in/files/circular.pdf'}])
 def test_course_and_generic_description_tables_are_not_invented_as_documents(self):
  self.assertEqual(parse_document_rows('<h2>Registered courses</h2><table><tr><th>Course Name</th><th>Credits</th></tr><tr><td>Computing</td><td>3</td></tr></table>'),[])
  self.assertEqual(parse_document_rows('<table><tr><th>Description</th></tr><tr><td>Unrelated page prose</td></tr></table>'),[])
 def test_title_anchors_fail_closed_for_multiple_foreign_and_action_links(self):
  for anchor in ['<a href="/files/a.pdf">A</a><a href="/files/b.pdf">B</a>','<a href="https://evil.example/a.pdf">A</a>','<a href="/Document.aspx?studentId=other">A</a>','<a href="/files/a.pdf" onclick="changeOwner()">A</a>']:
   rows=parse_document_rows('<h2>Documents</h2><table><tr><th>Title</th><th>Category</th></tr><tr><td>'+anchor+'</td><td>Academic</td></tr></table>','https://ams.veltech.edu.in/Documents.aspx',['mine'])
   self.assertEqual(len(rows),1)
   self.assertNotIn('url',rows[0])
