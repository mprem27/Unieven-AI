from __future__ import annotations

from typing import Any

from bson import ObjectId
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, status
from pymongo.database import Database

from app.config.database import get_db
from app.models.attendance import ATTENDANCE_RECORDS
from app.models.attendance_change import ATTENDANCE_CHANGES
from app.models.audit_log import AUDIT_LOGS
from app.models.notification import NOTIFICATIONS, SMS_LOGS
from app.models.subject import SUBJECTS
from app.models.timetable import TIMETABLE
from app.schemas.admin import (
    AdminAttendanceCreate,
    AdminAttendanceUpdate,
    AdminPasswordReset,
    AdminSubjectCreate,
    AdminSubjectUpdate,
    AdminTimetableCreate,
    AdminTimetableUpdate,
)
from app.schemas.attendance import SyncRequest, SyncResult
from app.schemas.user import UserCreate, UserPublic, UserUpdate
from app.security.permissions import require_admin
from app.services.auth_service import AuthService
from app.services.attendance_service import AttendanceService
from app.services.base import serialize_document
from app.services.student_service import StudentService
from app.services.user_service import UserService
from app.scheduler.attendance_sync import AttendanceSyncRunner

router = APIRouter(
    prefix="/admin",
    tags=["admin"],
)


# =========================================================
# HELPERS
# =========================================================

def _extract_id(document: Any) -> str | None:
    if not document:
        return None

    if isinstance(document, dict):
        value = document.get("id")

        if value is not None:
            return str(value)

        value = document.get("_id")

        if value is not None:
            return str(value)

    return None


def _ensure_student_id(student: dict) -> str | None:
    if not student:
        return None

    student_id = _extract_id(student)

    if student_id:
        student["id"] = student_id

    return student_id


def _clean_response(value: Any):
    try:
        return serialize_document(value)
    except Exception:
        return value


# =========================================================
# USERS
# =========================================================

@router.get(
    "/users",
    response_model=list[UserPublic],
)
def list_users(
    _admin: dict = Depends(require_admin),
    db: Database = Depends(get_db),
):
    return UserService(db).list_users()


# =========================================================
# GET SINGLE USER
# =========================================================

@router.get(
    "/users/{user_id}",
    response_model=UserPublic,
)
def get_user(
    user_id: str,
    _admin: dict = Depends(require_admin),
    db: Database = Depends(get_db),
):
    return UserService(db).get_user(user_id)


# =========================================================
# USER-BASED STUDENT DATA COMPATIBILITY ROUTES
# =========================================================

@router.get(
    "/users/{student_id}/attendance",
)
def user_student_attendance(
    student_id: str,
    _admin: dict = Depends(require_admin),
    db: Database = Depends(get_db),
):
    return AttendanceService(db).list_records(student_id)


@router.get(
    "/users/{student_id}/attendance/summary",
)
def user_student_attendance_summary(
    student_id: str,
    _admin: dict = Depends(require_admin),
    db: Database = Depends(get_db),
):
    return AttendanceService(db).summary(student_id)


@router.get(
    "/users/{student_id}/attendance/changes",
)
def user_student_attendance_changes(
    student_id: str,
    _admin: dict = Depends(require_admin),
    db: Database = Depends(get_db),
):
    return AttendanceService(db).list_changes(student_id)


@router.get(
    "/users/{student_id}/subjects",
)
def user_student_subjects(
    student_id: str,
    _admin: dict = Depends(require_admin),
    db: Database = Depends(get_db),
):
    return StudentService(db).get_student_associated_subjects(student_id)


@router.get(
    "/users/{student_id}/timetable",
)
def user_student_timetable(
    student_id: str,
    _admin: dict = Depends(require_admin),
    db: Database = Depends(get_db),
):
    records = (
        db[TIMETABLE]
        .find({"studentId": student_id})
        .sort([("day", 1), ("startTime", 1)])
    )

    return [
        serialize_document(record)
        for record in records
    ]


@router.get(
    "/users/{student_id}/notifications",
)
def user_student_notifications(
    student_id: str,
    _admin: dict = Depends(require_admin),
    db: Database = Depends(get_db),
):
    notifications = (
        db[NOTIFICATIONS]
        .find({"studentId": student_id})
        .sort("createdAt", -1)
        .limit(100)
    )

    return [
        serialize_document(notification)
        for notification in notifications
    ]


