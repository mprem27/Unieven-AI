from __future__ import annotations

import re
from collections import defaultdict
from typing import Any

from bson import ObjectId
from bson.errors import InvalidId
from fastapi import HTTPException, status
from pymongo.database import Database
from pymongo.errors import DuplicateKeyError

from app.models.attendance import ATTENDANCE_RECORDS
from app.models.attendance_change import ATTENDANCE_CHANGES
from app.models.subject import SUBJECTS

from app.schemas.attendance import IncomingAttendanceRecord

from app.services.base import serialize_document
from app.services.notification_service import NotificationService

from app.utils.dates import (
    ensure_iso_date,
    today_iso,
    utc_now,
)

from app.utils.validators import normalize_attendance_status


class AttendanceService:
    """
    Attendance database service.

    Responsibilities:
    - Read attendance records from MongoDB.
    - Create/update subjects received from the portals.
    - Store synchronized attendance.
    - Detect attendance changes.
    - Build subject-wise summaries.

    IMPORTANT:
    This service does NOT scrape the college/parent portals.
    Portal scraping must be handled by the portal adapters.
    """

    SOURCE_PRIORITY = {
        "admin": 4,
        "parent_portal": 3,
        "parentportal": 3,
        "parent-portal": 3,
        "parent portal": 3,
        "college_portal": 2,
        "collegeportal": 2,
        "college-portal": 2,
        "college portal": 2,
        "ams": 1,
        "mock": 0,
    }

    def __init__(self, db: Database):
        self.db = db
        self.notification_service = NotificationService(db)

    # =========================================================
    # NORMALIZATION
    # =========================================================

    @staticmethod
    def _clean_text(value: Any) -> str:
        if value is None:
            return ""

        return str(value).strip()

    @classmethod
    def _normalize_code(cls, value: Any) -> str:
        value = cls._clean_text(value)

        invalid = {
            "",
            "-",
            "--",
            "—",
            "_",
            "null",
            "none",
            "n/a",
            "na",
            "undefined",
            "nil",
        }

        if value.lower() in invalid:
            return ""

        return value.upper()

    @classmethod
    def _normalize_subject_name(cls, value: Any) -> str:
        value = cls._clean_text(value)

        if not value:
            return ""

        return re.sub(r"\s+", " ", value).strip()

    @classmethod
    def _normalize_source(cls, value: Any) -> str:
        value = cls._clean_text(value).lower()

        aliases = {
            "parentportal": "parent_portal",
            "parent-portal": "parent_portal",
            "parent portal": "parent_portal",

            "collegeportal": "college_portal",
            "college-portal": "college_portal",
            "college portal": "college_portal",
        }

        return aliases.get(
            value,
            value or "college_portal",
        )

    @classmethod
    def _source_priority(cls, source: str) -> int:
        return cls.SOURCE_PRIORITY.get(
            cls._normalize_source(source),
            0,
        )

    @staticmethod
    def _escape_regex(value: str) -> str:
        return re.escape(value)

    @classmethod
    def _is_placeholder_subject(
        cls,
        name: str,
        code: str,
    ) -> bool:
        name = cls._normalize_subject_name(name)
        code = cls._normalize_code(code)

        if not name:
            return True

        lower_name = name.lower()

        invalid_names = {
            "-",
            "--",
            "—",
            "_",
            "none",
            "null",
            "undefined",
            "n/a",
            "na",
            "subject",
            "subjects",
        }

        if lower_name in invalid_names:
            return True

        if name.isdigit() and (
            not code or code.isdigit()
        ):
            return True

        return False

    # =========================================================
    # SUBJECT ID HELPERS
    # =========================================================

    @staticmethod
    def _string_id(value: Any) -> str:
        """
        Safely convert Mongo/ObjectId/string IDs to a string.
        """
        if value is None:
            return ""

        return str(value).strip()

    @staticmethod
    def _object_id(value: Any) -> ObjectId | None:
        """
        Convert a value to ObjectId when possible.

        Returns None for normal string IDs.
        """
        if value is None:
            return None

        if isinstance(value, ObjectId):
            return value

        value = str(value).strip()

        if not value:
            return None

        try:
            return ObjectId(value)
        except (InvalidId, TypeError):
            return None

    # =========================================================
    # SUBJECT CACHE
    # =========================================================

    def _build_subject_cache(self, student_id: str | None = None) -> dict[str, dict]:
        """
        Load subjects once.

        This prevents N+1 queries when the attendance page
        requests many records.
        """

        cache = {
            "id": {},
            "code": {},
            "name": {},
        }

        query = {"$or": [{"studentId": student_id}, {"studentId": None}]} if student_id else {}
        cursor = self.db[SUBJECTS].find(query)

        for subject in cursor:
            self._register_subject_in_cache(subject, cache)

        return cache

    def _find_subject_cached(
        self,
        record: dict,
        cache: dict,
    ) -> dict | None:

        owner = self._string_id(record.get("studentId"))

        subject_id = self._string_id(
            record.get("subjectId")
        )

        if subject_id:
            subject = cache["id"].get(
                subject_id
            )

            if subject and self._string_id(subject.get("studentId")) in {"", owner}:
                # Old attendance can refer to the shared catalog ID. Once the
                # student has an owned course, use their own source metadata.
                if not subject.get("studentId"):
                    code = self._normalize_code(subject.get("code"))
                    owned = cache["code"].get((owner, code)) if code else None
                    if owned:
                        return owned
                return subject

        subject_code = self._normalize_code(
            record.get("subjectCode")
        )

        if subject_code:
            subject = cache["code"].get((owner, subject_code)) or cache["code"].get(("", subject_code))

            if subject:
                return subject

        subject_name = self._normalize_subject_name(
            record.get("subjectName")
        )

        if subject_name:
            subject = cache["name"].get((owner, subject_name.lower())) or cache["name"].get(("", subject_name.lower()))

            if subject and (not subject_code or self._normalize_code(subject.get("code")) in {"", subject_code}):
                return subject

        return None

    def _is_active_subject_cached(
        self,
        record: dict,
        cache: dict,
    ) -> bool:

        subject = self._find_subject_cached(
            record,
            cache,
        )

        if subject is None:
            # Do not hide attendance simply because
            # the subject collection does not contain
            # a matching record yet.
            return True

        return bool(
            subject.get(
                "active",
                True,
            )
        )

    def _with_subject_cached(
        self,
        record: dict,
        cache: dict,
    ) -> dict:

        item = serialize_document(
            record
        )

        subject = self._find_subject_cached(
            item,
            cache,
        )

        if subject:
            item["subjectName"] = (
                subject.get("name")
                or item.get("subjectName")
                or "Unknown Subject"
            )

            item["subjectCode"] = (
                subject.get("code")
                or item.get("subjectCode")
            )

            if subject.get("_id") is not None:
                item["subjectId"] = str(
                    subject["_id"]
                )

        else:
            item["subjectName"] = (
                item.get("subjectName")
                or "Unknown Subject"
            )

            item["subjectCode"] = (
                item.get("subjectCode")
                or None
            )

        return item

    # =========================================================
    # LIST RECORDS
    # =========================================================

    def list_records(
        self,
        student_id: str,
    ) -> list[dict]:

        student_id = self._string_id(
            student_id
        )

        if not student_id:
            return []

        cache = self._build_subject_cache(student_id)

        records = (
            self.db[ATTENDANCE_RECORDS]
            .find(
                {
                    "studentId": student_id,
                }
            )
            .sort(
                [
                    ("date", -1),
                    ("updatedAt", -1),
                ]
            )
        )

        return [
            self._with_subject_cached(
                record,
                cache,
            )
            for record in records
            if self._is_active_subject_cached(
                record,
                cache,
            )
        ]

    # =========================================================
    # TODAY
    # =========================================================

    def list_today(
        self,
        student_id: str,
    ) -> list[dict]:

        student_id = self._string_id(
            student_id
        )

        if not student_id:
            return []

        cache = self._build_subject_cache(student_id)

        records = (
            self.db[ATTENDANCE_RECORDS]
            .find(
                {
                    "studentId": student_id,
                    "date": today_iso(),
                }
            )
            .sort(
                "updatedAt",
                -1,
            )
        )

        return [
            self._with_subject_cached(
                record,
                cache,
            )
            for record in records
            if self._is_active_subject_cached(
                record,
                cache,
            )
        ]

    # =========================================================
    # CHANGES
    # =========================================================

    def list_changes(
        self,
        student_id: str,
    ) -> list[dict]:

        student_id = self._string_id(
            student_id
        )

        if not student_id:
            return []

        changes = (
            self.db[ATTENDANCE_CHANGES]
            .find(
                {
                    "studentId": student_id,
                }
            )
            .sort(
                "detectedAt",
                -1,
            )
            .limit(100)
        )

        return [
            serialize_document(change)
            for change in changes
        ]

    # =========================================================
    # SUMMARY
    # =========================================================

    def summary(
        self,
        student_id: str,
    ) -> list[dict]:

        student_id = self._string_id(
            student_id
        )

        if not student_id:
            return []

        cache = self._build_subject_cache(student_id)

        records = self.db[
            ATTENDANCE_RECORDS
        ].find(
            {
                "studentId": student_id,
            }
        )

        counts = defaultdict(
            lambda: {
                "present": 0,
                "absent": 0,
            }
        )

        subject_cache = {}

        for record in records:

            if not self._is_active_subject_cached(
                record,
                cache,
            ):
                continue

            subject = self._find_subject_cached(
                record,
                cache,
            )

            subject_id = (
                str(
                    subject.get("_id")
                )
                if subject and subject.get("_id")
                else self._string_id(
                    record.get("subjectId")
                )
            )

            subject_name = (
                self._normalize_subject_name(
                    subject.get("name")
                    if subject
                    else record.get(
                        "subjectName"
                    )
                )
            )

            subject_code = (
                self._normalize_code(
                    subject.get("code")
                    if subject
                    else record.get(
                        "subjectCode"
                    )
                )
            )

            if subject_id:
                key = f"id:{subject_id}"

            elif subject_code:
                key = f"code:{subject_code}"

            elif subject_name:
                key = (
                    f"name:"
                    f"{subject_name.lower()}"
                )

            else:
                continue

            attendance_status = (
                normalize_attendance_status(
                    record.get("status")
                )
            )

            if attendance_status == "PRESENT":
                counts[key]["present"] += 1

            elif attendance_status == "ABSENT":
                counts[key]["absent"] += 1

            subject_cache[key] = {
                "subjectId": (
                    subject_id or None
                ),
                "subjectName": (
                    subject_name
                    or "Unknown Subject"
                ),
                "subjectCode": (
                    subject_code
                    or None
                ),
            }

        response = []

        for key, data in counts.items():

            subject = subject_cache.get(
                key,
                {},
            )

            present = data["present"]
            absent = data["absent"]
            total = present + absent

            percentage = (
                round(
                    present / total * 100,
                    2,
                )
                if total
                else 0.0
            )

            response.append(
                {
                    "subjectId": subject.get(
                        "subjectId"
                    ),
                    "subjectName": subject.get(
                        "subjectName",
                        "Unknown Subject",
                    ),
                    "subjectCode": subject.get(
                        "subjectCode"
                    ),
                    "present": present,
                    "absent": absent,
                    "total": total,
                    "percentage": percentage,
                }
            )

        return sorted(
            response,
            key=lambda item: (
                item.get(
                    "subjectName"
                )
                or ""
            ).lower(),
        )

    # =========================================================
    # SUBJECT DETAILS
    # =========================================================

    def subject_details(
        self,
        student_id: str,
        subject_id: str,
    ) -> dict:

        student_id = self._string_id(
            student_id
        )

        subject_id = self._string_id(
            subject_id
        )

        if not student_id:
            raise HTTPException(
                status_code=401,
                detail="Student identity is missing.",
            )

        if not subject_id:
            raise HTTPException(
                status_code=400,
                detail="Subject ID is required.",
            )

        # -----------------------------------------------------
        # Find subject using ObjectId OR string id.
        # -----------------------------------------------------

        cache = self._build_subject_cache(student_id)
        subject = self._find_subject_cached(
            {"studentId": student_id, "subjectId": subject_id, "subjectCode": subject_id},
            cache,
        )

        if subject is None:
            raise HTTPException(
                status_code=404,
                detail="Subject not found or inactive.",
            )

        if not subject.get(
            "active",
            True,
        ):
            raise HTTPException(
                status_code=404,
                detail="Subject not found or inactive.",
            )

        # -----------------------------------------------------
        # Attendance may have been stored using:
        # Mongo ObjectId string
        # subject string id
        # subject code
        # -----------------------------------------------------

        query_candidates = []

        query_candidates.append(
            {
                "studentId": student_id,
                "subjectId": subject_id,
            }
        )

        if subject.get("_id") is not None:
            query_candidates.append(
                {
                    "studentId": student_id,
                    "subjectId": str(
                        subject["_id"]
                    ),
                }
            )

        subject_code = self._normalize_code(
            subject.get("code")
        )

        if subject_code:
            query_candidates.append(
                {
                    "studentId": student_id,
                    "subjectCode": subject_code,
                }
            )

        # Remove duplicate queries.
        unique_queries = []

        for query in query_candidates:
            if query not in unique_queries:
                unique_queries.append(query)

        records_by_id = {}

        for query in unique_queries:
            cursor = (
                self.db[
                    ATTENDANCE_RECORDS
                ]
                .find(query)
                .sort(
                    "date",
                    -1,
                )
            )

            for record in cursor:
                record_id = str(
                    record.get("_id")
                )

                records_by_id[
                    record_id
                ] = record

        records = list(
            records_by_id.values()
        )

        records.sort(
            key=lambda record: str(
                record.get(
                    "date",
                    "",
                )
            ),
            reverse=True,
        )

        present = 0
        absent = 0

        for record in records:

            attendance_status = (
                normalize_attendance_status(
                    record.get("status")
                )
            )

            if attendance_status == "PRESENT":
                present += 1

            elif attendance_status == "ABSENT":
                absent += 1

        total = present + absent

        percentage = (
            round(
                present / total * 100,
                2,
            )
            if total
            else 0.0
        )

        return {
            "subjectId": str(
                subject.get("_id")
                or subject.get("id")
                or subject_id
            ),
            "subjectName": (
                subject.get("name")
                or "Unknown Subject"
            ),
            "subjectCode": (
                subject.get("code")
            ),
            "present": present,
            "absent": absent,
            "total": total,
            "percentage": percentage,
            "records": [
                self._with_subject_cached(
                    record,
                    cache,
                )
                for record in records
            ],
        }

    # =========================================================
    # CACHE UPDATE
    # =========================================================

    def _register_subject_in_cache(
        self,
        subject: dict,
        cache: dict,
    ) -> None:

        if not subject:
            return

        for subject_id in (subject.get("_id"), subject.get("id")):
            if subject_id is not None:
                cache["id"][str(subject_id)] = subject

        code = self._normalize_code(
            subject.get("code")
        )

        if code:
            cache["code"][(self._string_id(subject.get("studentId")), code)] = subject

        name = self._normalize_subject_name(
            subject.get("name")
        )

        if name:
            cache["name"][
                (self._string_id(subject.get("studentId")), name.lower())
            ] = subject

    # =========================================================
    # MAIN SYNCHRONIZATION
    # =========================================================

    def sync_student_records(
        self,
        student_id: str,
        incoming_records: list[
            IncomingAttendanceRecord
        ],
    ) -> dict:

        student_id = self._string_id(
            student_id
        )

        if not student_id:
            raise HTTPException(
                status_code=400,
                detail="Student ID is required.",
            )

        if not incoming_records:
            return {
                "studentsProcessed": 1,
                "recordsProcessed": 0,
                "changesDetected": 0,
                "notificationsCreated": 0,
                "invalidRecords": 0,
            }

        records_processed = 0
        changes_detected = 0
        notifications_created = 0
        invalid_records = 0

        prepared = []

        # -----------------------------------------------------
        # Validate incoming portal records.
        # -----------------------------------------------------

        for record in incoming_records:

            source = self._normalize_source(
                getattr(
                    record,
                    "source",
                    None,
                )
                or "parent_portal"
            )

            priority = self._source_priority(
                source
            )

            subject_name = (
                self._normalize_subject_name(
                    getattr(
                        record,
                        "subjectName",
                        "",
                    )
                )
            )

            subject_code = (
                self._normalize_code(
                    getattr(
                        record,
                        "subjectCode",
                        "",
                    )
                )
            )

            subject_id = getattr(
                record,
                "subjectId",
                None,
            )

            raw_date = getattr(
                record,
                "date",
                None,
            )

            attendance_status = (
                normalize_attendance_status(
                    getattr(
                        record,
                        "status",
                        None,
                    )
                )
            )

            if (
                self._is_placeholder_subject(
                    subject_name,
                    subject_code,
                )
                or not raw_date
                or attendance_status
                not in {
                    "PRESENT",
                    "ABSENT",
                }
            ):
                invalid_records += 1
                continue

            try:
                attendance_date = ensure_iso_date(
                    raw_date
                )
            except Exception:
                invalid_records += 1
                continue

            prepared.append(
                {
                    "priority": priority,
                    "source": source,
                    "record": record,
                    "subjectName": subject_name,
                    "subjectCode": subject_code,
                    "subjectId": subject_id,
                    "date": attendance_date,
                    "status": attendance_status,
                }
            )

        # Parent Portal has higher priority than
        # AMS/college portal attendance.
        prepared.sort(
            key=lambda item: item["priority"],
            reverse=True,
        )

        processed_keys = set()

        cache = self._build_subject_cache(student_id)

        # -----------------------------------------------------
        # Save every valid attendance record.
        # -----------------------------------------------------

        for item in prepared:

            priority = item["priority"]
            source = item["source"]

            subject_name = item[
                "subjectName"
            ]

            subject_code = item[
                "subjectCode"
            ]

            supplied_subject_id = item[
                "subjectId"
            ]

            attendance_date = item[
                "date"
            ]

            attendance_status = item[
                "status"
            ]

            # ---------------------------------------------
            # Resolve subject.
            # ---------------------------------------------

            subject = self._find_subject_cached(
                {
                    "studentId": student_id,
                    "subjectId": supplied_subject_id,
                    "subjectCode": subject_code,
                    "subjectName": subject_name,
                },
                cache,
            )

            if subject is None or self._string_id(subject.get("studentId")) != student_id:

                try:
                    subject = self._upsert_subject(
                        student_id=student_id,
                        name=subject_name,
                        code=subject_code,
                        subject_id=(
                            supplied_subject_id
                        ),
                        source=source,
                    )

                    self._register_subject_in_cache(
                        subject,
                        cache,
                    )

                except HTTPException:
                    invalid_records += 1
                    continue

            subject_id = (
                subject.get("_id")
                or subject.get("id")
            )

            if subject_id is None:
                invalid_records += 1
                continue

            subject_id = str(
                subject_id
            )

            key = (
                student_id,
                subject_id,
                attendance_date,
            )

            if key in processed_keys:
                continue

            mongo_key = {
                "studentId": student_id,
                "subjectId": subject_id,
                "date": attendance_date,
            }

            existing = self.db[
                ATTENDANCE_RECORDS
            ].find_one(
                mongo_key
            )
            if existing is None and subject_code:
                # Pre-ownership attendance used shared catalog IDs. Reuse its
                # student/course/date record as courses become owned so the
                # next portal sync cannot count the same class twice.
                existing = self.db[ATTENDANCE_RECORDS].find_one({
                    "studentId": student_id,
                    "subjectCode": subject_code,
                    "date": attendance_date,
                })

            now = utc_now()

            # ---------------------------------------------
            # Existing record.
            # ---------------------------------------------

            if existing:

                old_status = (
                    normalize_attendance_status(
                        existing.get(
                            "status"
                        )
                    )
                )

                existing_source = (
                    self._normalize_source(
                        existing.get(
                            "source",
                            "",
                        )
                    )
                )

                existing_priority = (
                    self._source_priority(
                        existing_source
                    )
                )

                # Never allow a lower-priority source
                # to overwrite Parent Portal data.
                if (
                    existing_priority
                    > priority
                ):
                    processed_keys.add(
                        key
                    )
                    continue

                # -----------------------------------------
                # Detect status change.
                # -----------------------------------------

                if (
                    old_status
                    and old_status
                    != attendance_status
                ):

                    self.db[
                        ATTENDANCE_CHANGES
                    ].insert_one(
                        {
                            "studentId": student_id,
                            "subjectId": subject_id,
                            "subjectName": (
                                subject.get(
                                    "name",
                                    subject_name,
                                )
                            ),
                            "subjectCode": (
                                subject.get(
                                    "code"
                                )
                                or subject_code
                                or None
                            ),
                            "date": attendance_date,
                            "oldStatus": old_status,
                            "newStatus": attendance_status,
                            "detectedAt": now,
                            "source": source,
                        }
                    )

                    try:
                        self.notification_service.create_attendance_notification(
                            student_id=student_id,
                            subject_id=subject_id,
                            subject_name=subject.get(
                                "name",
                                subject_name,
                            ),
                            date=attendance_date,
                            old_status=old_status,
                            new_status=attendance_status,
                        )

                        notifications_created += 1

                    except Exception:
                        pass

                    changes_detected += 1

                update_data = {
                    "subjectId": subject_id,
                    "subjectName": (
                        subject.get(
                            "name",
                            subject_name,
                        )
                    ),
                    "status": attendance_status,
                    "source": source,
                    "updatedAt": now,
                }

                actual_code = (
                    subject.get("code")
                    or subject_code
                )

                if actual_code:
                    update_data[
                        "subjectCode"
                    ] = actual_code

                self.db[
                    ATTENDANCE_RECORDS
                ].update_one(
                    {"_id": existing["_id"], "studentId": student_id},
                    {
                        "$set": update_data,
                    },
                )

                records_processed += 1

            # ---------------------------------------------
            # New record.
            # ---------------------------------------------

            else:

                document = {
                    "studentId": student_id,
                    "subjectId": subject_id,
                    "subjectName": (
                        subject.get(
                            "name",
                            subject_name,
                        )
                    ),
                    "date": attendance_date,
                    "status": attendance_status,
                    "source": source,
                    "createdAt": now,
                    "updatedAt": now,
                }

                actual_code = (
                    subject.get("code")
                    or subject_code
                )

                if actual_code:
                    document[
                        "subjectCode"
                    ] = actual_code

                try:

                    self.db[
                        ATTENDANCE_RECORDS
                    ].update_one(
                        mongo_key,
                        {
                            "$set": document,
                        },
                        upsert=True,
                    )

                    records_processed += 1

                except DuplicateKeyError:

                    if self.db[
                        ATTENDANCE_RECORDS
                    ].find_one(
                        mongo_key
                    ):
                        records_processed += 1

            processed_keys.add(
                key
            )

        result = {
            "studentsProcessed": 1,
            "recordsProcessed": records_processed,
            "changesDetected": changes_detected,
            "notificationsCreated": notifications_created,
            "invalidRecords": invalid_records,
        }

        return result

    # =========================================================
    # ADMIN / ALL RECORDS
    # =========================================================

    def list_all_records(
        self,
        student_id: str | None = None,
    ) -> list[dict]:

        query = (
            {
                "studentId": self._string_id(
                    student_id
                )
            }
            if student_id
            else {}
        )

        cache = self._build_subject_cache()

        records = (
            self.db[
                ATTENDANCE_RECORDS
            ]
            .find(query)
            .sort(
                [
                    ("studentId", 1),
                    ("date", -1),
                    ("updatedAt", -1),
                ]
            )
        )

        return [
            self._with_subject_cached(
                record,
                cache,
            )
            for record in records
        ]

    # =========================================================
    # ADMIN UPDATE
    # =========================================================

    def update_attendance(
        self,
        attendance_id: str,
        status_value: str,
    ) -> dict:

        object_id = self._object_id(
            attendance_id
        )

        if object_id is None:
            raise HTTPException(
                status_code=400,
                detail="Invalid attendance ID.",
            )

        new_status = (
            normalize_attendance_status(
                status_value
            )
        )

        if new_status not in {
            "PRESENT",
            "ABSENT",
        }:
            raise HTTPException(
                status_code=400,
                detail=(
                    "Attendance status must be "
                    "PRESENT or ABSENT."
                ),
            )

        existing = self.db[
            ATTENDANCE_RECORDS
        ].find_one(
            {
                "_id": object_id,
            }
        )

        if not existing:
            raise HTTPException(
                status_code=404,
                detail="Attendance record not found.",
            )

        old_status = (
            normalize_attendance_status(
                existing.get(
                    "status"
                )
            )
        )

        if old_status == new_status:
            return self._with_subject_cached(
                existing,
                self._build_subject_cache(),
            )

        subject = None

        subject_id = existing.get(
            "subjectId"
        )

        subject_object_id = (
            self._object_id(
                subject_id
            )
        )

        if subject_object_id:
            subject = self.db[
                SUBJECTS
            ].find_one(
                {
                    "_id": subject_object_id,
                }
            )

        if subject is None and subject_id:
            subject = self.db[
                SUBJECTS
            ].find_one(
                {
                    "id": str(subject_id),
                }
            )

        subject = subject or {}

        subject_name = (
            subject.get("name")
            or existing.get(
                "subjectName"
            )
            or "Unknown Subject"
        )

        now = utc_now()

        self.db[
            ATTENDANCE_CHANGES
        ].insert_one(
            {
                "studentId": existing[
                    "studentId"
                ],
                "subjectId": existing.get(
                    "subjectId"
                ),
                "subjectName": subject_name,
                "subjectCode": (
                    subject.get("code")
                    or existing.get(
                        "subjectCode"
                    )
                ),
                "date": existing.get(
                    "date"
                ),
                "oldStatus": old_status,
                "newStatus": new_status,
                "detectedAt": now,
                "source": "admin",
            }
        )

        self.db[
            ATTENDANCE_RECORDS
        ].update_one(
            {
                "_id": object_id,
            },
            {
                "$set": {
                    "status": new_status,
                    "source": "admin",
                    "updatedAt": now,
                }
            },
        )

        try:
            self.notification_service.create_attendance_notification(
                student_id=existing[
                    "studentId"
                ],
                subject_id=existing.get(
                    "subjectId"
                ),
                subject_name=subject_name,
                date=existing.get(
                    "date"
                ),
                old_status=old_status,
                new_status=new_status,
            )

        except Exception:
            pass

        updated = self.db[
            ATTENDANCE_RECORDS
        ].find_one(
            {
                "_id": object_id,
            }
        )

        if not updated:
            raise HTTPException(
                status_code=500,
                detail="Updated attendance record could not be read.",
            )

        return self._with_subject_cached(
            updated,
            self._build_subject_cache(),
        )

    # =========================================================
    # SUBJECT UPSERT
    # =========================================================

    def _upsert_subject(
        self,
        student_id: str,
        name: str,
        code: str | None = None,
        subject_id: str | None = None,
        source: str = "parent_portal",
    ) -> dict:

        student_id = self._string_id(student_id)
        if not student_id:
            raise HTTPException(status_code=400, detail="Student ID is required for a portal course.")

        name = self._normalize_subject_name(
            name
        )

        code = self._normalize_code(
            code
        )

        source = self._normalize_source(
            source
        )

        if self._is_placeholder_subject(
            name,
            code,
        ):
            raise HTTPException(
                status_code=400,
                detail=(
                    "Invalid subject received "
                    "from portal."
                ),
            )

        collection = self.db[
            SUBJECTS
        ]

        now = utc_now()

        existing = None

        # -----------------------------------------------------
        # Try supplied Mongo ObjectId.
        # -----------------------------------------------------

        supplied_object_id = (
            self._object_id(
                subject_id
            )
        )

        if supplied_object_id:
            existing = collection.find_one(
                {
                    "_id": supplied_object_id,
                    "studentId": student_id,
                }
            )

        # -----------------------------------------------------
        # Try string ID.
        # -----------------------------------------------------

        if existing is None and subject_id:
            existing = collection.find_one(
                {
                    "id": str(subject_id),
                    "studentId": student_id,
                }
            )

        # -----------------------------------------------------
        # Try code.
        # -----------------------------------------------------

        if existing is None and code:
            existing = collection.find_one(
                {
                    "code": code,
                    "studentId": student_id,
                }
            )

        # -----------------------------------------------------
        # Try exact name.
        # -----------------------------------------------------

        if existing is None:
            existing = collection.find_one(
                {
                    "name": name,
                    "studentId": student_id,
                    **({"$or": [{"code": None}, {"code": ""}, {"code": code}]} if code else {}),
                }
            )

        # -----------------------------------------------------
        # Try case-insensitive name.
        # -----------------------------------------------------

        if existing is None:
            existing = collection.find_one(
                {
                    "studentId": student_id,
                    **({"$or": [{"code": None}, {"code": ""}, {"code": code}]} if code else {}),
                    "name": {
                        "$regex": (
                            "^"
                            + self._escape_regex(
                                name
                            )
                            + "$"
                        ),
                        "$options": "i",
                    }
                }
            )

        # -----------------------------------------------------
        # Update existing subject.
        # -----------------------------------------------------

        if existing:

            update_data = {
                "name": name,
                "active": True,
                "source": source,
                "updatedAt": now,
            }

            if code:
                update_data[
                    "code"
                ] = code

            try:
                collection.update_one(
                    {
                        "_id": existing[
                            "_id"
                        ]
                    },
                    {
                        "$set": update_data
                    },
                )

            except DuplicateKeyError:

                if code:
                    existing_by_code = (
                        collection.find_one(
                            {
                                "code": code,
                                "studentId": student_id,
                            }
                        )
                    )

                    if existing_by_code:
                        return serialize_document(
                            existing_by_code
                        )

                raise

            updated = collection.find_one(
                {
                    "_id": existing[
                        "_id"
                    ]
                }
            )

            if updated:
                return serialize_document(
                    updated
                )

            raise HTTPException(
                status_code=500,
                detail=(
                    "Subject could not be "
                    "read after update."
                ),
            )

        # -----------------------------------------------------
        # Create new subject.
        # -----------------------------------------------------

        document = {
            "studentId": student_id,
            "name": name,
            "active": True,
            "source": source,
            "createdAt": now,
            "updatedAt": now,
        }

        if code:
            document[
                "code"
            ] = code

        if subject_id:
            document[
                "portalSubjectId"
            ] = str(subject_id)

        try:

            result = collection.insert_one(
                document
            )

        except DuplicateKeyError:

            if code:
                existing = collection.find_one(
                    {
                        "code": code,
                        "studentId": student_id,
                    }
                )

                if existing:
                    return serialize_document(
                        existing
                    )

            existing = collection.find_one(
                {
                    "name": name,
                    "studentId": student_id,
                }
            )

            if existing:
                return serialize_document(
                    existing
                )

            raise HTTPException(
                status_code=500,
                detail=(
                    f"Unable to create subject "
                    f"'{name}'."
                ),
            )

        created = collection.find_one(
            {
                "_id": result.inserted_id,
            }
        )

        if not created:
            raise HTTPException(
                status_code=500,
                detail=(
                    "Unable to read newly "
                    "created subject."
                ),
            )

        return serialize_document(
            created
        )
