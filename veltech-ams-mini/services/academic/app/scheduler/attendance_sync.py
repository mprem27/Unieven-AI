from __future__ import annotations

import asyncio
import re
from typing import Any

from bson import ObjectId
from pymongo.database import Database
from pymongo.errors import DuplicateKeyError

from app.models.attendance import ATTENDANCE_RECORDS
from app.models.subject import SUBJECTS
from app.models.sync_log import SYNC_LOGS

from app.schemas.attendance import IncomingAttendanceRecord

from app.services.attendance_service import AttendanceService
from app.services.base import serialize_document
from app.services.student_service import StudentService

from app.utils.dates import utc_now


class AttendanceSyncRunner:
    """
    Live AMS + Parent Portal synchronization.

    AMS:
        - Student profile
        - Student identity / roll number

    Parent Portal:
        - CURRENT subjects
        - CURRENT attendance

    Parent Portal is authoritative for attendance.
    """

    USERS_COLLECTION = "users"

    _student_locks: dict[str, asyncio.Lock] = {}

    def __init__(self, db: Database):
        self.db = db
        self.attendance_service = AttendanceService(db)
        self.student_service = StudentService(db)

    # =========================================================
    # LOCK
    # =========================================================

    @classmethod
    def _get_student_lock(
        cls,
        student_id: str,
    ) -> asyncio.Lock:

        if student_id not in cls._student_locks:
            cls._student_locks[student_id] = asyncio.Lock()

        return cls._student_locks[student_id]

    # =========================================================
    # SYNC ALL
    # =========================================================

    async def sync_all_students(self) -> dict:

        sync_log_id = self._start_log()

        students_processed = 0
        students_skipped = 0
        records_processed = 0
        changes_detected = 0
        notifications_created = 0
        errors_count = 0

        try:

            students = self.student_service.active_students()

            for student in students:

                if not self._has_portal_credentials(student):
                    students_skipped += 1
                    continue

                try:

                    result = await self._sync_student(
                        student
                    )

                    students_processed += 1

                    records_processed += int(
                        result.get(
                            "recordsProcessed",
                            0,
                        )
                        or 0
                    )

                    changes_detected += int(
                        result.get(
                            "changesDetected",
                            0,
                        )
                        or 0
                    )

                    notifications_created += int(
                        result.get(
                            "notificationsCreated",
                            0,
                        )
                        or 0
                    )

                    if result.get(
                        "attendanceFetchFailed",
                        False,
                    ):
                        errors_count += 1

                except Exception:
                    errors_count += 1

            if errors_count == 0:
                final_status = "SUCCESS"
            elif students_processed > 0:
                final_status = "PARTIAL"
            else:
                final_status = "FAILED"

            self._finish_log(
                sync_log_id=sync_log_id,
                status=final_status,
                students_processed=students_processed,
                records_processed=records_processed,
                changes_detected=changes_detected,
                errors_count=errors_count,
            )

            return {
                "success": errors_count == 0,
                "status": final_status,
                "studentsProcessed": students_processed,
                "studentsSkipped": students_skipped,
                "recordsProcessed": records_processed,
                "changesDetected": changes_detected,
                "notificationsCreated": notifications_created,
                "errorsCount": errors_count,
            }

        except Exception as exc:

            self._finish_log(
                sync_log_id=sync_log_id,
                status="FAILED",
                students_processed=students_processed,
                records_processed=records_processed,
                changes_detected=changes_detected,
                errors_count=errors_count + 1,
                error=str(exc),
            )

            raise

    # =========================================================
    # SYNC ONE STUDENT
    # =========================================================

    async def sync_single_student(
        self,
        student_id: str,
    ) -> dict:

        try:
            object_id = ObjectId(str(student_id))
        except Exception as exc:
            raise ValueError(
                "Invalid student ID."
            ) from exc

        student = self.db[
            self.USERS_COLLECTION
        ].find_one(
            {
                "_id": object_id,
                "role": "student",
                "active": True,
            }
        )

        if not student:
            raise ValueError(
                "Active student not found."
            )

        if not self._has_portal_credentials(student):
            return {
                "success": False,
                "studentsProcessed": 0,
                "studentsSkipped": 1,
                "recordsProcessed": 0,
                "changesDetected": 0,
                "notificationsCreated": 0,
                "errorsCount": 0,
                "attendanceFetched": 0,
                "invalidRecords": 0,
                "subjectsFetched": 0,
                "message": (
                    "Portal credentials are not configured."
                ),
                "error": None,
            }

        sync_log_id = self._start_log()

        try:

            result = await self._sync_student(
                student
            )

            failed = result.get(
                "attendanceFetchFailed",
                False,
            )

            self._finish_log(
                sync_log_id=sync_log_id,
                status=(
                    "PARTIAL"
                    if failed
                    else "SUCCESS"
                ),
                students_processed=1,
                records_processed=int(
                    result.get(
                        "recordsProcessed",
                        0,
                    )
                    or 0
                ),
                changes_detected=int(
                    result.get(
                        "changesDetected",
                        0,
                    )
                    or 0
                ),
                errors_count=1 if failed else 0,
                error=result.get("error"),
            )

            return {
                "success": not failed,
                "studentsProcessed": 1,
                "studentsSkipped": 0,
                "recordsProcessed": int(
                    result.get(
                        "recordsProcessed",
                        0,
                    )
                    or 0
                ),
                "changesDetected": int(
                    result.get(
                        "changesDetected",
                        0,
                    )
                    or 0
                ),
                "notificationsCreated": int(
                    result.get(
                        "notificationsCreated",
                        0,
                    )
                    or 0
                ),
                "errorsCount": 1 if failed else 0,
                "attendanceFetched": int(
                    result.get(
                        "attendanceFetched",
                        0,
                    )
                    or 0
                ),
                "invalidRecords": int(
                    result.get(
                        "invalidRecords",
                        0,
                    )
                    or 0
                ),
                "subjectsFetched": int(
                    result.get(
                        "subjectsFetched",
                        0,
                    )
                    or 0
                ),
                "message": result.get("message"),
                "error": result.get("error"),
            }

        except Exception as exc:

            self._finish_log(
                sync_log_id=sync_log_id,
                status="FAILED",
                students_processed=0,
                records_processed=0,
                changes_detected=0,
                errors_count=1,
                error=str(exc),
            )

            raise

    # =========================================================
    # SYNC STUDENT
    # =========================================================

    async def _sync_student(
        self,
        student: dict,
    ) -> dict:

        student_id = str(
            student.get("id")
            or student.get("_id")
            or ""
        ).strip()

        if not student_id:
            raise ValueError(
                "Student ID is missing."
            )

        lock = self._get_student_lock(
            student_id
        )

        if lock.locked():

            return {
                "recordsProcessed": 0,
                "changesDetected": 0,
                "notificationsCreated": 0,
                "attendanceFetched": 0,
                "subjectsFetched": 0,
                "invalidRecords": 0,
                "attendanceFetchFailed": False,
                "message": (
                    "Student synchronization "
                    "already running."
                ),
                "error": None,
            }

        async with lock:

            return await self._perform_student_sync(
                student,
                student_id,
            )
    # =========================================================
    # MAIN STUDENT SYNC
    # =========================================================

    async def _perform_student_sync(
        self,
        student: dict,
        student_id: str,
    ):

        # =====================================================
        # AMS + PARENT PORTAL
        # =====================================================

        try:

            portal_data = (
                await self.student_service
                .get_current_portal_data(
                    student,
                    fetch_ams_profile=True,
                )
            )

        except Exception as exc:

            self._mark_student_sync_failed(
                student_id,
                str(exc),
            )

            raise RuntimeError(
                f"Portal synchronization failed: {exc}"
            ) from exc

        if not isinstance(
            portal_data,
            dict,
        ):

            self._mark_student_sync_failed(
                student_id,
                "Invalid portal response.",
            )

            raise RuntimeError(
                "Invalid portal response."
            )

        # =====================================================
        # CURRENT SUBJECTS & RAW ATTENDANCE
        # =====================================================

        raw_subjects = self._extract_subjects(portal_data)
        subject_map = self._build_subject_map(raw_subjects)
        
        raw_attendance = self._extract_attendance(portal_data)

        # =====================================================
        # FIX: DYNAMIC SUBJECT FALLBACK
        # If the portal's course table is empty but attendance 
        # logs exist, dynamically rebuild subjects from the logs!
        # =====================================================
        if not subject_map and raw_attendance:
            for record in raw_attendance:
                if isinstance(record, IncomingAttendanceRecord):
                    name = getattr(record, "subjectName", "")
                    code = getattr(record, "subjectCode", "")
                elif isinstance(record, dict):
                    name = record.get("subjectName") or record.get("subject") or ""
                    code = record.get("subjectCode") or record.get("code") or ""
                else:
                    continue
                
                name = self._clean_text(name)
                code = self._clean_text(code)
                
                if name and not self._invalid_subject(name, code):
                    key = "code:" + self._normalize_key(code) if code else "name:" + self._normalize_key(name)
                    if key not in subject_map:
                        subject_map[key] = {
                            "name": name,
                            "code": code
                        }

        # If it's STILL empty after checking attendance, exit gracefully.
        if not subject_map:
            error_message = (
                "AMS profile synchronized, but the Parent Portal adapter "
                "returned no current subject rows. Attendance was not "
                "invented or written to the database."
            )

            self._mark_student_sync_failed(
                student_id,
                error_message,
            )

            return {
                "recordsProcessed": 0,
                "changesDetected": 0,
                "notificationsCreated": 0,
                "attendanceFetched": len(raw_attendance),
                "subjectsFetched": 0,
                "invalidRecords": 0,
                "staleAttendanceRemoved": 0,
                "attendanceFetchFailed": True,
                "message": error_message,
                "error": error_message,
            }

        # =====================================================
        # SAVE CURRENT SUBJECTS
        # =====================================================

        subjects_saved = self._save_subjects(
            student_id=student_id,
            subject_map=subject_map,
        )

        current_codes = {
            self._normalize_key(subject.get("code"))
            for subject in subject_map.values()
            if subject.get("code")
        }

        current_names = {
            self._normalize_key(subject.get("name"))
            for subject in subject_map.values()
            if subject.get("name")
        }

        # =====================================================
        # PROCESS ATTENDANCE
        # =====================================================

        if not raw_attendance:
            self._mark_student_sync_failed(
                student_id,
                "Parent Portal returned no attendance.",
            )

            return {
                "recordsProcessed": 0,
                "changesDetected": 0,
                "notificationsCreated": 0,
                "attendanceFetched": 0,
                "subjectsFetched": subjects_saved,
                "invalidRecords": 0,
                "attendanceFetchFailed": True,
                "message": "Parent Portal returned no attendance records to the synchronization layer.",
                "error": portal_data.get("attendanceError"),
            }

        attendance_records = []
        invalid_records = 0
        seen = set()

        for raw_record in raw_attendance:
            try:
                # Always normalize the adapter record, including records
                # that are already IncomingAttendanceRecord objects. The
                # previous code skipped subject-map matching for model
                # instances, which could cause valid live rows to be rejected.
                if isinstance(raw_record, IncomingAttendanceRecord):
                    source = (
                        raw_record.model_dump()
                        if hasattr(raw_record, "model_dump")
                        else raw_record.dict()
                    )
                    normalized = self._normalize_attendance_record(
                        source,
                        subject_map,
                    )
                elif isinstance(raw_record, dict):
                    normalized = self._normalize_attendance_record(
                        raw_record,
                        subject_map,
                    )
                else:
                    invalid_records += 1
                    continue

                subject_name = self._clean_text(
                    normalized.get("subjectName")
                )
                subject_code = self._clean_text(
                    normalized.get("subjectCode")
                )

                # Prefer exact code/name matching, then allow safe
                # normalized matching so harmless formatting differences
                # from the Parent Portal do not discard real attendance.
                if not self._is_current_subject(
                    subject_name,
                    subject_code,
                    current_codes,
                    current_names,
                ):
                    matched = self._find_matching_subject(
                        subject_name,
                        subject_code,
                        subject_map,
                    )

                    if matched:
                        normalized["subjectName"] = matched["name"]
                        normalized["subjectCode"] = matched["code"]
                    else:
                        invalid_records += 1
                        continue

                validated = IncomingAttendanceRecord.model_validate(
                    normalized
                )
                key = self._attendance_dedupe_key(validated, raw_record if isinstance(raw_record, dict) else None)

                if key in seen:
                    continue

                seen.add(key)
                attendance_records.append(validated)

            except Exception:
                invalid_records += 1

        # =====================================================
        # REMOVE OLD SUBJECT ATTENDANCE
        # =====================================================

        stale_attendance_removed = self._remove_stale_attendance(
            student_id,
            current_codes,
            current_names,
        )

        if not attendance_records:
            self._mark_student_sync_failed(
                student_id,
                "No attendance matched current subjects.",
            )
            return {
                "recordsProcessed": 0,
                "changesDetected": 0,
                "notificationsCreated": 0,
                "attendanceFetched": 0,
                "subjectsFetched": subjects_saved,
                "invalidRecords": invalid_records,
                "staleAttendanceRemoved": stale_attendance_removed,
                "attendanceFetchFailed": True,
                "message": "Attendance was returned, but none belongs to the current subjects.",
                "error": None,
            }

        # =====================================================
        # SAVE ATTENDANCE
        # =====================================================

        try:
            result = self.attendance_service.sync_student_records(
                student_id=student_id,
                incoming_records=attendance_records,
            )
        except Exception as exc:
            self._mark_student_sync_failed(student_id, str(exc))
            raise RuntimeError(f"Attendance could not be saved: {exc}") from exc

        if not isinstance(result, dict):
            result = {}

        records_processed = int(result.get("recordsProcessed", 0) or 0)
        changes_detected = int(result.get("changesDetected", 0) or 0)
        notifications_created = int(result.get("notificationsCreated", 0) or 0)

        if records_processed <= 0:
            error_message = (
                "Parent Portal returned attendance records, but "
                "AttendanceService saved 0 records."
            )
            self._mark_student_sync_failed(
                student_id,
                error_message,
            )
            return {
                "recordsProcessed": 0,
                "changesDetected": changes_detected,
                "notificationsCreated": notifications_created,
                "attendanceFetched": len(attendance_records),
                "subjectsFetched": subjects_saved,
                "invalidRecords": invalid_records,
                "staleAttendanceRemoved": stale_attendance_removed,
                "attendanceFetchFailed": True,
                "message": error_message,
                "error": error_message,
            }

        self._mark_student_synced(student_id)

        return {
            "recordsProcessed": records_processed,
            "changesDetected": changes_detected,
            "notificationsCreated": notifications_created,
            "attendanceFetched": len(attendance_records),
            "subjectsFetched": subjects_saved,
            "invalidRecords": invalid_records,
            "staleAttendanceRemoved": stale_attendance_removed,
            "attendanceFetchFailed": False,
            "message": "AMS profile and current Parent Portal subjects and attendance synchronized.",
            "error": None,
        }

    # =========================================================
    # EXTRACT SUBJECTS
    # =========================================================

    @staticmethod
    def _extract_subjects(portal_data: dict) -> list:
        """
        Extract current subjects from the adapter response.

        The Parent Portal can expose subjects under different names depending
        on the page/layout. We accept the known names and also inspect nested
        dictionaries/lists without inventing subjects.
        """
        if not isinstance(portal_data, dict):
            return []

        keys = {
            "subjects",
            "currentSubjects",
            "current_subjects",
            "courses",
            "currentCourses",
            "current_courses",
            "subjectDetails",
            "subject_details",
            "courseDetails",
            "course_details",
            "subjectAttendance",
            "subject_attendance",
            "attendanceSubjects",
        }

        found = []
        seen = set()

        def add_value(value):
            if not isinstance(value, list):
                return
            for item in value:
                if not isinstance(item, (dict, str)):
                    continue
                marker = repr(item)
                if marker not in seen:
                    seen.add(marker)
                    found.append(item)

        def walk(value, depth=0):
            if depth > 5:
                return

            if isinstance(value, dict):
                for key, child in value.items():
                    normalized_key = re.sub(
                        r"[^a-z0-9_]",
                        "",
                        str(key).lower(),
                    )
                    if (
                        key in keys
                        or normalized_key in {
                            re.sub(r"[^a-z0-9_]", "", k.lower())
                            for k in keys
                        }
                    ):
                        add_value(child)

                    if isinstance(child, (dict, list)):
                        walk(child, depth + 1)

            elif isinstance(value, list):
                for child in value:
                    if isinstance(child, (dict, list)):
                        walk(child, depth + 1)

        walk(portal_data)

        return found

    # =========================================================
    # EXTRACT ATTENDANCE
    # =========================================================

    @staticmethod
    def _extract_attendance(portal_data: dict) -> list:
        """
        Extract raw attendance rows from the adapter response.

        Important:
        This method does NOT manufacture attendance dates or statuses.
        It only returns actual records supplied by the Parent Portal adapter.
        """
        if not isinstance(portal_data, dict):
            return []

        keys = {
            "attendance",
            "attendanceRecords",
            "attendance_records",
            "records",
            "attendanceData",
            "attendance_data",
            "subjectAttendanceRecords",
            "subject_attendance_records",
            "dailyAttendance",
            "daily_attendance",
            "attendanceDetails",
            "attendance_details",
        }

        found = []
        seen = set()

        def add_value(value):
            if isinstance(value, (list, tuple)):
                items = value
            elif isinstance(value, dict):
                items = [value]
            else:
                return

            for item in items:
                if isinstance(item, IncomingAttendanceRecord):
                    marker = (
                        str(getattr(item, "subjectName", "")),
                        str(getattr(item, "subjectCode", "")),
                        str(getattr(item, "date", "")),
                        str(getattr(item, "status", "")),
                    )
                    if marker not in seen:
                        seen.add(marker)
                        found.append(item)
                    continue

                if not isinstance(item, dict):
                    continue

                marker = repr(item)
                if marker not in seen:
                    seen.add(marker)
                    found.append(item)

        def walk(value, depth=0):
            if depth > 5:
                return

            if isinstance(value, dict):
                for key, child in value.items():
                    normalized_key = re.sub(
                        r"[^a-z0-9_]",
                        "",
                        str(key).lower(),
                    )
                    normalized_targets = {
                        re.sub(r"[^a-z0-9_]", "", k.lower())
                        for k in keys
                    }

                    if (
                        key in keys
                        or normalized_key in normalized_targets
                    ):
                        add_value(child)

                    if isinstance(child, (dict, list)):
                        walk(child, depth + 1)

            elif isinstance(value, list):
                for child in value:
                    if isinstance(child, (dict, list)):
                        walk(child, depth + 1)

        walk(portal_data)

        return found

    # =========================================================
    # BUILD SUBJECT MAP
    # =========================================================

    @classmethod
    def _build_subject_map(cls, subjects: list) -> dict:
        unique = {}

        for raw in subjects:
            if isinstance(raw, str):
                name = cls._clean_text(raw)
                code = ""
            elif isinstance(raw, dict):
                name = (
                    raw.get("name")
                    or raw.get("subjectName")
                    or raw.get("subject_name")
                    or raw.get("courseName")
                    or raw.get("course_name")
                    or raw.get("subject")
                    or raw.get("course")
                    or raw.get("title")
                    or ""
                )
                code = (
                    raw.get("code")
                    or raw.get("subjectCode")
                    or raw.get("subject_code")
                    or raw.get("courseCode")
                    or raw.get("course_code")
                    or raw.get("courseId")
                    or ""
                )
                name = cls._clean_text(name)
                code = cls._clean_text(code)
            else:
                continue

            if code in {"-", "--", "—", "_"}:
                code = ""

            if cls._invalid_subject(name, code):
                continue

            if code:
                key = "code:" + cls._normalize_key(code)
            else:
                key = "name:" + cls._normalize_key(name)

            unique[key] = {
                "name": name,
                "code": code,
            }

        return unique

    # =========================================================
    # SAVE SUBJECTS (Safe Upsert)
    # =========================================================

    def _save_subjects(self, student_id: str, subject_map: dict) -> int:
        collection = self.db[SUBJECTS]
        now = utc_now()
        saved = 0

        for subject in subject_map.values():
            name = self._clean_text(subject.get("name"))
            code = self._clean_text(subject.get("code"))

            if code in {"-", "--", "—", "_"}:
                code = ""

            if self._invalid_subject(name, code):
                continue

            # CODED SUBJECT
            if code:
                try:
                    collection.update_one(
                        {"studentId": str(student_id), "code": code},
                        {
                            "$set": {
                                "name": name,
                                "active": True,
                                "source": "parent_portal",
                                "updatedAt": now,
                            },
                            "$setOnInsert": {
                                "createdAt": now,
                            }
                        },
                        upsert=True
                    )
                    saved += 1
                except DuplicateKeyError:
                    pass
                continue

            # UNCODED SUBJECT
            existing = collection.find_one({
                "studentId": str(student_id),
                "name": name,
                "$or": [{"code": None}, {"code": ""}, {"code": {"$exists": False}}],
            })

            if existing:
                collection.update_one(
                    {"_id": existing["_id"]},
                    {"$set": {"active": True, "source": "parent_portal", "updatedAt": now}},
                )
                saved += 1
                continue

            try:
                collection.insert_one({
                    "studentId": str(student_id),
                    "name": name,
                    "code": "",
                    "active": True,
                    "source": "parent_portal",
                    "createdAt": now,
                    "updatedAt": now,
                })
                saved += 1
            except DuplicateKeyError:
                pass

        return saved

    # =========================================================
    # CURRENT SUBJECT CHECK
    # =========================================================

    @classmethod
    def _is_current_subject(
        cls,
        subject_name: Any,
        subject_code: Any,
        current_codes: set[str],
        current_names: set[str],
    ) -> bool:

        code = cls._normalize_key(subject_code)
        name = cls._normalize_key(subject_name)

        if code and code in current_codes:
            return True

        if name and name in current_names:
            return True

        compact_code = cls._compact_key(subject_code)
        compact_name = cls._compact_key(subject_name)

        if compact_code:
            for current in current_codes:
                if compact_code == cls._compact_key(current):
                    return True

        if compact_name:
            for current in current_names:
                if compact_name == cls._compact_key(current):
                    return True

        return False

    @classmethod
    def _find_matching_subject(
        cls,
        subject_name: Any,
        subject_code: Any,
        subject_map: dict,
    ) -> dict | None:
        """
        Safely match an attendance row to a current subject.

        Parent Portal rows may differ from the subject list by:
        - whitespace
        - punctuation
        - case
        - an added section/semester suffix
        - code formatting such as CS101 vs CS-101

        We never invent a subject. We only return an existing subject
        already supplied by the Parent Portal subject list.
        """
        code_key = cls._compact_key(subject_code)
        name_key = cls._compact_key(subject_name)

        if code_key:
            for subject in subject_map.values():
                candidate = cls._compact_key(
                    subject.get("code")
                )
                if candidate and candidate == code_key:
                    return subject

        if name_key:
            for subject in subject_map.values():
                candidate = cls._compact_key(
                    subject.get("name")
                )
                if candidate and candidate == name_key:
                    return subject

            # Safe containment only for sufficiently long names.
            if len(name_key) >= 8:
                for subject in subject_map.values():
                    candidate = cls._compact_key(
                        subject.get("name")
                    )
                    if not candidate:
                        continue
                    if (
                        name_key in candidate
                        or candidate in name_key
                    ):
                        return subject

        return None

    @staticmethod
    def _compact_key(value: Any) -> str:
        value = str(value or "").strip().lower()
        return re.sub(r"[^a-z0-9]+", "", value)

    # =========================================================
    # REMOVE STALE ATTENDANCE
    # =========================================================

    def _remove_stale_attendance(
        self,
        student_id: str,
        current_codes: set[str],
        current_names: set[str],
    ) -> int:

        removed = 0
        cursor = self.db[ATTENDANCE_RECORDS].find({"studentId": str(student_id)})

        for record in cursor:
            code = self._normalize_key(record.get("subjectCode"))
            name = self._normalize_key(record.get("subjectName"))

            if (code and code in current_codes) or (name and name in current_names):
                continue

            result = self.db[ATTENDANCE_RECORDS].delete_one({"_id": record["_id"]})
            removed += result.deleted_count

        return removed

    # =========================================================
    # NORMALIZE ATTENDANCE
    # =========================================================

    @classmethod
    def _normalize_attendance_record(cls, record: dict, subject_map: dict) -> dict:
        subject_name = (
            record.get("subjectName")
            or record.get("subject_name")
            or record.get("subject")
            or record.get("courseName")
            or record.get("course_name")
            or record.get("course")
            or record.get("title")
            or ""
        )
        subject_code = (
            record.get("subjectCode")
            or record.get("subject_code")
            or record.get("courseCode")
            or record.get("course_code")
            or record.get("code")
            or record.get("courseId")
            or ""
        )
        
        subject_name = cls._clean_text(subject_name)
        subject_code = cls._clean_text(subject_code)

        if subject_code in {"-", "--", "—", "_"}:
            subject_code = ""

        matched = None
        if subject_code:
            matched = subject_map.get("code:" + cls._normalize_key(subject_code))

        if matched is None and subject_name:
            matched = subject_map.get("name:" + cls._normalize_key(subject_name))

        if matched:
            subject_name = matched.get("name") or subject_name
            subject_code = matched.get("code") or subject_code

        attendance_date = (
            record.get("date")
            or record.get("attendanceDate")
            or record.get("attendance_date")
            or record.get("attendedDate")
            or record.get("attended_date")
            or record.get("classDate")
            or record.get("class_date")
            or ""
        )
        status = (
            record.get("status")
            or record.get("attendanceStatus")
            or record.get("attendance_status")
            or record.get("present")
            or record.get("isPresent")
            or record.get("is_present")
            or record.get("attendance")
            or ""
        )

        if isinstance(status, bool):
            status = "PRESENT" if status else "ABSENT"
        else:
            value = str(status).strip().upper()
            if value in {"P", "PRESENT", "YES", "Y", "TRUE", "1", "✓", "✔"}:
                status = "PRESENT"
            elif value in {"A", "ABSENT", "NO", "N", "FALSE", "0", "X", "✗", "❌"}:
                status = "ABSENT"
            else:
                status = value

        return {
            "subjectName": subject_name,
            "subjectCode": subject_code,
            "date": cls._clean_text(attendance_date),
            "status": cls._clean_text(status),
        }

    # =========================================================
    # DEDUPE
    # =========================================================

    @classmethod
    def _attendance_dedupe_key(
        cls,
        record: IncomingAttendanceRecord,
        raw_record: dict | None = None,
    ) -> tuple:

        data = record.model_dump() if hasattr(record, "model_dump") else record.dict()
        subject_code = cls._normalize_key(data.get("subjectCode"))
        subject_name = cls._normalize_key(data.get("subjectName"))
        date = cls._clean_text(data.get("date"))
        
        session = ""
        if isinstance(raw_record, dict):
            for key in ("hour", "period", "session", "time"):
                value = raw_record.get(key)
                if value not in (None, ""):
                    session = cls._normalize_key(value)
                    break

        return (subject_code or subject_name, date, session)

    # =========================================================
    # SUBJECT VALIDATION
    # =========================================================

    @staticmethod
    def _invalid_subject(name: Any, code: Any) -> bool:
        name = str(name or "").strip()
        code = str(code or "").strip()

        if not name:
            return True

        if name.lower() in {
            "-", "--", "—", "_", "none", "null", "undefined",
            "subject", "subjects", "course", "courses", "status", "statusno"
        }:
            return True

        if "=>" in name or "array(" in name.lower():
            return True

        if code in {"-", "--", "—", "_"}:
            return True

        return False

    @staticmethod
    def _normalize_key(value: Any) -> str:
        value = str(value or "").strip().lower()
        return re.sub(r"\s+", " ", value)

    @staticmethod
    def _clean_text(value: Any) -> str:
        if value is None:
            return ""
        value = str(value).replace("\xa0", " ")
        return re.sub(r"\s+", " ", value).strip()

    def sync_manual_records(self, student_id: str, records: list[IncomingAttendanceRecord]) -> dict:
        result = self.attendance_service.sync_student_records(student_id=str(student_id), incoming_records=records)
        return {"success": True, **result}

    def latest_status(self) -> dict | None:
        log = self.db[SYNC_LOGS].find_one(sort=[("startedAt", -1)])
        if not log:
            return None
        return serialize_document(log)

    def _start_log(self):
        result = self.db[SYNC_LOGS].insert_one({
            "startedAt": utc_now(),
            "completedAt": None,
            "status": "RUNNING",
            "studentsProcessed": 0,
            "studentsSkipped": 0,
            "recordsProcessed": 0,
            "changesDetected": 0,
            "errorsCount": 0,
            "error": None,
        })
        return result.inserted_id

    def _finish_log(
        self,
        sync_log_id: ObjectId,
        status: str,
        students_processed: int,
        records_processed: int,
        changes_detected: int,
        errors_count: int = 0,
        error: str | None = None,
    ) -> None:
        self.db[SYNC_LOGS].update_one(
            {"_id": sync_log_id},
            {
                "$set": {
                    "completedAt": utc_now(),
                    "status": status,
                    "studentsProcessed": students_processed,
                    "recordsProcessed": records_processed,
                    "changesDetected": changes_detected,
                    "errorsCount": errors_count,
                    "error": error,
                }
            },
        )

    def _mark_student_synced(self, student_id: str) -> None:
        try:
            object_id = ObjectId(str(student_id))
        except Exception:
            return

        self.db[self.USERS_COLLECTION].update_one(
            {"_id": object_id},
            {
                "$set": {
                    "portalSynced": True,
                    "lastSyncedAt": utc_now(),
                    "portalSyncLastError": None,
                }
            },
        )

    def _mark_student_sync_failed(self, student_id: str, error: str) -> None:
        try:
            object_id = ObjectId(str(student_id))
        except Exception:
            return

        self.db[self.USERS_COLLECTION].update_one(
            {"_id": object_id},
            {
                "$set": {
                    "portalSynced": False,
                    "portalSyncLastError": error,
                }
            },
        )

    @staticmethod
    def _has_portal_credentials(student: dict) -> bool:
        username = student.get("portalUsername")
        encrypted_password = student.get("portalPasswordEncrypted")
        configured = student.get("portalCredentialsConfigured", False)
        # portalPasswordEncrypted is the AMS password. The Parent Portal
        # itself uses only portalUsername (VTU number).
        return bool(
            username
            and encrypted_password
            and configured
        )