# =========================================================
# CREATE USER
# =========================================================

@router.post(
    "/users",
    status_code=status.HTTP_201_CREATED,
)
async def create_user(
    payload: UserCreate,
    _admin: dict = Depends(require_admin),
    db: Database = Depends(get_db),
):
    """
    Create a student without requiring AMS credentials.

    AMS credentials are optional during creation.

    If AMS credentials are supplied:
        - VTU number is the AMS username.
        - Credentials are validated before creation.
        - Valid credentials are stored by UserService.
        - The frontend can start synchronization afterward.

    If AMS credentials are not supplied:
        - Student is still created.
        - No AMS synchronization is started.
        - Student can configure AMS later from student login.
    """

    user_service = UserService(db)

    try:
        created_student = await user_service.create_user(
            payload
        )

        student = serialize_document(
            created_student
        )

        if not isinstance(student, dict):
            raise RuntimeError(
                "UserService returned an invalid student object."
            )

        student_id = _ensure_student_id(
            student
        )

        if not student_id and student.get("email"):
            found_student = db["users"].find_one(
                {
                    "email": student["email"]
                }
            )

            if found_student:
                student = serialize_document(
                    found_student
                )
                student_id = _ensure_student_id(
                    student
                )

        if not student_id:
            raise RuntimeError(
                "Student was created but the student ID "
                "could not be determined."
            )

        ams_configured = bool(
            student.get(
                "portalCredentialsConfigured",
                False,
            )
        )

        return {
            "success": True,
            "message": (
                "Student account created successfully."
            ),
            "studentId": student_id,
            "id": student_id,
            "student": student,
            "amsConfigured": ams_configured,
            "syncRequired": (
                student.get("role") == "student"
                and ams_configured
            ),
            "syncEndpoint": (
                f"/api/v1/admin/students/"
                f"{student_id}/sync-profile"
            ),
        }

    except HTTPException:
        raise

    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(exc),
        ) from exc


# =========================================================
# UPDATE USER
# =========================================================

@router.put(
    "/users/{user_id}",
    response_model=UserPublic,
)
async def update_user(
    user_id: str,
    payload: UserUpdate,
    _admin: dict = Depends(require_admin),
    db: Database = Depends(get_db),
):
    return await UserService(db).update_user(
        user_id,
        payload,
    )


# =========================================================
# DELETE USER
# =========================================================

@router.delete(
    "/users/{user_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def delete_user(
    user_id: str,
    _admin: dict = Depends(require_admin),
    db: Database = Depends(get_db),
):
    UserService(db).delete_user(user_id)
    return None


# =========================================================
# ACTIVATE USER
# =========================================================

@router.post(
    "/users/{user_id}/activate",
    response_model=UserPublic,
)
def activate_user(
    user_id: str,
    _admin: dict = Depends(require_admin),
    db: Database = Depends(get_db),
):
    return UserService(db).activate_user(user_id)


# =========================================================
# ADMIN PASSWORD RESET
# =========================================================

@router.post(
    "/users/{user_id}/reset-password",
    status_code=status.HTTP_204_NO_CONTENT,
)
def reset_password(
    user_id: str,
    payload: AdminPasswordReset,
    _admin: dict = Depends(require_admin),
    db: Database = Depends(get_db),
):
    AuthService(db).reset_password(
        user_id,
        payload.newPassword,
    )

    return None


# =========================================================
# STUDENT PORTAL SYNCHRONIZATION
# =========================================================

