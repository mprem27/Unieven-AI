from datetime import datetime
from typing import Literal, Optional

from pydantic import BaseModel, ConfigDict


# =========================================================
# MONGODB COLLECTIONS
# =========================================================

NOTIFICATIONS = "notifications"
SMS_LOGS = "sms_logs"


# =========================================================
# NOTIFICATION TYPES
# =========================================================

NotificationType = Literal[
    "ATTENDANCE_ABSENT",
    "ATTENDANCE_CORRECTED",
    "LOW_ATTENDANCE",
    "SYSTEM_ALERT",
    "SYNC_UPDATE",
]


# =========================================================
# SMS STATUS
# =========================================================

SMSStatus = Literal[
    "NOT_REQUIRED",
    "PENDING",
    "SENT",
    "FAILED",
    "SKIPPED_NO_PHONE",
    "TEST_LOGGED",
    "PROVIDER_NOT_CONFIGURED",
    "DISABLED",
]


# =========================================================
# NOTIFICATION PRIORITY
# =========================================================

NotificationPriority = Literal[
    "LOW",
    "NORMAL",
    "HIGH",
    "CRITICAL",
]


# =========================================================
# NOTIFICATION DOCUMENT
# =========================================================

class NotificationDocument(BaseModel):
    """
    MongoDB notification document.

    This model is used for student in-app notifications
    and also stores the SMS delivery status associated
    with the notification.

    Attendance data itself is NOT stored here.
    """

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
    # SUBJECT
    # =====================================================

    subjectId: Optional[str] = None

    subjectName: Optional[str] = None

    subjectCode: Optional[str] = None

    # =====================================================
    # ATTENDANCE
    # =====================================================

    date: Optional[str] = None
    periodId: Optional[str] = None

    attendanceStatus: Optional[str] = None

    attendancePercentage: Optional[float] = None

    # =====================================================
    # NOTIFICATION
    # =====================================================

    type: NotificationType

    title: Optional[str] = None

    message: str

    priority: NotificationPriority = "NORMAL"

    read: bool = False

    # =====================================================
    # SMS
    # =====================================================

    smsStatus: SMSStatus = "NOT_REQUIRED"

    smsMessageId: Optional[str] = None

    smsPhone: Optional[str] = None

    smsError: Optional[str] = None

    smsSentAt: Optional[datetime] = None
    emailStatus: str = 'NOT_REQUIRED'
    emailMessageId: Optional[str] = None
    emailSentAt: Optional[datetime] = None
    pushStatus: str = 'NOT_ATTEMPTED'
    pushAccepted: int = 0
    category: str = 'academic'
    link: Optional[str] = None

    # =====================================================
    # DUPLICATE PROTECTION
    # =====================================================

    eventKey: Optional[str] = None

    # =====================================================
    # SOURCE
    # =====================================================

    source: str = "system"

    # =====================================================
    # TIMESTAMPS
    # =====================================================

    createdAt: datetime

    updatedAt: Optional[datetime] = None
