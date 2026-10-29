from datetime import datetime
from typing import Literal, Optional

from pydantic import BaseModel, ConfigDict


ATTENDANCE_RECORDS = "attendance_records"

AttendanceStatus = Literal[
    "PRESENT",
    "ABSENT",
]


class AttendanceRecordDocument(BaseModel):
    model_config = ConfigDict(
        populate_by_name=True
    )

    # =========================================================
    # ID
    # =========================================================

    id: Optional[str] = None

    # =========================================================
    # STUDENT
    # =========================================================

    studentId: str

    # =========================================================
    # SUBJECT
    # =========================================================

    subjectId: str

    subjectCode: Optional[str] = None

    subjectName: Optional[str] = None

    # =========================================================
    # ATTENDANCE
    # =========================================================

    date: str

    status: AttendanceStatus

    # =========================================================
    # SOURCE
    # =========================================================
  

    source: str = "college_portal"

    # =========================================================
    # TIMESTAMPS
    # =========================================================

    updatedAt: datetime

    createdAt: Optional[datetime] = None