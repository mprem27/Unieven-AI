from datetime import datetime
from typing import Literal, Optional

from pydantic import BaseModel, ConfigDict


ATTENDANCE_CHANGES = "attendance_changes"


AttendanceStatus = Literal[
    "PRESENT",
    "ABSENT",
]


class AttendanceChangeDocument(BaseModel):
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

    subjectName: str

    subjectCode: Optional[str] = None

    # =========================================================
    # ATTENDANCE DATE
    # =========================================================

    date: str

    # =========================================================
    # OLD / NEW STATUS
    # =========================================================

    oldStatus: AttendanceStatus

    newStatus: AttendanceStatus

    # =========================================================
    # SOURCE
    # =========================================================
    # college_portal = change detected during portal sync
    # admin          = change made by administrator
    # manual         = manually supplied attendance

    source: str = "college_portal"

    # =========================================================
    # CHANGE DETECTION TIME
    # =========================================================

    detectedAt: datetime