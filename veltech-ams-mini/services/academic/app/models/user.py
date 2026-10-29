from datetime import datetime
from typing import Literal, Optional

from pydantic import BaseModel, ConfigDict


# =========================================================
# COLLECTION
# =========================================================

USERS = "users"


# =========================================================
# USER ROLE
# =========================================================

UserRole = Literal[
    "admin",
    "student",
]


# =========================================================
# USER DOCUMENT
# =========================================================

class UserDocument(BaseModel):

    model_config = ConfigDict(
        populate_by_name=True,
        extra="ignore",
    )

    # =====================================================
    # ID
    # =====================================================

    id: Optional[str] = None

    # =====================================================
    # BASIC ACCOUNT INFORMATION
    # =====================================================

    name: str

    email: str

    # Application login password.
    #
    # IMPORTANT:
    # Never store the plain-text application password.
    #
    passwordHash: str

    role: UserRole = "student"

    # =====================================================
    # STUDENT IDENTIFICATION
    # =====================================================

    vtuNumber: Optional[str] = None

    # =====================================================
    # PERSONAL INFORMATION
    # =====================================================

    gender: Optional[str] = None

    dateOfBirth: Optional[str] = None

    degree: Optional[str] = None

    community: Optional[str] = None

    religion: Optional[str] = None

    nationality: Optional[str] = None

    # =====================================================
    # FAMILY INFORMATION
    # =====================================================

    fatherName: Optional[str] = None

    motherName: Optional[str] = None

    parentName: Optional[str] = None

    parentPhone: Optional[str] = None

    # =====================================================
    # GOVERNMENT / ACADEMIC IDENTIFICATION
    # =====================================================

    aadhaarNumber: Optional[str] = None

    academicBankCreditsId: Optional[str] = None

    # =====================================================
    # COLLEGE PORTAL / AMS
    # =====================================================

    portalUsername: Optional[str] = None

    # =====================================================
    # ENCRYPTED COLLEGE PORTAL PASSWORD
    # =====================================================

    portalPasswordEncrypted: Optional[str] = None

    # =====================================================
    # PORTAL CREDENTIAL STATUS
    # =====================================================

    portalCredentialsConfigured: bool = False

    # =====================================================
    # CONTACT INFORMATION
    # =====================================================

    phoneNumber: Optional[str] = None

    # =====================================================
    # ACADEMIC INFORMATION
    # =====================================================

    branch: Optional[str] = None

    year: Optional[str] = None

    semester: Optional[str] = None

    section: Optional[str] = None

    batch: Optional[str] = None

    # =====================================================
    # PHOTO
    # =====================================================

    photoUrl: Optional[str] = None

    # =====================================================
    # NOTIFICATION SETTINGS
    # =====================================================

    smsEnabled: bool = True

    notificationsEnabled: bool = True

    # =====================================================
    # ACCOUNT STATUS
    # =====================================================

    active: bool = True

    forcePasswordChange: bool = False

    # =====================================================
    # PASSWORD CHANGE TRACKING
    # =====================================================
    #
    # Password can be changed only once every 30 days.
    #
    # This stores ONLY the date/time of the last successful
    # application-password change.
    #
    passwordLastChangedAt: Optional[datetime] = None

    # =====================================================
    # PASSWORD OTP
    # =====================================================
    #
    # OTP itself is NEVER stored.
    # Only the SHA-256 hash is stored.
    #

    passwordOtpHash: Optional[str] = None

    passwordOtpExpiresAt: Optional[datetime] = None

    passwordOtpAttempts: int = 0

    passwordOtpRequestedAt: Optional[datetime] = None

    # =====================================================
    # PASSWORD OTP VERIFICATION
    # =====================================================
    #
    # Temporary verification token used after successful
    # OTP verification.
    #

    passwordOtpVerifiedHash: Optional[str] = None

    passwordOtpVerifiedExpiresAt: Optional[datetime] = None

    # =====================================================
    # COLLEGE PORTAL SYNC
    # =====================================================

    # True after successful AMS synchronization.

    portalSynced: bool = False

    # Last successful AMS synchronization.

    lastSyncedAt: Optional[datetime] = None

    # =====================================================
    # DATABASE TIMESTAMPS
    # =====================================================

    createdAt: Optional[datetime] = None

    updatedAt: Optional[datetime] = None

    # =====================================================
    # SOURCE
    # =====================================================

    source: str = "admin"