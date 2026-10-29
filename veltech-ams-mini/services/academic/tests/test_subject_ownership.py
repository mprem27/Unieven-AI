"""Student isolation tests against a disposable local Mongo database.

These tests deliberately never log in to either university portal.
"""
import unittest
from uuid import uuid4

from fastapi import HTTPException
from pymongo import MongoClient
from pymongo.errors import DuplicateKeyError

from app.config.database import Mongo
from app.routes.subjects import list_subjects
from app.schemas.attendance import IncomingAttendanceRecord
from app.services.attendance_service import AttendanceService
from app.scheduler.attendance_sync import AttendanceSyncRunner
from app.utils.dates import today_iso


class SubjectOwnershipTests(unittest.TestCase):
    def setUp(self):
        self.client = MongoClient("mongodb://127.0.0.1:27017", serverSelectionTimeoutMS=2000)
        self.db = self.client[f"campus_subject_test_{uuid4().hex}"]
        self.service = AttendanceService(self.db)

    def tearDown(self):
        self.client.drop_database(self.db.name)
        self.client.close()

    def insert_course(self, owner, name, code="CS101", active=True):
        document = {"name": name, "code": code, "active": active}
        if owner is not None:
            document["studentId"] = owner
        document["_id"] = self.db.subjects.insert_one(document).inserted_id
        return document

    def insert_attendance(self, student, course=None):
        document = {"studentId": student, "subjectName": "Recorded course", "subjectCode": "CS101",
                    "date": today_iso(), "status": "PRESENT"}
        if course:
            document["subjectId"] = str(course["_id"])
        self.db.attendance_records.insert_one(document)

    def test_owned_course_overrides_shared_catalog_in_subject_list(self):
        self.insert_course("me", "My class")
        self.insert_course(None, "Shared class")
        self.insert_course("other", "Other student's class", "OTHER")
        self.assertEqual([s["name"] for s in list_subjects({"id": "me"}, self.db)], ["My class"])

    def test_shared_catalog_remains_usable_without_an_owned_course(self):
        self.insert_course(None, "Shared class")
        self.assertEqual(list_subjects({"id": "me"}, self.db)[0]["name"], "Shared class")

    def test_attendance_reads_do_not_enrich_from_another_students_same_code(self):
        self.insert_attendance("me")
        self.insert_course("other", "Other student's private class")
        for records in (self.service.list_records("me"), self.service.list_today("me"), self.service.summary("me")):
            self.assertEqual(records[0]["subjectName"], "Recorded course")

    def test_foreign_inactive_course_cannot_hide_my_attendance(self):
        self.insert_attendance("me")
        self.insert_course("other", "Other student's old class", active=False)
        self.assertEqual(len(self.service.list_records("me")), 1)

    def test_owned_course_wins_over_shared_and_foreign_in_cache(self):
        self.insert_course("me", "My class")
        self.insert_course(None, "Shared class")
        self.insert_course("other", "Other student's private class")
        self.insert_attendance("me")
        self.assertEqual(self.service.list_records("me")[0]["subjectName"], "My class")

    def test_legacy_attendance_link_to_shared_catalog_prefers_my_course(self):
        shared = self.insert_course(None, "Shared class")
        self.insert_course("me", "My class")
        self.insert_attendance("me", shared)
        self.assertEqual(self.service.list_records("me")[0]["subjectName"], "My class")

    def test_subject_details_preserves_legacy_string_id_lookup(self):
        course = self.insert_course("me", "My class")
        self.db.subjects.update_one({"_id": course["_id"]}, {"$set": {"id": "legacy-course"}})
        try:
            result = self.service.subject_details("me", "legacy-course")
        except HTTPException:
            self.fail("A student's own legacy string course ID must remain resolvable")
        self.assertEqual(result["subjectName"], "My class")

    def test_admin_attendance_listing_resolves_each_students_own_course(self):
        self.insert_course("me", "My class")
        self.insert_course("other", "Other class")
        self.insert_attendance("me")
        self.insert_attendance("other")
        result = {r["studentId"]: r["subjectName"] for r in self.service.list_all_records()}
        self.assertEqual(result, {"me": "My class", "other": "Other class"})

    def test_subject_details_rejects_another_students_id(self):
        course = self.insert_course("other", "Other student's class")
        with self.assertRaises(HTTPException) as error:
            self.service.subject_details("me", str(course["_id"]))
        self.assertEqual(error.exception.status_code, 404)

    def test_subject_details_selects_my_course_when_codes_collide(self):
        self.insert_course("other", "Other class")
        course = self.insert_course("me", "My class")
        self.insert_attendance("me", course)
        self.assertEqual(self.service.subject_details("me", "CS101")["subjectName"], "My class")

    def test_sync_creates_owned_course_without_changing_shared_catalog(self):
        shared = self.insert_course(None, "Shared class")
        record = IncomingAttendanceRecord(subjectName="My portal class", subjectCode="CS101",
                                          date=today_iso(), status="PRESENT")
        result = self.service.sync_student_records("me", [record])
        self.assertEqual(result["recordsProcessed"], 1)
        owned = self.db.subjects.find_one({"studentId": "me", "code": "CS101"})
        self.assertIsNotNone(owned)
        self.assertEqual(owned["name"], "My portal class")
        self.assertEqual(self.db.subjects.find_one({"_id": shared["_id"]})["name"], "Shared class")

    def test_sync_migrates_legacy_attendance_without_counting_same_class_twice(self):
        shared = self.insert_course(None, "Shared class")
        self.insert_attendance("me", shared)
        record = IncomingAttendanceRecord(subjectName="My class", subjectCode="CS101",
                                          date=today_iso(), status="PRESENT")
        self.service.sync_student_records("me", [record])
        self.assertEqual(self.db.attendance_records.count_documents({"studentId": "me"}), 1)
        owned = self.db.subjects.find_one({"studentId": "me", "code": "CS101"})
        self.assertEqual(self.db.attendance_records.find_one({"studentId": "me"})["subjectId"], str(owned["_id"]))

    def test_sync_does_not_reuse_foreign_subject_id(self):
        foreign = self.insert_course("other", "Other class")
        record = IncomingAttendanceRecord(subjectId=str(foreign["_id"]), subjectName="My class",
                                          subjectCode="CS101", date=today_iso(), status="PRESENT")
        self.service.sync_student_records("me", [record])
        stored = self.db.attendance_records.find_one({"studentId": "me"})
        self.assertNotEqual(stored["subjectId"], str(foreign["_id"]))
        self.assertEqual(self.db.subjects.find_one({"_id": foreign["_id"]})["name"], "Other class")

    def test_sync_keeps_distinct_codes_even_when_course_names_are_equal(self):
        first = self.insert_course("me", "Seminar", "CS101")
        record = IncomingAttendanceRecord(subjectName="Seminar", subjectCode="CS102",
                                          date=today_iso(), status="PRESENT")
        self.service.sync_student_records("me", [record])
        self.assertEqual(self.db.subjects.count_documents({"studentId": "me"}), 2)
        self.assertEqual(self.db.subjects.find_one({"_id": first["_id"]})["code"], "CS101")
        self.assertEqual(self.db.attendance_records.find_one({"studentId": "me"})["subjectCode"], "CS102")

    def test_portal_subject_save_scopes_both_coded_and_uncoded_courses(self):
        runner = AttendanceSyncRunner(self.db)
        for owner, label in (("me", "My class"), ("other", "Other class")):
            self.assertEqual(runner._save_subjects(owner, {
                "coded": {"name": label, "code": "CS101"},
                "uncoded": {"name": "Seminar", "code": ""},
            }), 2)
        self.assertEqual(self.db.subjects.count_documents({"studentId": "me"}), 2)
        self.assertEqual(self.db.subjects.count_documents({"studentId": "other"}), 2)
        self.assertEqual(self.db.subjects.find_one({"studentId": "me", "code": "CS101"})["name"], "My class")

    def test_index_migration_allows_same_code_for_different_students(self):
        self.db.subjects.create_index("code", unique=True, sparse=True)
        catalog = self.insert_course(None, "Shared class")
        mongo = Mongo()
        mongo.db = self.db
        mongo.ensure_indexes()
        self.assertFalse(self.db.subjects.index_information().get("code_1", {}).get("unique", False))
        self.insert_course("me", "My class")
        self.insert_course("other", "Other class")
        self.assertIsNotNone(self.db.subjects.find_one({"_id": catalog["_id"]}))
        with self.assertRaises(DuplicateKeyError):
            self.insert_course("me", "Duplicate")


if __name__ == "__main__":
    unittest.main()
