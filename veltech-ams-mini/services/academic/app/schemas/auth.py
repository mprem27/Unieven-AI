from datetime import datetime

from pydantic import BaseModel, Field


# =========================================================
# LOGIN
# =========================================================

class LoginRequest(BaseModel):
    email: str = Field(
        ...,
        min_length=3,
    )

    password: str = Field(
        ...,
        min_length=6,
    )


# =========================================================
# TOKEN
# =========================================================

class TokenResponse(BaseModel):
    accessToken: str
    tokenType: str = "bearer"


# =========================================================
# EXISTING CHANGE PASSWORD
# =========================================================

class ChangePasswordRequest(BaseModel):
    currentPassword: str = Field(
        ...,
        min_length=6,
    )

    newPassword: str = Field(
        ...,
        min_length=8,
    )


# =========================================================
# PASSWORD OTP - REQUEST
# =========================================================

class PasswordOtpRequest(BaseModel):
    email: str = Field(
        ...,
        min_length=3,
    )


# =========================================================
# PASSWORD OTP - VERIFY
# =========================================================

class PasswordOtpVerifyRequest(BaseModel):
    email: str = Field(
        ...,
        min_length=3,
    )

    otp: str = Field(
        ...,
        min_length=6,
        max_length=6,
    )


# =========================================================
# PASSWORD OTP - CHANGE PASSWORD
# =========================================================

class PasswordOtpChangeRequest(BaseModel):
    email: str = Field(
        ...,
        min_length=3,
    )

    verificationToken: str = Field(
        ...,
        min_length=20,
    )

    newPassword: str = Field(
        ...,
        min_length=8,
    )


# =========================================================
# CURRENT USER
# =========================================================

class CurrentUserResponse(BaseModel):

    # =====================================================
    # BASIC USER INFORMATION
    # =====================================================

    id: str

    name: str
    email: str
    role: str

    # =====================================================
    # STUDENT INFORMATION
    # =====================================================

    vtuNumber: str | None = None
    phoneNumber: str | None = None

    parentName: str | None = None
    parentPhone: str | None = None

    branch: str | None = None
    year: str | None = None
    semester: str | None = None
    section: str | None = None
    batch: str | None = None

    # =====================================================
    # PHOTO
    # =====================================================

    photoUrl: str | None = None

    # =====================================================
    # NOTIFICATIONS
    # =====================================================

    smsEnabled: bool = True
    notificationsEnabled: bool = True

    # =====================================================
    # ACCOUNT STATUS
    # =====================================================

    active: bool = True

    forcePasswordChange: bool = False

    # =====================================================
    # PORTAL SYNC
    # =====================================================

    portalSynced: bool = False

    lastSyncedAt: str | None = None

    # =====================================================
    # PASSWORD CHANGE STATUS
    # =====================================================
    #
    # These fields are used by the frontend to immediately
    # show whether the student can change the password.
    #
    # The backend remains the final authority for the
    # 30-day restriction.
    #

    passwordLastChangedAt: datetime | None = None

    passwordChangeAllowed: bool = True

    passwordChangeRemainingDays: int = 0

    passwordChangeAvailableDate: str | None = None