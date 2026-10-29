import unittest
from app.college.parser import parse_ams_profile

class CampusProfileTests(unittest.TestCase):
    def test_mentor_is_parsed_only_when_the_portal_provides_it(self):
        result=parse_ams_profile('<span id="MainContent_lblMentorName">Dr. Test Mentor</span>')
        self.assertEqual(result.get('mentorName'),'Dr. Test Mentor')
        self.assertNotIn('mentorName',parse_ams_profile('<p>No mentor provided</p>'))

if __name__=='__main__': unittest.main()

class CampusIsolationTests(unittest.TestCase):
    def test_course_response_does_not_include_another_students_course(self):
        from pymongo import MongoClient
        from app.routes.subjects import list_subjects
        client=MongoClient('mongodb://127.0.0.1:27017')
        db=client['campus_test_python']
        try:
            db.subjects.insert_many([{'name':'My course','code':'MY','studentId':'me','active':True},{'name':'Other course','code':'OTHER','studentId':'other','active':True}])
            result=list_subjects(_current_user={'id':'me'},db=db)
            self.assertEqual([r['code'] for r in result],['MY'])
        finally:
            client.drop_database(db.name);client.close()
    def test_campus_snapshot_never_returns_passwords_or_portal_credentials(self):
        from pymongo import MongoClient
        from app.routes.campus import snapshot
        client=MongoClient('mongodb://127.0.0.1:27017')
        db=client['campus_test_python_snapshot']
        try:
            result=snapshot(current_user={'id':'me','name':'Student','mentorName':'Advisor','passwordHash':'secret','portalPasswordEncrypted':'secret'},db=db)
            self.assertEqual(result['profile']['mentorName'],'Advisor')
            self.assertNotIn('passwordHash',result['profile']);self.assertNotIn('portalPasswordEncrypted',result['profile'])
        finally:
            client.drop_database(db.name);client.close()
