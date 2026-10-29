from datetime import datetime

from pydantic import BaseModel


class SubjectPublic(BaseModel):
    id: str
    name: str
    code: str | None = None

    faculty: str | None = None
    facultyId: str | None = None

    semester: str | None = None
    branch: str | None = None
    section: str | None = None

    active: bool
    source: str

    createdAt: datetime | None = None
    updatedAt: datetime | None = None