@router.post(
    "/students/{student_id}/sync-profile",
)
async def sync_student_profile(
    student_id: str,
    background_tasks: BackgroundTasks,
    _admin: dict = Depends(require_admin),
    db: Database = Depends(get_db),
):
    """
    Start one live AMS + Parent Portal synchronization.

    The HTTP request returns immediately.

    AMS credentials are required for synchronization.

    Parent Portal:
        username = VTU number
        password = NOT REQUIRED
    """

    user_service = UserService(db)

    try:
        student = user_service.get_user(
            student_id
        )
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Student not found: {exc}",
        ) from exc

    if not student:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Student not found.",
        )

    if student.get("role") != "student":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Selected user is not a student.",
        )

    student_service = StudentService(db)

    # =====================================================
    # PORTAL IDENTIFIER
    # =====================================================

    vtu_number = str(
        student.get("vtuNumber")
        or student.get("portalUsername")
        or ""
    ).strip()

    if not vtu_number:
        return {
            "success": False,
            "message": (
                "VTU number is not configured. "
                "Student can add AMS credentials later."
            ),
            "studentId": student_id,
            "id": student_id,
            "syncStarted": False,
            "syncInProgress": False,
            "amsConfigured": False,
        }

    student["vtuNumber"] = vtu_number
    student["portalUsername"] = vtu_number

    try:
        object_id = ObjectId(student_id)
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid student ID.",
        ) from exc

    db["users"].update_one(
        {"_id": object_id},
        {
            "$set": {
                "vtuNumber": vtu_number,
                "portalUsername": vtu_number,
            }
        },
    )

    # =====================================================
    # CHECK AMS CREDENTIALS
    # =====================================================

    try:
        credential_status = (
            student_service.verify_portal_credentials(
                student
            )
        )
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=(
                "Unable to check portal credentials: "
                f"{exc}"
            ),
        ) from exc

    if not credential_status.get("configured"):
        return {
            "success": False,
            "message": (
                "AMS credentials are not configured. "
                "The student can add the AMS password later "
                "from the student login."
            ),
            "studentId": student_id,
            "id": student_id,
            "student": student,
            "syncStarted": False,
            "syncInProgress": False,
            "amsConfigured": False,
            "parentPortalPasswordRequired": False,
        }

    # =====================================================
    # PREVENT DOUBLE SYNC
    # =====================================================

    existing = db["users"].find_one(
        {
            "_id": object_id,
            "portalSyncInProgress": True,
        }
    )

    if existing:
        return {
            "success": True,
            "message": (
                "Portal synchronization is already running."
            ),
            "studentId": student_id,
            "id": student_id,
            "syncStarted": False,
            "syncInProgress": True,
            "amsConfigured": True,
        }

    db["users"].update_one(
        {"_id": object_id},
        {
            "$set": {
                "portalSyncInProgress": True,
                "portalSyncLastError": None,
            }
        },
    )

    async def _run_sync():
        try:
            runner = AttendanceSyncRunner(db)

            result = await runner.sync_single_student(
                student_id
            )

            db["users"].update_one(
                {"_id": object_id},
                {
                    "$set": {
                        "portalSyncInProgress": False,
                        "portalLastSyncResult": result,
                    }
                },
            )

        except Exception as exc:
            try:
                db["users"].update_one(
                    {"_id": object_id},
                    {
                        "$set": {
                            "portalSyncInProgress": False,
                            "portalSyncLastError": str(exc),
                        }
                    },
                )
            except Exception:
                pass

    background_tasks.add_task(
        _run_sync
    )

    return {
        "success": True,
        "message": (
            "Portal synchronization started in the background."
        ),
        "studentId": student_id,
        "id": student_id,
        "student": student,
        "syncStarted": True,
        "syncInProgress": True,
        "amsConfigured": True,
        "portal": {
            "configured": True,
            "username": (
                student.get("portalUsername")
                or student.get("vtuNumber")
            ),
            "vtuNumber": student.get("vtuNumber"),
            "rollNumber": student.get("rollNumber"),
            "parentPasswordRequired": False,
            "synced": bool(
                student.get(
                    "portalSynced",
                    False,
                )
            ),
            "lastSyncedAt": student.get(
                "lastSyncedAt"
            ),
        },
    }


# =========================================================
# MANUAL PORTAL TEST
# =========================================================

@router.get(
    "/students/{student_id}/portal-test",
)
async def portal_test(
    student_id: str,
    _admin: dict = Depends(require_admin),
    db: Database = Depends(get_db),
):
    user_service = UserService(db)

    try:
        student = user_service.get_user(
            student_id
        )
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Student not found: {exc}",
        ) from exc

    if not student:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Student not found.",
        )

    if student.get("role") != "student":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Selected user is not a student.",
        )

    student_service = StudentService(db)

    if not student_service.has_portal_credentials(
        student
    ):
        return {
            "success": False,
            "message": (
                "AMS credentials are not configured. "
                "The student can configure them later."
            ),
            "student": student,
        }

    try:
        runner = AttendanceSyncRunner(db)

        sync_result = await runner.sync_single_student(
            student_id
        )

        attendance_service = AttendanceService(db)

        attendance = attendance_service.list_records(
            student_id
        )

        attendance_summary = attendance_service.summary(
            student_id
        )

        updated_student = user_service.get_user(
            student_id
        )

        return {
            "success": True,
            "message": (
                "AMS profile and Parent Portal "
                "attendance synchronization completed."
            ),
            "studentId": student_id,
            "student": updated_student,
            "parentPortal": {
                "syncResult": sync_result,
                "attendance": attendance,
                "attendanceCount": len(attendance),
                "attendanceSummary": attendance_summary,
            },
        }

    except Exception as exc:
        return {
            "success": False,
            "message": (
                "Parent Portal synchronization failed."
            ),
            "error": str(exc),
            "studentId": student_id,
        }


