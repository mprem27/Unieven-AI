from __future__ import annotations

import logging

from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException
from pymongo.database import Database

from app.config.database import get_db
from app.models.timetable import TIMETABLE
from app.models.user import USERS
from app.security.permissions import require_student
from app.security.portal_credentials import decrypt_portal_password
from app.services.base import serialize_document
from app.services.timetable_service import TimetableService
from app.services.ams.ams_adapter import AmsAdapter


logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/timetable",
    tags=["timetable"],
)


def first_value(*values):
    for value in values:
        if value is None:
            continue

        if isinstance(value, str):
            text = value.strip()

            if text:
                return text

        else:
            text = str(value).strip()

            if text:
                return value

    return None


def normalize_courses(courses, records):
    if isinstance(courses, list) and courses:
        return courses

    course_map = {}

    for record in records:
        if not isinstance(record, dict):
            continue

        subject_code = first_value(
            record.get("subjectCode"),
            record.get("subject_code"),
            record.get("courseCode"),
            record.get("course_code"),
            record.get("subjectId"),
            record.get("subject_id"),
        )

        subject_name = first_value(
            record.get("subjectName"),
            record.get("subject_name"),
            record.get("courseName"),
            record.get("course_name"),
            record.get("subject"),
        )

        if not subject_code and not subject_name:
            continue

        key = str(
            subject_code or subject_name
        ).strip().upper()

        if key in course_map:
            continue

        course_map[key] = {
            "subjectId": first_value(
                record.get("subjectId"),
                record.get("subject_id"),
            ),
            "subjectCode": subject_code,
            "subjectName": subject_name,
            "courseName": first_value(
                record.get("courseName"),
                record.get("course_name"),
                subject_name,
            ),
            "faculty": first_value(
                record.get("faculty"),
                record.get("facultyName"),
                record.get("faculty_name"),
            ),
            "facultyId": first_value(
                record.get("facultyId"),
                record.get("faculty_id"),
            ),
            "category": record.get("category"),
            "credit": first_value(
                record.get("credit"),
                record.get("credits"),
            ),
        }

    return list(course_map.values())


def build_profile(
    student,
    service_profile,
    records,
):
    service_profile = (
        service_profile
        if isinstance(service_profile, dict)
        else {}
    )

    first_record = {}

    for record in records:
        if isinstance(record, dict):
            first_record = record
            break

    return {
        "idNumber": first_value(
            service_profile.get("idNumber"),
            service_profile.get("id_number"),
            service_profile.get("vtuNumber"),
            service_profile.get("vtu_number"),
            service_profile.get("studentId"),
            service_profile.get("student_id"),
            service_profile.get("username"),
            first_record.get("idNumber"),
            first_record.get("id_number"),
            student.get("idNumber"),
            student.get("id_number"),
            student.get("vtuNumber"),
        ),
        "studentName": first_value(
            service_profile.get("studentName"),
            service_profile.get("student_name"),
            service_profile.get("name"),
            service_profile.get("fullName"),
            service_profile.get("full_name"),
            first_record.get("studentName"),
            first_record.get("student_name"),
            first_record.get("name"),
            student.get("name"),
        ),
        "rollNumber": first_value(
            service_profile.get("rollNumber"),
            service_profile.get("roll_number"),
            service_profile.get("rollNo"),
            first_record.get("rollNumber"),
            first_record.get("roll_number"),
            first_record.get("rollNo"),
            student.get("rollNumber"),
        ),
        "degree": first_value(
            service_profile.get("degree"),
            first_record.get("degree"),
            student.get("degree"),
        ),
        "batch": first_value(
            service_profile.get("batch"),
            first_record.get("batch"),
            student.get("batch"),
        ),
        "regulation": first_value(
            service_profile.get("regulation"),
            first_record.get("regulation"),
            student.get("regulation"),
        ),
        "semester": first_value(
            service_profile.get("semester"),
            first_record.get("semester"),
            student.get("semester"),
        ),
        "branch": first_value(
            service_profile.get("branch"),
            first_record.get("branch"),
            student.get("branch"),
        ),
        "section": first_value(
            service_profile.get("section"),
            first_record.get("section"),
            student.get("section"),
        ),
        "bucket": first_value(
            service_profile.get("bucket"),
            service_profile.get("Bucket"),
            first_record.get("bucket"),
            first_record.get("Bucket"),
            student.get("bucket"),
            student.get("Bucket"),
        ),
    }


