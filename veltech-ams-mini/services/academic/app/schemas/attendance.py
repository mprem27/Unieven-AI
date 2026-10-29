from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field


AttendanceStatus = Literal["PRESENT", "ABSENT"]


class IncomingAttendanceRecord(BaseModel):
    subjectId: str | None = None
    subjectName: str
    subjectCode: str | None = None
    date: str = Field(..., description="YYYY-MM-DD")
    status: AttendanceStatus
    source: str = "college_portal"


class AttendanceRecordPublic(BaseModel):
    id: str
    studentId: str
    subjectId: str
    subjectName: str
    subjectCode: str | None = None
    date: str
    status: AttendanceStatus
    source: str
    updatedAt: datetime
    createdAt: datetime | None = None


class AttendanceSummaryItem(BaseModel):
    subjectId: str
    subjectName: str
    subjectCode: str | None = None
    present: int
    absent: int
    total: int
    percentage: float


class AttendanceChangePublic(BaseModel):
    id: str
    studentId: str
    subjectId: str
    subjectName: str
    subjectCode: str | None = None
    date: str
    oldStatus: AttendanceStatus
    newStatus: AttendanceStatus
    source: str = "college_portal"
    detectedAt: datetime


class SubjectDetailsResponse(BaseModel):
    subjectId: str
    subjectName: str
    subjectCode: str | None = None
    present: int
    absent: int
    total: int
    percentage: float
    records: list[AttendanceRecordPublic]


class SyncRequest(BaseModel):
    studentId: str | None = None
    records: list[IncomingAttendanceRecord] | None = None


class SyncResult(BaseModel):
    studentsProcessed: int
    recordsProcessed: int
    changesDetected: int
    notificationsCreated: int