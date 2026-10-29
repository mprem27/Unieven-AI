from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field


# =========================================================
# ADMIN USER CREATE
# =========================================================

class AdminUserCreate(BaseModel):

    # -----------------------------------------------------
    # BASIC INFORMATION
    # -----------------------------------------------------

    name: str = Field(
        ...,
        min_length=2,
        max_length=150,
    )

    email: str = Field(
        ...,
        min_length=3,
        max_length=200,
    )

    temporaryPassword: str = Field(
        ...,
        min_length=8,
        max_length=200,
    )

    # -----------------------------------------------------
    # STUDENT IDENTIFICATION
    # -----------------------------------------------------

    vtuNumber: str | None = Field(
        default=None,
        max_length=100,
    )

    # -----------------------------------------------------
    # PERSONAL INFORMATION
    # -----------------------------------------------------

    gender: str | None = Field(
        default=None,
        max_length=30,
    )

    dateOfBirth: str | None = Field(
        default=None,
        max_length=30,
    )

    degree: str | None = Field(
        default=None,
        max_length=100,
    )

    community: str | None = Field(
        default=None,
        max_length=100,
    )

    religion: str | None = Field(
        default=None,
        max_length=100,
    )

    nationality: str | None = Field(
        default=None,
        max_length=100,
    )

    # -----------------------------------------------------
    # FAMILY INFORMATION
    # -----------------------------------------------------

    fatherName: str | None = Field(
        default=None,
        max_length=150,
    )

    motherName: str | None = Field(
        default=None,
        max_length=150,
    )

    parentName: str | None = Field(
        default=None,
        max_length=150,
    )

    parentPhone: str | None = Field(
        default=None,
        max_length=30,
    )

    # -----------------------------------------------------
    # CONTACT
    # -----------------------------------------------------

    phoneNumber: str | None = Field(
        default=None,
        max_length=30,
    )

    # -----------------------------------------------------
    # IDENTIFICATION NUMBERS
    # -----------------------------------------------------

    aadhaarNumber: str | None = Field(
        default=None,
        max_length=20,
    )

    academicBankCreditsId: str | None = Field(
        default=None,
        max_length=100,
    )

    # -----------------------------------------------------
    # ACADEMIC INFORMATION
    # -----------------------------------------------------

    branch: str | None = Field(
        default=None,
        max_length=150,
    )

    year: str | None = Field(
        default=None,
        max_length=50,
    )

    semester: str | None = Field(
        default=None,
        max_length=50,
    )

    section: str | None = Field(
        default=None,
        max_length=50,
    )

    batch: str | None = Field(
        default=None,
        max_length=100,
    )

    # -----------------------------------------------------
    # PHOTO
    # -----------------------------------------------------

    photoUrl: str | None = None

    # -----------------------------------------------------
    # AMS / COLLEGE PORTAL
    # -----------------------------------------------------

    portalUsername: str | None = Field(
        default=None,
        max_length=100,
    )

    portalPassword: str | None = Field(
        default=None,
        max_length=200,
    )

    # -----------------------------------------------------
    # SETTINGS
    # -----------------------------------------------------

    smsEnabled: bool = True

    notificationsEnabled: bool = True

    active: bool = True


# =========================================================
# ADMIN USER UPDATE
# =========================================================

class AdminUserUpdate(BaseModel):

    # -----------------------------------------------------
    # BASIC INFORMATION
    # -----------------------------------------------------

    name: str | None = Field(
        default=None,
        min_length=2,
        max_length=150,
    )

    email: str | None = Field(
        default=None,
        min_length=3,
        max_length=200,
    )

    # -----------------------------------------------------
    # STUDENT IDENTIFICATION
    # -----------------------------------------------------

    vtuNumber: str | None = Field(
        default=None,
        max_length=100,
    )

    # -----------------------------------------------------
    # PERSONAL INFORMATION
    # -----------------------------------------------------

    gender: str | None = Field(
        default=None,
        max_length=30,
    )

    dateOfBirth: str | None = Field(
        default=None,
        max_length=30,
    )

    degree: str | None = Field(
        default=None,
        max_length=100,
    )

    community: str | None = Field(
        default=None,
        max_length=100,
    )

    religion: str | None = Field(
        default=None,
        max_length=100,
    )

    nationality: str | None = Field(
        default=None,
        max_length=100,
    )

    # -----------------------------------------------------
    # FAMILY INFORMATION
    # -----------------------------------------------------

    fatherName: str | None = Field(
        default=None,
        max_length=150,
    )

    motherName: str | None = Field(
        default=None,
        max_length=150,
    )

    parentName: str | None = Field(
        default=None,
        max_length=150,
    )

    parentPhone: str | None = Field(
        default=None,
        max_length=30,
    )

    # -----------------------------------------------------
    # CONTACT
    # -----------------------------------------------------

    phoneNumber: str | None = Field(
        default=None,
        max_length=30,
    )

    # -----------------------------------------------------
    # IDENTIFICATION NUMBERS
    # -----------------------------------------------------

    aadhaarNumber: str | None = Field(
        default=None,
        max_length=20,
    )

    academicBankCreditsId: str | None = Field(
        default=None,
        max_length=100,
    )

    # -----------------------------------------------------
    # ACADEMIC INFORMATION
    # -----------------------------------------------------

    branch: str | None = Field(
        default=None,
        max_length=150,
    )

    year: str | None = Field(
        default=None,
        max_length=50,
    )

    semester: str | None = Field(
        default=None,
        max_length=50,
    )

    section: str | None = Field(
        default=None,
        max_length=50,
    )

    batch: str | None = Field(
        default=None,
        max_length=100,
    )

    # -----------------------------------------------------
    # PHOTO
    # -----------------------------------------------------

    photoUrl: str | None = None

    # -----------------------------------------------------
    # AMS / COLLEGE PORTAL
    # -----------------------------------------------------

    portalUsername: str | None = Field(
        default=None,
        max_length=100,
    )

    portalPassword: str | None = Field(
        default=None,
        max_length=200,
    )

    # -----------------------------------------------------
    # SETTINGS
    # -----------------------------------------------------

    smsEnabled: bool | None = None

    notificationsEnabled: bool | None = None

    active: bool | None = None


