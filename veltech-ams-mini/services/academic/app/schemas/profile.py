from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field


# =====================================================
# USER
# =====================================================

class UserPublic(BaseModel):
    model_config = ConfigDict(
        populate_by_name=True,
        from_attributes=True,
    )

    id: str
    name: str
    email: str
    role: str

    vtuNumber: Optional[str] = None
    phoneNumber: Optional[str] = None
    parentName: Optional[str] = None
    parentPhone: Optional[str] = None

    branch: Optional[str] = None
    year: Optional[str] = None
    semester: Optional[str] = None
    section: Optional[str] = None
    batch: Optional[str] = None

    photoUrl: Optional[str] = None

    smsEnabled: bool = True
    notificationsEnabled: bool = True
    active: bool = True

    forcePasswordChange: bool = False

    portalSynced: bool = False
    lastSyncedAt: Optional[datetime] = None

    source: Optional[str] = None


# =====================================================
# PROFILE UPDATE
# =====================================================

class ProfileUpdate(BaseModel):
    smsEnabled: Optional[bool] = None
    notificationsEnabled: Optional[bool] = None


# =====================================================
# PORTAL CREDENTIALS
# =====================================================

class PortalCredentialsUpdate(BaseModel):
    portalUsername: str = Field(
        min_length=1
    )
    portalPassword: str = Field(
        min_length=1
    )


class PortalCredentialsPublic(BaseModel):
    configured: bool
    portalUsername: Optional[str] = None