def get_bucket(
    student,
    service_result,
    profile,
    records,
):
    result_bucket = None

    if isinstance(service_result, dict):
        result_bucket = first_value(
            service_result.get("bucket"),
            service_result.get("Bucket"),
        )

    profile_bucket = (
        profile.get("bucket")
        if isinstance(profile, dict)
        else None
    )

    for record in records:
        if not isinstance(record, dict):
            continue

        record_bucket = first_value(
            record.get("bucket"),
            record.get("Bucket"),
        )

        if record_bucket:
            return record_bucket

    return first_value(
        result_bucket,
        profile_bucket,
        student.get("bucket"),
        student.get("Bucket"),
    )


def normalize_timetable_record(
    record,
    student_id,
    profile,
    bucket,
):
    if not isinstance(record, dict):
        return None

    day = first_value(
        record.get("day"),
        record.get("Day"),
        record.get("weekday"),
        record.get("weekDay"),
        record.get("week_day"),
    )

    subject_code = first_value(
        record.get("subjectCode"),
        record.get("subject_code"),
        record.get("courseCode"),
        record.get("course_code"),
    )

    subject_name = first_value(
        record.get("subjectName"),
        record.get("subject_name"),
        record.get("courseName"),
        record.get("course_name"),
        record.get("subject"),
    )

    start_time = first_value(
        record.get("startTime"),
        record.get("start_time"),
        record.get("StartTime"),
        record.get("fromTime"),
        record.get("from_time"),
        record.get("from"),
        record.get("start"),
    )

    end_time = first_value(
        record.get("endTime"),
        record.get("end_time"),
        record.get("EndTime"),
        record.get("toTime"),
        record.get("to_time"),
        record.get("to"),
        record.get("end"),
    )

    faculty = first_value(
        record.get("faculty"),
        record.get("facultyName"),
        record.get("faculty_name"),
    )

    room = first_value(
        record.get("room"),
        record.get("roomNumber"),
        record.get("roomNo"),
        record.get("room_number"),
    )

    slot = first_value(
        record.get("slot"),
        record.get("period"),
        record.get("Period"),
        record.get("periodNumber"),
        record.get("period_number"),
        record.get("periodName"),
        record.get("period_name"),
    )

    subject_id = first_value(
        record.get("subjectId"),
        record.get("subject_id"),
    )

    semester = first_value(
        record.get("semester"),
        record.get("Semester"),
        profile.get("semester"),
    )

    branch = first_value(
        record.get("branch"),
        record.get("Branch"),
        profile.get("branch"),
    )

    section = first_value(
        record.get("section"),
        record.get("Section"),
        profile.get("section"),
    )

    return {
        **record,
        "studentId": student_id,
        "day": day,
        "slot": slot,
        "subjectId": subject_id,
        "subjectCode": subject_code,
        "subjectName": subject_name,
        "courseName": first_value(
            record.get("courseName"),
            record.get("course_name"),
            subject_name,
        ),
        "faculty": faculty,
        "facultyId": first_value(
            record.get("facultyId"),
            record.get("faculty_id"),
        ),
        "startTime": start_time,
        "endTime": end_time,
        "room": room,
        "semester": semester,
        "branch": branch,
        "section": section,
        "bucket": bucket,
        "active": True,
        "source": "ams",
    }


@router.get("")
def get_timetable(
    current_user: dict = Depends(require_student),
    db: Database = Depends(get_db),
):
    student_id = str(
        current_user["id"]
    )

    records = (
        db[TIMETABLE]
        .find(
            {
                "studentId": student_id,
                "active": True,
            }
        )
        .sort(
            [
                ("day", 1),
                ("startTime", 1),
            ]
        )
    )

    return [
        serialize_document(record)
        for record in records
    ]


