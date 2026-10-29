from datetime import datetime

from pydantic import BaseModel, Field, field_validator
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError


# =========================================================
# NOTIFICATION PUBLIC RESPONSE
# =========================================================

class NotificationPublic(BaseModel):
    id: str

    studentId: str

    subjectId: str | None = None
    subjectName: str | None = None
    subjectCode: str | None = None

    date: str | None = None
    periodId: str | None = None
    attendanceStatus: str | None = None
    attendancePercentage: float | None = None

    type: str

    title: str | None = None

    message: str

    priority: str = "NORMAL"

    read: bool = False

    smsStatus: str = "NOT_REQUIRED"

    smsMessageId: str | None = None

    smsSentAt: datetime | None = None
    emailStatus: str = 'NOT_REQUIRED'
    emailMessageId: str | None = None
    emailSentAt: datetime | None = None

    source: str = "system"

    createdAt: datetime

    updatedAt: datetime | None = None
    link: str | None = None
    category: str = 'academic'
    pushStatus: str = 'NOT_ATTEMPTED'
    pushAccepted: int = 0


# =========================================================
# MARK READ RESPONSE
# =========================================================

class MarkReadResponse(BaseModel):
    id: str

    read: bool


# =========================================================
# PUSH SUBSCRIPTION KEYS
# =========================================================

class PushSubscriptionKeys(BaseModel):
    p256dh: str = Field(
        ...,
        min_length=1,
    )

    auth: str = Field(
        ...,
        min_length=1,
    )


# =========================================================
# CREATE PUSH SUBSCRIPTION
# =========================================================

class PushAlertPreferences(BaseModel):
    soundEnabled: bool = False
    silent: bool = False
    quietHoursEnabled: bool = False
    quietHoursStart: str = Field(default='22:00', pattern=r'^([01]\d|2[0-3]):[0-5]\d$')
    quietHoursEnd: str = Field(default='07:00', pattern=r'^([01]\d|2[0-3]):[0-5]\d$')
    timeZone: str = 'Asia/Kolkata'

    @field_validator('timeZone')
    @classmethod
    def valid_time_zone(cls, value):
        try:
            ZoneInfo(value)
        except (ZoneInfoNotFoundError, ValueError):
            raise ValueError('Choose a valid time zone.')
        return value


class PushSubscriptionCreate(BaseModel):
    endpoint: str = Field(
        ...,
        min_length=1,
    )

    keys: PushSubscriptionKeys
    preferences: PushAlertPreferences | None = None


class PushPreferencesUpdate(BaseModel):
    endpoint: str = Field(..., min_length=1, max_length=4096)
    preferences: PushAlertPreferences


# =========================================================
# PUSH SUBSCRIPTION RESPONSE
# =========================================================

class PushSubscriptionResponse(BaseModel):
    success: bool

    message: str


# =========================================================
# PUSH NOTIFICATION STATUS
# =========================================================

class PushNotificationStatus(BaseModel):

    configured: bool = False
    publicKey: str | None = None
    success: bool

    enabled: bool

    subscriptions: int
    provider: str = 'web_push'
    deliveryStatus: str = 'not_configured'
    reason: str | None = None
