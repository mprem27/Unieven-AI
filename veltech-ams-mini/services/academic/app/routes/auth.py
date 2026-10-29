from fastapi import APIRouter, Depends, status
from pymongo.database import Database

from app.config.database import get_db
from app.schemas.auth import (
    ChangePasswordRequest,
    CurrentUserResponse,
    LoginRequest,
    TokenResponse,
    PasswordOtpRequest,
    PasswordOtpVerifyRequest,
    PasswordOtpChangeRequest,
)
from app.security.permissions import get_current_user
from app.services.auth_service import AuthService


router = APIRouter(
    prefix="/auth",
    tags=["auth"],
)


# =========================================================
# LOGIN
# =========================================================

@router.post(
    "/login",
    response_model=TokenResponse,
)
def login(
    payload: LoginRequest,
    db: Database = Depends(get_db),
):
    return AuthService(db).authenticate(
        payload.email,
        payload.password,
    )


# =========================================================
# CURRENT USER
# =========================================================

@router.get(
    "/me",
    response_model=CurrentUserResponse,
)
def me(
    current_user: dict = Depends(
        get_current_user
    ),
):
    return current_user


# =========================================================
# EXISTING CHANGE PASSWORD
# =========================================================
#
# Existing functionality is preserved.
# =========================================================

@router.post(
    "/change-password",
    status_code=status.HTTP_204_NO_CONTENT,
)
def change_password(
    payload: ChangePasswordRequest,
    current_user: dict = Depends(
        get_current_user
    ),
    db: Database = Depends(get_db),
):
    AuthService(db).change_password(
        current_user["id"],
        payload.currentPassword,
        payload.newPassword,
    )

    return None


# =========================================================
# REQUEST PASSWORD OTP
# =========================================================
#
# Student enters their registered email.
#
# OTP is sent to that email.
# =========================================================

@router.post(
    "/password/request-otp",
)
def request_password_otp(
    payload: PasswordOtpRequest,
    db: Database = Depends(get_db),
):
    return AuthService(
        db
    ).request_password_change_otp(
        payload.email,
    )


# =========================================================
# VERIFY PASSWORD OTP
# =========================================================
#
# Student enters:
#
# email + OTP
#
# Backend verifies the OTP and returns a
# temporary verification token.
# =========================================================

@router.post(
    "/password/verify-otp",
)
def verify_password_otp(
    payload: PasswordOtpVerifyRequest,
    db: Database = Depends(get_db),
):
    return AuthService(
        db
    ).verify_password_change_otp(
        payload.email,
        payload.otp,
    )


# =========================================================
# CHANGE PASSWORD USING VERIFIED OTP
# =========================================================
#
# Student sends:
#
# email
# verificationToken
# newPassword
#
# Backend checks:
#
# 1. OTP was verified
# 2. Verification token is valid
# 3. Token has not expired
# 4. 30-day password restriction
#
# Then password is changed.
# =========================================================

@router.post(
    "/password/change-with-otp",
    status_code=status.HTTP_204_NO_CONTENT,
)
def change_password_with_otp(
    payload: PasswordOtpChangeRequest,
    db: Database = Depends(get_db),
):
    AuthService(
        db
    ).change_password_with_otp(
        payload.email,
        payload.verificationToken,
        payload.newPassword,
    )

    return None