# =========================================================
# STUDENT OVERVIEW
# =========================================================

@router.get(
    "/students/{student_id}/overview",
)
def student_overview(
    student_id: str,
    _admin: dict = Depends(require_admin),
    db: Database = Depends(get_db),
):
    user_service = UserService(db)
    attendance_service = AttendanceService(db)
    student_service = StudentService(db)

    student = user_service.get_user(
        student_id
    )

    if not student:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Student not found.",
        )

    if student.get("role") != "student":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Selected user is not a student.",
        )

    subjects = student_service.get_student_associated_subjects(
        student_id
    )

    timetable = [
        serialize_document(record)
        for record in (
            db[TIMETABLE]
            .find({"studentId": student_id})
            .sort(
                [
                    ("day", 1),
                    ("startTime", 1),
                ]
            )
        )
    ]

    notifications = [
        serialize_document(notification)
        for notification in (
            db[NOTIFICATIONS]
            .find({"studentId": student_id})
            .sort("createdAt", -1)
            .limit(100)
        )
    ]

    return {
        "success": True,
        "studentId": student_id,
        "student": student,
        "attendance": attendance_service.list_records(
            student_id
        ),
        "attendanceSummary": attendance_service.summary(
            student_id
        ),
        "attendanceChanges": attendance_service.list_changes(
            student_id
        ),
        "subjects": subjects,
        "timetable": timetable,
        "notifications": notifications,
        "portal": {
            "configured": bool(
                student.get(
                    "portalCredentialsConfigured",
                    False,
                )
            ),
            "username": (
                student.get("portalUsername")
                or student.get("vtuNumber")
            ),
            "vtuNumber": student.get(
                "vtuNumber"
            ),
            "rollNumber": student.get(
                "rollNumber"
            ),
            "parentPasswordRequired": False,
            "synced": bool(
                student.get(
                    "portalSynced",
                    False,
                )
            ),
            "lastSyncedAt": student.get(
                "lastSyncedAt"
            ),
        },
    }


# =========================================================
# STUDENT ATTENDANCE
# =========================================================

@router.get(
    "/students/{student_id}/attendance",
)
def student_attendance(
    student_id: str,
    _admin: dict = Depends(require_admin),
    db: Database = Depends(get_db),
):
    return AttendanceService(db).list_records(
        student_id
    )


# =========================================================
# STUDENT ATTENDANCE SUMMARY
# =========================================================

@router.get(
    "/students/{student_id}/attendance/summary",
)
def student_attendance_summary(
    student_id: str,
    _admin: dict = Depends(require_admin),
    db: Database = Depends(get_db),
):
    return AttendanceService(db).summary(
        student_id
    )


# =========================================================
# STUDENT ATTENDANCE CHANGES
# =========================================================

@router.get(
    "/students/{student_id}/attendance/changes",
)
def student_attendance_changes(
    student_id: str,
    _admin: dict = Depends(require_admin),
    db: Database = Depends(get_db),
):
    return AttendanceService(db).list_changes(
        student_id
    )


# =========================================================
# ALL ATTENDANCE
# =========================================================

@router.get(
    "/attendance",
)
def all_attendance(
    studentId: str | None = None,
    _admin: dict = Depends(require_admin),
    db: Database = Depends(get_db),
):
    return AttendanceService(db).list_all_records(
        studentId
    )


# =========================================================
# UPDATE ATTENDANCE
# =========================================================

@router.put(
    "/attendance/{attendance_id}",
)
def update_attendance(
    attendance_id: str,
    payload: AdminAttendanceUpdate,
    _admin: dict = Depends(require_admin),
    db: Database = Depends(get_db),
):
    return AttendanceService(db).update_attendance(
        attendance_id,
        payload.status,
    )


