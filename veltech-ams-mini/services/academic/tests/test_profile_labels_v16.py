import unittest
from app.college.parser import parse_ams_profile
class ProfileLabelTests(unittest.TestCase):
 def test_explicit_dashboard_identity_labels_fill_fields_missing_from_known_ids(self):
  html='''<table><tr><td>Student Name</td><td>Fictional Student</td></tr><tr><td>Section</td><td>C</td></tr><tr><td>Academic Year</td><td>2026–2027</td></tr><tr><td>Year</td><td>III</td></tr><tr><td>Mentor Name</td><td>Fictional Mentor</td></tr><tr><td>College Email</td><td>vt&#x75;00000@veltech.edu.in</td></tr></table>'''
  profile=parse_ams_profile(html)
  self.assertEqual(profile['section'],'C');self.assertEqual(profile['mentorName'],'Fictional Mentor')
  self.assertEqual(profile['amsEmail'],'vtu00000@veltech.edu.in');self.assertEqual(profile['academicYear'],'2026–2027')
 def test_known_source_ids_keep_priority_and_unknown_or_form_fields_are_not_copied(self):
  profile=parse_ams_profile('''<span id="MainContent_lblStuname">Source Student</span><table><tr><td>Student Name</td><td>Other label</td></tr><tr><td>Password</td><td>Never include</td></tr><tr><td>Unknown official field</td><td>Unknown</td></tr></table>''')
  self.assertEqual(profile,{'name':'Source Student'})

 def test_normalization_keeps_canonical_college_email_and_academic_year_separate(self):
  from app.services.student_service import StudentService
  normalized=StudentService(None)._normalize_ams_profile({'amsEmail':'vtu00000@veltech.edu.in','year':'III','academicYear':'2026–2027'})
  self.assertEqual(normalized['amsEmail'],'vtu00000@veltech.edu.in');self.assertEqual(normalized['year'],'III');self.assertEqual(normalized['academicYear'],'2026–2027')
