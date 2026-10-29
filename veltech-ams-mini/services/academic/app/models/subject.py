from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict


SUBJECTS = "subjects"


class SubjectDocument(BaseModel):
    """
    Subject document stored in MongoDB.

    Coded courses are unique per student. A missing studentId marks a
    legacy shared catalog entry; portal sync never writes shared entries.

    Example:

        {
            "studentId": "...",
            "name": "Coding Practices-I",
            "code": "10218CS902",
            "active": true,
            "source": "parent_portal"
        }
    """

    model_config = ConfigDict(
        populate_by_name=True,
        extra="allow",
    )

    # =========================================================
    # MONGODB ID
    # =========================================================

    id: Optional[str] = None

    # =========================================================
    # STUDENT
    # =========================================================

    studentId: Optional[str] = None

    # =========================================================
    # SUBJECT
    # =========================================================

    name: str

    code: Optional[str] = None

    # =========================================================
    # FACULTY
    # =========================================================

    faculty: Optional[str] = None

    facultyId: Optional[str] = None

    # =========================================================
    # ACADEMIC DETAILS
    # =========================================================

    semester: Optional[str] = None

    branch: Optional[str] = None

    section: Optional[str] = None

    # =========================================================
    # STATUS
    # =========================================================

    active: bool = True

    # =========================================================
    # SOURCE
    # =========================================================

    source: str = "parent_portal"

    # =========================================================
    # TIMESTAMPS
    # =========================================================

    createdAt: Optional[datetime] = None

    updatedAt: Optional[datetime] = None