# =========================================================
# ADMIN PASSWORD RESET
# =========================================================

class AdminPasswordReset(BaseModel):

    newPassword: str = Field(
        ...,
        min_length=8,
        max_length=200,
    )


# =========================================================
# ADMIN ATTENDANCE CREATE
# =========================================================

class AdminAttendanceCreate(BaseModel):

    studentId: str

    subjectId: str

    date: str

    status: str


# =========================================================
# ADMIN ATTENDANCE UPDATE
# =========================================================

class AdminAttendanceUpdate(BaseModel):

    status: str


# =========================================================
# ADMIN SUBJECT CREATE
# =========================================================

class AdminSubjectCreate(BaseModel):

    studentId: str | None = Field(default=None,pattern=r"^[a-fA-F0-9]{24}$")

    name: str

    code: str | None = None

    faculty: str | None = None

    facultyId: str | None = None

    semester: str | None = None

    branch: str | None = None

    section: str | None = None

    active: bool = True


# =========================================================
# ADMIN SUBJECT UPDATE
# =========================================================

class AdminSubjectUpdate(BaseModel):

    name: str | None = None

    code: str | None = None

    faculty: str | None = None

    facultyId: str | None = None

    semester: str | None = None

    branch: str | None = None

    section: str | None = None

    active: bool | None = None


# =========================================================
# ADMIN TIMETABLE CREATE
# =========================================================

class AdminTimetableCreate(BaseModel):

    studentId: str

    day: str

    subjectId: str | None = None

    subjectCode: str | None = None

    subjectName: str | None = None

    faculty: str | None = None

    startTime: str | None = None

    endTime: str | None = None

    room: str | None = None

    semester: str | None = None

    branch: str | None = None

    section: str | None = None

    active: bool = True


# =========================================================
# ADMIN TIMETABLE UPDATE
# =========================================================

class AdminTimetableUpdate(BaseModel):

    day: str | None = None

    subjectId: str | None = None

    subjectCode: str | None = None

    subjectName: str | None = None

    faculty: str | None = None

    startTime: str | None = None

    endTime: str | None = None

    room: str | None = None

    semester: str | None = None

    branch: str | None = None

    section: str | None = None

    active: bool | None = None


# =========================================================
# ADMIN NOTIFICATION CREATE
# =========================================================

class AdminNotificationCreate(BaseModel):

    studentId: str

    subjectId: str | None = None

    subjectName: str | None = None

    type: str

    title: str | None = None

    message: str

    priority: str = "NORMAL"

    smsStatus: str = "NOT_REQUIRED"


# =========================================================
# ADMIN AUDIT LOG PUBLIC
# =========================================================

class AdminAuditLogPublic(BaseModel):

    id: str

    adminId: str

    adminName: str | None = None

    action: str

    targetType: str

    targetId: str | None = None

    studentId: str | None = None

    studentName: str | None = None

    field: str | None = None

    oldValue: Any | None = None

    newValue: Any | None = None

    description: str | None = None

    createdAt: datetime


# =========================================================
# ADMIN SYNC RESPONSE
# =========================================================

class AdminSyncResponse(BaseModel):

    success: bool

    status: str

    studentsProcessed: int = 0

    recordsProcessed: int = 0

    changesDetected: int = 0

    errorsCount: int = 0

    message: str | None = None