from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from pymongo.database import Database

from app.models.timetable import TIMETABLE


# =========================================================
# TIMETABLE SYNC SERVICE
# =========================================================


def _utc_now() -> datetime:
    """
    Return current UTC datetime.
    """
    return datetime.now(timezone.utc)


def _record_key(
    record: dict[str, Any],
) -> tuple:
    """
    Unique identity for one timetable entry.
    """

    return (
        record.get("studentId"),
        record.get("day"),
        record.get("subjectCode"),
        record.get("subjectName"),
        record.get("startTime"),
        record.get("endTime"),
        record.get("room"),
    )


def _save_timetable_metadata(
    student_id: str,
    details: dict[str, Any],
    db: Database,
) -> None:
    """
    Save non-row timetable information.

    Stores:
        - Student Profile
        - Your Bucket
        - Course Registered Details

    These details are stored separately from the individual
    timetable rows so that the same information is not
    duplicated into every timetable record.
    """

    profile = details.get(
        "profile",
        {},
    )

    if not isinstance(
        profile,
        dict,
    ):
        profile = {}

    bucket = details.get(
        "bucket"
    )

    courses = details.get(
        "courses",
        [],
    )

    if not isinstance(
        courses,
        list,
    ):
        courses = []

    now = _utc_now()

    metadata = {
        "studentId": student_id,

        "profile": profile,

        "bucket": bucket,

        "courses": courses,

        "active": True,

        "source": "ams",

        "updatedAt": now,
    }

    collection = db[
        "timetable_metadata"
    ]

    existing = collection.find_one(
        {
            "studentId": student_id,
            "source": "ams",
        }
    )

    if existing:

        collection.update_one(
            {
                "_id": existing["_id"],
            },
            {
                "$set": metadata,
            },
        )

    else:

        metadata[
            "createdAt"
        ] = now

        collection.insert_one(
            metadata
        )


# =========================================================
# TIMETABLE SYNC
# =========================================================


