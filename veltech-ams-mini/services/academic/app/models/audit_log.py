from datetime import datetime
from typing import Any, Literal, Optional

from pydantic import BaseModel, ConfigDict


AUDIT_LOGS = "audit_logs"


class AuditLogDocument(BaseModel):
    model_config = ConfigDict(
        populate_by_name=True
    )

    id: Optional[str] = None

    adminId: str
    adminName: Optional[str] = None

    action: Literal[
        "CREATE",
        "UPDATE",
        "DELETE",
        "PASSWORD_RESET",
        "ATTENDANCE_UPDATE",
        "SUBJECT_UPDATE",
        "TIMETABLE_UPDATE",
        "NOTIFICATION_CREATE",
        "SYNC",
    ]

    targetType: str
    targetId: Optional[str] = None

    studentId: Optional[str] = None
    studentName: Optional[str] = None

    field: Optional[str] = None
    oldValue: Optional[Any] = None
    newValue: Optional[Any] = None

    description: Optional[str] = None

    createdAt: datetime