# =========================================================
# CREATE ATTENDANCE
# =========================================================

@router.post(
    "/attendance",
    status_code=status.HTTP_201_CREATED,
)
def create_attendance(
    payload: AdminAttendanceCreate,
    _admin: dict = Depends(require_admin),
    db: Database = Depends(get_db),
):
    from app.schemas.attendance import IncomingAttendanceRecord

    record = IncomingAttendanceRecord(
        subjectId=payload.subjectId,
        subjectName="",
        date=payload.date,
        status=payload.status,
        source="admin",
    )

    return AttendanceService(db).sync_student_records(
        student_id=payload.studentId,
        incoming_records=[record],
    )


# =========================================================
# SUBJECTS
# =========================================================

@router.get(
    "/subjects",
)
def list_subjects(
    studentId: str | None = None,
    _admin: dict = Depends(require_admin),
    db: Database = Depends(get_db),
):
    if studentId:
        return StudentService(
            db
        ).get_student_associated_subjects(
            studentId
        )

    subjects = (
        db[SUBJECTS]
        .find({"active": True})
        .sort("name", 1)
    )

    return [
        serialize_document(subject)
        for subject in subjects
    ]


@router.post(
    "/students/{student_id}/subjects/cleanup",
)
def cleanup_student_subjects(
    student_id: str,
    _admin: dict = Depends(require_admin),
    db: Database = Depends(get_db),
):
    result = db[SUBJECTS].update_many(
        {
            "studentId": student_id,
            "$or": [
                {
                    "name": {
                        "$in": [
                            "",
                            "-",
                            "--",
                            "status",
                            "statusno",
                        ]
                    }
                },
                {
                    "active": {
                        "$exists": False
                    }
                },
            ],
        },
        {
            "$set": {
                "active": False,
            }
        },
    )

    return {
        "success": True,
        "studentId": student_id,
        "deactivated": result.modified_count,
    }


# =========================================================
# CREATE SUBJECT
# =========================================================

@router.post(
    "/subjects",
    status_code=status.HTTP_201_CREATED,
)
def create_subject(
    payload: AdminSubjectCreate,
    _admin: dict = Depends(require_admin),
    db: Database = Depends(get_db),
):
    from app.utils.dates import utc_now

    now = utc_now()

    if payload.studentId and not db['users'].find_one({'_id':ObjectId(payload.studentId),'role':'student'}):
        raise HTTPException(404,'Student not found.')

    document = {
        "name": payload.name.strip(),
        **({"studentId":payload.studentId} if payload.studentId else {}),
        "code": (
            payload.code.strip()
            if payload.code
            else None
        ),
        "faculty": payload.faculty,
        "facultyId": payload.facultyId,
        "semester": payload.semester,
        "branch": payload.branch,
        "section": payload.section,
        "active": payload.active,
        "source": "admin",
        "createdAt": now,
        "updatedAt": now,
    }

    if document.get("code"):
        existing = db[SUBJECTS].find_one(
            {"code": document["code"], "studentId":payload.studentId}
        )

        if existing:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=(
                    f"Subject code "
                    f"'{document['code']}' already exists."
                ),
            )

    result = db[SUBJECTS].insert_one(
        document
    )

    document["_id"] = result.inserted_id

    return serialize_document(
        document
    )


# =========================================================
# UPDATE SUBJECT
# =========================================================

@router.put(
    "/subjects/{subject_id}",
)
def update_subject(
    subject_id: str,
    payload: AdminSubjectUpdate,
    _admin: dict = Depends(require_admin),
    db: Database = Depends(get_db),
):
    from app.utils.dates import utc_now

    try:
        object_id = ObjectId(
            subject_id
        )
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid subject ID.",
        ) from exc

    update = {
        key: value
        for key, value in payload.model_dump().items()
        if value is not None
    }

    if update:
        update["updatedAt"] = utc_now()
        update["source"] = "admin"

        result = db[SUBJECTS].update_one(
            {"_id": object_id},
            {"$set": update},
        )

        if result.matched_count == 0:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Subject not found.",
            )

    subject = db[SUBJECTS].find_one(
        {"_id": object_id}
    )

    return serialize_document(
        subject
    )


# =========================================================
# TIMETABLE
# =========================================================