async def sync_timetable(
    student_id: str,
    session: dict[str, Any],
    ams_adapter: Any,
    db: Database,
) -> dict[str, Any]:
    """
    Fetch timetable from AMS and synchronize it
    with MongoDB.

    Parameters
    ----------
    student_id:
        Application student ID.

    session:
        Existing authenticated AMS session returned
        by AmsAdapter.login().

    ams_adapter:
        Existing AmsAdapter instance.

    db:
        MongoDB database.

    IMPORTANT:
        This service handles ONLY timetable data.

        It does NOT:
        - access attendance
        - modify attendance
        - modify users
        - modify subjects
    """

    # =====================================================
    # 1. GET COMPLETE TIMETABLE INFORMATION FROM AMS
    # =====================================================

    details: dict[str, Any] = {}

    # -----------------------------------------------------
    # New complete timetable method
    # -----------------------------------------------------

    if hasattr(
        ams_adapter,
        "get_timetable_details",
    ):

        details_result = (
            await ams_adapter
            .get_timetable_details(
                session
            )
        )

        if isinstance(
            details_result,
            dict,
        ):
            details = details_result

        records = details.get(
            "timetable",
            [],
        )

    # -----------------------------------------------------
    # Backward compatibility
    # -----------------------------------------------------
    #
    # If the existing adapter does not yet contain
    # get_timetable_details(), continue using the existing
    # get_timetable() method.
    #

    else:

        records = (
            await ams_adapter.get_timetable(
                session
            )
        )

    # =====================================================
    # 2. VALIDATE AMS RESPONSE
    # =====================================================

    if not records:

        # -------------------------------------------------
        # Save profile/course metadata if AMS returned it.
        # -------------------------------------------------

        if details:

            _save_timetable_metadata(
                student_id=student_id,
                details=details,
                db=db,
            )

        return {
            "success": False,
            "message": (
                "No timetable records were found "
                "from AMS."
            ),
            "inserted": 0,
            "updated": 0,
            "deactivated": 0,
            "total": 0,
            "profile": details.get(
                "profile",
                {},
            ),
            "bucket": details.get(
                "bucket"
            ),
            "courses": details.get(
                "courses",
                [],
            ),
        }

    collection = db[
        TIMETABLE
    ]

    inserted = 0
    updated = 0
    deactivated = 0

    current_keys: set[
        tuple
    ] = set()

    # =====================================================
    # 3. SAVE PROFILE / BUCKET / COURSES
    # =====================================================

    if details:

        _save_timetable_metadata(
            student_id=student_id,
            details=details,
            db=db,
        )

    # =====================================================
    # 4. GET ACADEMIC INFORMATION
    # =====================================================

    profile = details.get(
        "profile",
        {},
    )

    if not isinstance(
        profile,
        dict,
    ):
        profile = {}

    semester = (
        profile.get(
            "semester"
        )
        or profile.get(
            "Semester"
        )
    )

    branch = (
        profile.get(
            "branch"
        )
        or profile.get(
            "Branch"
        )
    )

    section = (
        profile.get(
            "section"
        )
        or profile.get(
            "Section"
        )
    )

    bucket = details.get(
        "bucket"
    )

    # =====================================================
    # 5. PROCESS AMS RECORDS
    # =====================================================

    for record in records:

        if not isinstance(
            record,
            dict,
        ):
            continue

        now = _utc_now()

        document = {
            # ---------------------------------------------
            # STUDENT
            # ---------------------------------------------

            "studentId": student_id,

            # ---------------------------------------------
            # PROFILE INFORMATION
            # ---------------------------------------------

            "idNumber": (
                profile.get(
                    "idNumber"
                )
            ),

            "studentName": (
                profile.get(
                    "name"
                )
                or profile.get(
                    "studentName"
                )
            ),

            "rollNumber": (
                profile.get(
                    "rollNumber"
                )
            ),

            "degree": (
                profile.get(
                    "degree"
                )
            ),

            "batch": (
                profile.get(
                    "batch"
                )
            ),

            "regulation": (
                profile.get(
                    "regulation"
                )
            ),

            # ---------------------------------------------
            # ACADEMIC
            # ---------------------------------------------

            "semester": (
                record.get(
                    "semester"
                )
                or semester
            ),

            "branch": (
                record.get(
                    "branch"
                )
                or branch
            ),

            "section": (
                record.get(
                    "section"
                )
                or section
            ),

            # ---------------------------------------------
            # BUCKET
            # ---------------------------------------------

            "bucket": bucket,

            # ---------------------------------------------
            # TIMETABLE
            # ---------------------------------------------

            "day": (
                record.get(
                    "day",
                    "",
                )
            ),

            "slot": (
                record.get(
                    "slot"
                )
            ),

            "subjectId": (
                record.get(
                    "subjectId"
                )
            ),

            "subjectCode": (
                record.get(
                    "subjectCode"
                )
            ),

            "subjectName": (
                record.get(
                    "subjectName"
                )
                or record.get(
                    "courseName"
                )
            ),

            "courseName": (
                record.get(
                    "courseName"
                )
                or record.get(
                    "subjectName"
                )
            ),

            "faculty": (
                record.get(
                    "faculty"
                )
                or record.get(
                    "facultyName"
                )
            ),

            "facultyId": (
                record.get(
                    "facultyId"
                )
            ),

            "startTime": (
                record.get(
                    "startTime"
                )
            ),

            "endTime": (
                record.get(
                    "endTime"
                )
            ),

            "room": (
                record.get(
                    "room"
                )
            ),

            # ---------------------------------------------
            # COURSE INFORMATION
            # ---------------------------------------------

            "category": (
                record.get(
                    "category"
                )
            ),

            "credit": (
                record.get(
                    "credit"
                )
            ),

            # ---------------------------------------------
            # STATUS
            # ---------------------------------------------

            "active": True,

            "source": "ams",

            "updatedAt": now,
        }

        # =================================================
        # 6. CREATE UNIQUE KEY
        # =================================================

        key = _record_key(
            document
        )

        # -------------------------------------------------
        # Prevent duplicate AMS records in same response.
        # -------------------------------------------------

        if key in current_keys:
            continue

        current_keys.add(
            key
        )

        # =================================================
        # 7. FIND EXISTING AMS RECORD
        # =================================================

        query = {
            "studentId": student_id,

            "source": "ams",

            "day": document.get(
                "day"
            ),

            "subjectCode": document.get(
                "subjectCode"
            ),

            "subjectName": document.get(
                "subjectName"
            ),

            "startTime": document.get(
                "startTime"
            ),

            "endTime": document.get(
                "endTime"
            ),

            "room": document.get(
                "room"
            ),
        }

        existing = (
            collection.find_one(
                query
            )
        )

        # =================================================
        # 8. UPDATE EXISTING RECORD
        # =================================================

        if existing:

            collection.update_one(
                {
                    "_id": existing[
                        "_id"
                    ]
                },
                {
                    "$set": document
                },
            )

            updated += 1

        # =================================================
        # 9. INSERT NEW RECORD
        # =================================================

        else:

            document[
                "createdAt"
            ] = now

            collection.insert_one(
                document
            )

            inserted += 1

    # =====================================================
    # 10. DEACTIVATE OLD AMS TIMETABLE RECORDS
    # =====================================================
    #
    # IMPORTANT:
    #
    # Only:
    #
    #   studentId = current student
    #   source = ams
    #   active = true
    #
    # are considered.
    #
    # Attendance is completely untouched.
    # =====================================================

    existing_records = (
        collection.find(
            {
                "studentId": student_id,
                "source": "ams",
                "active": True,
            }
        )
    )

    for existing in existing_records:

        existing_key = _record_key(
            existing
        )

        if (
            existing_key
            not in current_keys
        ):

            collection.update_one(
                {
                    "_id": existing[
                        "_id"
                    ]
                },
                {
                    "$set": {
                        "active": False,
                        "updatedAt": _utc_now(),
                    }
                },
            )

            deactivated += 1

    # =====================================================
    # 11. RETURN RESULT
    # =====================================================

    return {
        "success": True,

        "message": (
            "Timetable synchronized successfully."
        ),

        "inserted": inserted,

        "updated": updated,

        "deactivated": deactivated,

        "total": len(
            current_keys
        ),

        # -------------------------------------------------
        # Complete AMS information
        # -------------------------------------------------

        "profile": details.get(
            "profile",
            {},
        ),

        "bucket": details.get(
            "bucket"
        ),

        "courses": details.get(
            "courses",
            [],
        ),

        "timetable": (
            details.get(
                "timetable",
                records,
            )
        ),
    }