from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict


# =========================================================
# COLLECTION
# =========================================================

TIMETABLE = "timetable"


# =========================================================
# TIMETABLE DOCUMENT
# =========================================================

class TimetableDocument(BaseModel):
    model_config = ConfigDict(
        populate_by_name=True
    )

    # =====================================================
    # IDENTIFIER
    # =====================================================

    id: Optional[str] = None

    # =====================================================
    # STUDENT
    # =====================================================

    studentId: str

    # =====================================================
    # DAY
    # =====================================================

    day: str

    # =====================================================
    # SUBJECT
    # =====================================================

    subjectId: Optional[str] = None

    subjectCode: Optional[str] = None

    subjectName: Optional[str] = None

    # =====================================================
    # FACULTY
    # =====================================================

    faculty: Optional[str] = None

    # =====================================================
    # TIME
    # =====================================================

    startTime: Optional[str] = None

    endTime: Optional[str] = None

    # =====================================================
    # ROOM
    # =====================================================

    room: Optional[str] = None

    # =====================================================
    # ACADEMIC DETAILS
    # =====================================================

    semester: Optional[str] = None

    branch: Optional[str] = None

    section: Optional[str] = None

    # =====================================================
    # STATUS
    # =====================================================

    active: bool = True

    # =====================================================
    # SOURCE
    # =====================================================

    # Timetable is now fetched from the college AMS.
    source: str = "ams"

    # =====================================================
    # TIMESTAMPS
    # =====================================================

    createdAt: Optional[datetime] = None

    updatedAt: Optional[datetime] = None