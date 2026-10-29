from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends, HTTPException, status
from pymongo.database import Database

from app.config.database import get_db
from app.schemas.attendance import (
    AttendanceChangePublic,
    AttendanceRecordPublic,
    AttendanceSummaryItem,
    SubjectDetailsResponse,
)
from app.security.permissions import get_current_user
from app.services.attendance_service import AttendanceService


router = APIRouter(
    prefix="/attendance",
    tags=["attendance"],
)


# =========================================================
# STUDENT AUTHORIZATION
# =========================================================

def _get_student_id(
    current_user: dict[str, Any],
) -> str:
    """
    Extract and validate the authenticated student's ID.

    Supports common JWT/current-user keys:
        id
        _id
        user_id
        student_id

    Only students can access these routes.
    """

    if not isinstance(current_user, dict):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication information.",
        )

    role = str(
        current_user.get("role")
        or current_user.get("user_role")
        or ""
    ).strip().lower()

    if role != "student":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Student access required.",
        )

    student_id = (
        current_user.get("id")
        or current_user.get("_id")
        or current_user.get("user_id")
        or current_user.get("student_id")
    )

    if student_id is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Student identity is missing.",
        )

    student_id = str(student_id).strip()

    if not student_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Student identity is empty.",
        )

    return student_id


# =========================================================
# SERVICE HELPER
# =========================================================

def _attendance_service(
    db: Database,
) -> AttendanceService:
    """
    Create one AttendanceService instance for the request.
    """
    return AttendanceService(db)


# =========================================================
# ALL ATTENDANCE
# =========================================================

@router.get(
    "",
    response_model=list[AttendanceRecordPublic],
)
def get_attendance(
    current_user: dict[str, Any] = Depends(get_current_user),
    db: Database = Depends(get_db),
):
    """
    Return all attendance records belonging only to
    the currently authenticated student.
    """

    student_id = _get_student_id(current_user)

    return _attendance_service(db).list_records(
        student_id
    )


# =========================================================
# TODAY'S ATTENDANCE
# =========================================================

@router.get(
    "/today",
    response_model=list[AttendanceRecordPublic],
)
def get_today(
    current_user: dict[str, Any] = Depends(get_current_user),
    db: Database = Depends(get_db),
):
    """
    Return today's attendance records.
    """

    student_id = _get_student_id(current_user)

    return _attendance_service(db).list_today(
        student_id
    )


# =========================================================
# ATTENDANCE SUMMARY
# =========================================================

@router.get(
    "/summary",
    response_model=list[AttendanceSummaryItem],
)
def get_summary(
    current_user: dict[str, Any] = Depends(get_current_user),
    db: Database = Depends(get_db),
):
    """
    Return subject-wise attendance summary.
    """

    student_id = _get_student_id(current_user)

    return _attendance_service(db).summary(
        student_id
    )


# =========================================================
# ATTENDANCE CHANGES
# =========================================================

@router.get(
    "/changes",
    response_model=list[AttendanceChangePublic],
)
def get_changes(
    current_user: dict[str, Any] = Depends(get_current_user),
    db: Database = Depends(get_db),
):
    """
    Return attendance changes detected during synchronization.
    """

    student_id = _get_student_id(current_user)

    return _attendance_service(db).list_changes(
        student_id
    )


# =========================================================
# SUBJECT ATTENDANCE DETAILS
# =========================================================

@router.get(
    "/subject/{subject_id}",
    response_model=SubjectDetailsResponse,
)
def get_subject_details(
    subject_id: str,
    current_user: dict[str, Any] = Depends(get_current_user),
    db: Database = Depends(get_db),
):
    """
    Return detailed attendance information for one subject.
    """

    subject_id = str(subject_id).strip()

    if not subject_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Subject ID is required.",
        )

    student_id = _get_student_id(current_user)

    return _attendance_service(db).subject_details(
        student_id,
        subject_id,
    )