@router.post("/sync")
async def sync_timetable(
    current_user: dict = Depends(require_student),
    db: Database = Depends(get_db),
):
    student_id = str(
        current_user["id"]
    )

    if not student_id:
        raise HTTPException(
            status_code=401,
            detail="Student identity is missing.",
        )

    student = None

    try:
        student = db[USERS].find_one(
            {
                "_id": ObjectId(student_id),
                "role": "student",
                "active": True,
            }
        )
    except Exception:
        student = None

    if student is None:
        student = db[USERS].find_one(
            {
                "id": student_id,
                "role": "student",
                "active": True,
            }
        )

    if not student:
        raise HTTPException(
            status_code=404,
            detail="Authenticated student was not found.",
        )

    username = str(
        first_value(
            student.get("portalUsername"),
            student.get("portal_username"),
            student.get("vtuNumber"),
            student.get("vtu_number"),
        )
        or ""
    ).strip().upper()

    if not username:
        raise HTTPException(
            status_code=400,
            detail=(
                "AMS credentials are not configured "
                "for this student."
            ),
        )

    encrypted_password = first_value(
        student.get("portalPasswordEncrypted"),
        student.get("portal_password_encrypted"),
    )

    if not encrypted_password:
        raise HTTPException(
            status_code=400,
            detail=(
                "AMS password is not configured "
                "for this student."
            ),
        )

    try:
        password = decrypt_portal_password(
            encrypted_password
        )
    except Exception as exc:
        logger.exception(
            "Unable to decrypt AMS password for student %s",
            student_id,
        )

        raise HTTPException(
            status_code=500,
            detail=(
                "Unable to decrypt this student's "
                "AMS password."
            ),
        ) from exc

    if not password:
        raise HTTPException(
            status_code=400,
            detail=(
                "AMS password is not configured "
                "for this student."
            ),
        )

    adapter = AmsAdapter()
    session = None

    try:
        logger.info(
            "Starting timetable AMS sync for student=%s username=%s",
            student_id,
            username,
        )

        session = await adapter.login(
            username=username,
            password=password,
            vtu_number=username,
        )

        if not session:
            raise HTTPException(
                status_code=502,
                detail=(
                    "AMS login failed. "
                    "No valid AMS session was created."
                ),
            )

        logger.info(
            "AMS login successful for timetable sync: student=%s",
            student_id,
        )

        service = TimetableService(
            db=db,
            ams_adapter=adapter,
        )

        base_profile = {
            "idNumber": student.get(
                "vtuNumber"
            ),
            "studentName": student.get(
                "name"
            ),
            "rollNumber": student.get(
                "rollNumber"
            ),
            "degree": student.get(
                "degree"
            ),
            "batch": student.get(
                "batch"
            ),
            "regulation": student.get(
                "regulation"
            ),
            "semester": student.get(
                "semester"
            ),
            "branch": student.get(
                "branch"
            ),
            "section": student.get(
                "section"
            ),
            "bucket": student.get(
                "bucket"
            ),
        }

        result = await service.sync_timetable(
            student_id=student_id,
            session=session,
            profile=base_profile,
        )

        if not isinstance(result, dict):
            result = {
                "timetable": (
                    result
                    if isinstance(result, list)
                    else []
                ),
                "profile": {},
                "bucket": None,
                "courses": [],
                "inserted": 0,
                "updated": 0,
                "deactivated": 0,
            }

        result_records = result.get(
            "timetable",
            [],
        )

        if not isinstance(
            result_records,
            list,
        ):
            result_records = []

        service_profile = result.get(
            "profile",
            {},
        )

        if not isinstance(
            service_profile,
            dict,
        ):
            service_profile = {}

        service_courses = result.get(
            "courses",
            [],
        )

        if not isinstance(
            service_courses,
            list,
        ):
            service_courses = []

        bucket = result.get(
            "bucket"
        )

        normalized_records = []

        for record in result_records:
            normalized = normalize_timetable_record(
                record=record,
                student_id=student_id,
                profile=service_profile,
                bucket=bucket,
            )

            if normalized:
                normalized_records.append(
                    normalized
                )

        profile = build_profile(
            student=student,
            service_profile=service_profile,
            records=normalized_records,
        )

        bucket = get_bucket(
            student=student,
            service_result=result,
            profile=profile,
            records=normalized_records,
        )

        profile["bucket"] = bucket

        for record in normalized_records:
            record["bucket"] = bucket

        courses = normalize_courses(
            service_courses,
            normalized_records,
        )

        serialized_records = [
            serialize_document(record)
            for record in normalized_records
        ]

        return {
            "success": True,
            "message": (
                "Timetable synchronized successfully."
            ),
            "studentId": student_id,
            "username": username,
            "total": len(
                serialized_records
            ),
            "inserted": result.get(
                "inserted",
                0,
            ),
            "updated": result.get(
                "updated",
                0,
            ),
            "deactivated": result.get(
                "deactivated",
                0,
            ),
            "profile": profile,
            "bucket": bucket,
            "courses": courses,
            "data": serialized_records,
            "timetable": serialized_records,
        }

    except HTTPException:
        raise

    except Exception as exc:
        logger.exception(
            "Timetable synchronization failed for student=%s",
            student_id,
        )

        raise HTTPException(
            status_code=502,
            detail=(
                "Timetable synchronization failed: "
                f"{type(exc).__name__}: {str(exc)}"
            ),
        ) from exc

    finally:
        if session:
            try:
                await adapter.logout(
                    session
                )
            except Exception as exc:
                logger.warning(
                    "AMS logout failed after timetable sync: %s",
                    exc,
                )