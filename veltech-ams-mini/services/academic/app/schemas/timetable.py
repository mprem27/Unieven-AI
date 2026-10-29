from datetime import datetime

from pydantic import BaseModel


class TimetablePublic(BaseModel):

    id: str

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

    active: bool
    source: str
    createdAt: datetime | None = None

    updatedAt: datetime | None = None