@router.get(
    "/students/{student_id}/timetable",
)
def student_timetable(
    student_id: str,
    _admin: dict = Depends(require_admin),
    db: Database = Depends(get_db),
):
    records = (
        db[TIMETABLE]
        .find({"studentId": student_id})
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


# =========================================================
# CREATE TIMETABLE
# =========================================================

@router.post(
    "/timetable",
    status_code=status.HTTP_201_CREATED,
)
def create_timetable(
    payload: AdminTimetableCreate,
    _admin: dict = Depends(require_admin),
    db: Database = Depends(get_db),
):
    from app.utils.dates import utc_now

    now = utc_now()

    document = {
        **payload.model_dump(),
        "source": "admin",
        "createdAt": now,
        "updatedAt": now,
    }

    result = db[TIMETABLE].insert_one(
        document
    )

    document["_id"] = result.inserted_id

    return serialize_document(
        document
    )


# =========================================================
# UPDATE TIMETABLE
# =========================================================

@router.put(
    "/timetable/{timetable_id}",
)
def update_timetable(
    timetable_id: str,
    payload: AdminTimetableUpdate,
    _admin: dict = Depends(require_admin),
    db: Database = Depends(get_db),
):
    from app.utils.dates import utc_now

    try:
        object_id = ObjectId(
            timetable_id
        )
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid timetable ID.",
        ) from exc

    update = {
        key: value
        for key, value in payload.model_dump().items()
        if value is not None
    }

    if update:
        update["source"] = "admin"
        update["updatedAt"] = utc_now()

        result = db[TIMETABLE].update_one(
            {"_id": object_id},
            {"$set": update},
        )

        if result.matched_count == 0:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Timetable record not found.",
            )

    timetable = db[TIMETABLE].find_one(
        {"_id": object_id}
    )

    return serialize_document(
        timetable
    )


# =========================================================
# NOTIFICATIONS
# =========================================================

@router.get(
    "/students/{student_id}/notifications",
)
def student_notifications(
    student_id: str,
    _admin: dict = Depends(require_admin),
    db: Database = Depends(get_db),
):
    notifications = (
        db[NOTIFICATIONS]
        .find({"studentId": student_id})
        .sort("createdAt", -1)
        .limit(100)
    )

    return [
        serialize_document(notification)
        for notification in notifications
    ]


# =========================================================
# SMS LOGS
# =========================================================

@router.get(
    "/sms-logs",
)
def sms_logs(
    _admin: dict = Depends(require_admin),
    db: Database = Depends(get_db),
):
    logs = (
        db[SMS_LOGS]
        .find()
        .sort("createdAt", -1)
        .limit(500)
    )

    return [
        serialize_document(log)
        for log in logs
    ]


# =========================================================
# AUDIT LOGS
# =========================================================

@router.get(
    "/audit-logs",
)
def audit_logs(
    student_id: str | None = None,
    _admin: dict = Depends(require_admin),
    db: Database = Depends(get_db),
):
    query = {}

    if student_id:
        query["studentId"] = student_id

    logs = (
        db[AUDIT_LOGS]
        .find(query)
        .sort("createdAt", -1)
        .limit(500)
    )

    return [
        serialize_document(log)
        for log in logs
    ]


# =========================================================
# COMPLETE SYNC
# =========================================================

@router.post(
    "/sync",
    response_model=SyncResult,
)
async def run_sync(
    payload: SyncRequest,
    _admin: dict = Depends(require_admin),
    db: Database = Depends(get_db),
):
    """
    Synchronization endpoint.

    1. studentId + records:
       Manual attendance save.

    2. studentId without records:
       Live synchronization for one student.

    3. no studentId:
       Live synchronization for all configured students.
    """

    runner = AttendanceSyncRunner(db)

    if (
        payload.studentId
        and payload.records is not None
    ):
        return runner.sync_manual_records(
            payload.studentId,
            payload.records,
        )

    if (
        payload.studentId
        and payload.records is None
    ):
        return await runner.sync_single_student(
            payload.studentId
        )

    return await runner.sync_all_students()


# =========================================================
# SYNC STATUS
# =========================================================

@router.get(
    "/sync/status",
)
def sync_status(
    _admin: dict = Depends(require_admin),
    db: Database = Depends(get_db),
):
    return AttendanceSyncRunner(
        db
    ).latest_status()