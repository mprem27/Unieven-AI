from __future__ import annotations

import hashlib
import secrets
from datetime import datetime, timedelta, timezone

from bson import ObjectId
from fastapi import HTTPException, status
from pymongo.database import Database

from app.models.user import USERS
from app.schemas.user import UserCreate
from app.security.jwt import create_access_token
from app.security.password import hash_password, verify_password
from app.security.portal_credentials import (
    encrypt_portal_password,
)
from app.services.base import (
    public_user,
    serialize_document,
)
from app.services.email_service import EmailService
from app.utils.dates import utc_now
from app.utils.validators import require_student_role


class AuthService:

    PASSWORD_CHANGE_INTERVAL_DAYS = 30

    def __init__(
        self,
        db: Database,
    ):
        self.db = db

        # =====================================================
        # EMAIL SERVICE
        # =====================================================

        self.email_service = EmailService(db)

    # =========================================================
    # LOGIN
    # =========================================================

    def authenticate(
        self,
        email: str,
        password: str,
    ) -> dict:

        normalized_email = (
            email.strip().lower()
        )

        user = self.db[
            USERS
        ].find_one(
            {
                "email": normalized_email,
                "active": True,
            }
        )

        if not user:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid email or password",
            )

        password_hash = user.get(
            "passwordHash"
        )

        if not password_hash:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid email or password",
            )

        if not verify_password(
            password,
            password_hash,
        ):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid email or password",
            )

        serialized = serialize_document(
            user
        )

        token = create_access_token(
            serialized["id"],
            serialized["role"],
        )

        return {
            "accessToken": token,
            "tokenType": "bearer",
        }

    # =========================================================
    # CREATE STUDENT
    # =========================================================

    def create_user(
        self,
        payload: UserCreate,
    ) -> dict:

        require_student_role(
            payload.role
        )

        # -----------------------------------------------------
        # BASIC VALUES
        # -----------------------------------------------------

        email = (
            payload.email
            .strip()
            .lower()
        )

        vtu_number = (
            payload.vtuNumber.strip()
            if payload.vtuNumber
            else None
        )

        portal_username = (
            payload.portalUsername.strip()
            if payload.portalUsername
            else None
        )

        portal_password = (
            payload.portalPassword.strip()
            if payload.portalPassword
            else None
        )

        # =====================================================
        # EMAIL UNIQUENESS
        # =====================================================

        existing_email = self.db[
            USERS
        ].find_one(
            {
                "email": email,
            }
        )

        if existing_email:
            raise HTTPException(
                status_code=409,
                detail="Email already exists",
            )

        # =====================================================
        # VTU NUMBER UNIQUENESS
        # =====================================================

        if vtu_number:

            existing_vtu = self.db[
                USERS
            ].find_one(
                {
                    "vtuNumber": vtu_number,
                }
            )

            if existing_vtu:
                raise HTTPException(
                    status_code=409,
                    detail="VTU number already exists",
                )

        # =====================================================
        # PORTAL CREDENTIALS
        # =====================================================

        portal_password_encrypted = None

        if portal_password:

            try:

                portal_password_encrypted = (
                    encrypt_portal_password(
                        portal_password
                    )
                )

            except Exception as exc:

                print(
                    "Portal password encryption failed:",
                    repr(exc),
                )

                raise HTTPException(
                    status_code=500,
                    detail=(
                        "Failed to encrypt portal password."
                    ),
                ) from exc

            if not portal_password_encrypted:

                raise HTTPException(
                    status_code=500,
                    detail=(
                        "Portal password encryption "
                        "returned an empty value."
                    ),
                )

        portal_credentials_configured = bool(
            portal_username
            and portal_password_encrypted
        )

        # =====================================================
        # CREATE STUDENT DOCUMENT
        # =====================================================

        user = {

            # -------------------------------------------------
            # BASIC INFORMATION
            # -------------------------------------------------

            "name": payload.name.strip(),

            "email": email,

            "passwordHash": hash_password(
                payload.temporaryPassword
            ),

            "role": "student",

            # -------------------------------------------------
            # STUDENT IDENTIFICATION
            # -------------------------------------------------

            "vtuNumber": vtu_number,

            # -------------------------------------------------
            # PORTAL CREDENTIALS
            # -------------------------------------------------

            "portalUsername": portal_username,

            "portalPasswordEncrypted": (
                portal_password_encrypted
            ),

            "portalCredentialsConfigured": (
                portal_credentials_configured
            ),

            # -------------------------------------------------
            # CONTACT
            # -------------------------------------------------

            "phoneNumber": (
                payload.phoneNumber.strip()
                if payload.phoneNumber
                else None
            ),

            "parentName": (
                payload.parentName.strip()
                if payload.parentName
                else None
            ),

            "parentPhone": (
                payload.parentPhone.strip()
                if payload.parentPhone
                else None
            ),

            # -------------------------------------------------
            # ACADEMIC INFORMATION
            # -------------------------------------------------

            "branch": (
                payload.branch.strip()
                if payload.branch
                else None
            ),

            "year": (
                payload.year.strip()
                if payload.year
                else None
            ),

            "semester": (
                payload.semester.strip()
                if payload.semester
                else None
            ),

            "section": (
                payload.section.strip()
                if payload.section
                else None
            ),

            "batch": (
                payload.batch.strip()
                if payload.batch
                else None
            ),

            # -------------------------------------------------
            # PHOTO
            # -------------------------------------------------

            "photoUrl": (
                payload.photoUrl.strip()
                if payload.photoUrl
                else None
            ),

            # -------------------------------------------------
            # NOTIFICATIONS
            # -------------------------------------------------

            "smsEnabled": payload.smsEnabled,

            "notificationsEnabled": (
                payload.notificationsEnabled
            ),

            # -------------------------------------------------
            # ACCOUNT
            # -------------------------------------------------

            "active": payload.active,

            "forcePasswordChange": True,

            # =================================================
            # PASSWORD CHANGE TRACKING
            # =================================================

            "passwordLastChangedAt": None,

            "passwordOtpHash": None,

            "passwordOtpExpiresAt": None,

            "passwordOtpAttempts": 0,

            "passwordOtpRequestedAt": None,

            "passwordOtpVerifiedHash": None,

            "passwordOtpVerifiedExpiresAt": None,

            # -------------------------------------------------
            # PORTAL SYNC
            # -------------------------------------------------

            "portalSynced": False,

            "lastSyncedAt": None,

            # -------------------------------------------------
            # SOURCE
            # -------------------------------------------------

            "source": "admin",
        }

        # =====================================================
        # INSERT INTO MONGODB
        # =====================================================

        result = self.db[
            USERS
        ].insert_one(
            user
        )

        user["_id"] = result.inserted_id

        # =====================================================
        # VERIFY INSERTED DOCUMENT
        # =====================================================

        saved_user = self.db[
            USERS
        ].find_one(
            {
                "_id": result.inserted_id,
            }
        )

        if not saved_user:

            raise HTTPException(
                status_code=500,
                detail=(
                    "Student was created but could "
                    "not be read back from MongoDB."
                ),
            )

        # =====================================================
        # VERIFY PORTAL CREDENTIALS
        # =====================================================

        if portal_username:

            saved_portal_username = (
                saved_user.get(
                    "portalUsername"
                )
            )

            saved_encrypted_password = (
                saved_user.get(
                    "portalPasswordEncrypted"
                )
            )

            saved_configured = (
                saved_user.get(
                    "portalCredentialsConfigured",
                    False,
                )
            )

            if not (
                saved_portal_username
                and saved_encrypted_password
                and saved_configured
            ):

                raise HTTPException(
                    status_code=500,
                    detail=(
                        "Student was created, but "
                        "portal credentials were not "
                        "saved correctly."
                    ),
                )

            print("")
            print(
                "========================================"
            )
            print("STUDENT CREATED")
            print(
                f"Student ID: {result.inserted_id}"
            )
            print(
                f"Name: {saved_user.get('name')}"
            )
            print(
                f"Email: {saved_user.get('email')}"
            )
            print(
                f"Portal Username: {saved_portal_username}"
            )
            print(
                f"VTU Number: {saved_user.get('vtuNumber')}"
            )
            print(
                "Portal Password: ENCRYPTED"
            )
            print(
                "Portal Credentials Configured: TRUE"
            )
            print(
                "========================================"
            )
            print("")

        else:

            print("")
            print(
                "========================================"
            )
            print("STUDENT CREATED")
            print(
                f"Student ID: {result.inserted_id}"
            )
            print(
                f"Name: {saved_user.get('name')}"
            )
            print(
                f"Email: {saved_user.get('email')}"
            )
            print(
                "Portal Username: NOT PROVIDED"
            )
            print(
                f"VTU Number: {saved_user.get('vtuNumber')}"
            )
            print(
                "Portal Credentials Configured: FALSE"
            )
            print(
                "========================================"
            )
            print("")

        # =====================================================
        # RETURN PUBLIC USER
        # =====================================================

        return public_user(
            serialize_document(
                saved_user
            )
        )

    # =========================================================
    # EXISTING CHANGE PASSWORD
    # =========================================================

    def change_password(
        self,
        user_id: str,
        current_password: str,
        new_password: str,
    ) -> None:

        object_id = self._object_id(
            user_id
        )

        user = self.db[
            USERS
        ].find_one(
            {
                "_id": object_id,
                "active": True,
            }
        )

        if not user:

            raise HTTPException(
                status_code=404,
                detail="User not found or inactive",
            )

        password_hash = user.get(
            "passwordHash"
        )

        if not password_hash:

            raise HTTPException(
                status_code=400,
                detail="Password is not configured",
            )

        if not verify_password(
            current_password,
            password_hash,
        ):

            raise HTTPException(
                status_code=400,
                detail="Current password is incorrect",
            )

        # =====================================================
        # 30-DAY RESTRICTION
        # =====================================================

        self._check_monthly_password_limit(
            user
        )

        now = utc_now()

        self.db[
            USERS
        ].update_one(
            {
                "_id": object_id,
            },
            {
                "$set": {
                    "passwordHash": hash_password(
                        new_password
                    ),
                    "forcePasswordChange": False,
                    "passwordLastChangedAt": now,
                }
            },
        )

    # =========================================================
    # REQUEST PASSWORD OTP
    # =========================================================

    def request_password_change_otp(
        self,
        email: str,
    ) -> dict:

        normalized_email = (
            email.strip().lower()
        )

        user = self.db[
            USERS
        ].find_one(
            {
                "email": normalized_email,
                "active": True,
                "role": "student",
            }
        )

        # -----------------------------------------------------
        # Do not reveal whether an email exists.
        # -----------------------------------------------------

        if not user:

            return {
                "success": True,
                "message": (
                    "If an active student account "
                    "exists for this email, an OTP "
                    "will be sent."
                ),
            }

        # =====================================================
        # 30-DAY RESTRICTION
        # =====================================================

        self._check_monthly_password_limit(
            user
        )

        # =====================================================
        # GENERATE OTP
        # =====================================================

        otp = f"{secrets.randbelow(1000000):06d}"

        otp_hash = self._hash_otp(
            otp
        )

        now = utc_now()

        expires_at = (
            now + timedelta(minutes=10)
        )

        # =====================================================
        # SAVE OTP
        # =====================================================

        self.db[
            USERS
        ].update_one(
            {
                "_id": user["_id"],
            },
            {
                "$set": {
                    "passwordOtpHash": otp_hash,
                    "passwordOtpExpiresAt": expires_at,
                    "passwordOtpAttempts": 0,
                    "passwordOtpRequestedAt": now,
                },
            },
        )

        # =====================================================
        # SEND OTP EMAIL
        # =====================================================

        try:

            result = (
                self.email_service.send_password_otp(
                    student_id=str(
                        user["_id"]
                    ),
                    email_address=user.get(
                        "email"
                    ),
                    student_name=user.get(
                        "name",
                        "Student",
                    ),
                    otp=otp,
                )
            )

        except Exception as exc:

            self.db[
                USERS
            ].update_one(
                {
                    "_id": user["_id"],
                },
                {
                    "$unset": {
                        "passwordOtpHash": "",
                        "passwordOtpExpiresAt": "",
                        "passwordOtpRequestedAt": "",
                    },
                    "$set": {
                        "passwordOtpAttempts": 0,
                    },
                },
            )

            raise HTTPException(
                status_code=500,
                detail=(
                    "Unable to send password OTP."
                ),
            ) from exc

        if (
            not isinstance(
                result,
                dict,
            )
            or result.get("status")
            != "SENT"
        ):

            self.db[
                USERS
            ].update_one(
                {
                    "_id": user["_id"],
                },
                {
                    "$unset": {
                        "passwordOtpHash": "",
                        "passwordOtpExpiresAt": "",
                        "passwordOtpRequestedAt": "",
                    },
                    "$set": {
                        "passwordOtpAttempts": 0,
                    },
                },
            )

            raise HTTPException(
                status_code=503,
                detail=(
                    "Password OTP could not be sent."
                ),
            )

        return {
            "success": True,
            "message": (
                "Password OTP has been sent "
                "to your registered email."
            ),
        }

    # =========================================================
    # VERIFY PASSWORD OTP
    # =========================================================

    def verify_password_change_otp(
        self,
        email: str,
        otp: str,
    ) -> dict:

        normalized_email = (
            email.strip().lower()
        )

        clean_otp = (
            str(otp).strip()
        )

        user = self.db[
            USERS
        ].find_one(
            {
                "email": normalized_email,
                "active": True,
                "role": "student",
            }
        )

        if not user:

            raise HTTPException(
                status_code=400,
                detail="Invalid OTP.",
            )

        otp_hash = user.get(
            "passwordOtpHash"
        )

        expires_at = user.get(
            "passwordOtpExpiresAt"
        )

        attempts = int(
            user.get(
                "passwordOtpAttempts",
                0,
            )
            or 0
        )

        if not otp_hash or not expires_at:

            raise HTTPException(
                status_code=400,
                detail=(
                    "OTP is invalid or has expired."
                ),
            )

        if attempts >= 5:

            self._clear_password_otp(
                user["_id"]
            )

            raise HTTPException(
                status_code=429,
                detail=(
                    "Too many incorrect OTP attempts. "
                    "Please request a new OTP."
                ),
            )

        now = utc_now()

        expires_at = self._as_utc_datetime(
            expires_at
        )

        if now >= expires_at:

            self._clear_password_otp(
                user["_id"]
            )

            raise HTTPException(
                status_code=400,
                detail=(
                    "OTP has expired. "
                    "Please request a new OTP."
                ),
            )

        submitted_hash = self._hash_otp(
            clean_otp
        )

        if not secrets.compare_digest(
            submitted_hash,
            otp_hash,
        ):

            self.db[
                USERS
            ].update_one(
                {
                    "_id": user["_id"],
                },
                {
                    "$inc": {
                        "passwordOtpAttempts": 1,
                    }
                },
            )

            raise HTTPException(
                status_code=400,
                detail="Invalid OTP.",
            )

        # =====================================================
        # OTP VERIFIED
        # =====================================================

        verification_token = (
            secrets.token_urlsafe(32)
        )

        verification_hash = (
            self._hash_otp(
                verification_token
            )
        )

        verification_expires_at = (
            now + timedelta(minutes=10)
        )

        self.db[
            USERS
        ].update_one(
            {
                "_id": user["_id"],
            },
            {
                "$set": {
                    "passwordOtpVerifiedHash": (
                        verification_hash
                    ),
                    "passwordOtpVerifiedExpiresAt": (
                        verification_expires_at
                    ),
                },
                "$unset": {
                    "passwordOtpHash": "",
                    "passwordOtpExpiresAt": "",
                },
            },
        )

        return {
            "success": True,
            "message": (
                "OTP verified successfully."
            ),
            "verificationToken": (
                verification_token
            ),
        }

    # =========================================================
    # CHANGE PASSWORD USING VERIFIED OTP
    # =========================================================

    def change_password_with_otp(
        self,
        email: str,
        verification_token: str,
        new_password: str,
    ) -> None:

        normalized_email = (
            email.strip().lower()
        )

        user = self.db[
            USERS
        ].find_one(
            {
                "email": normalized_email,
                "active": True,
                "role": "student",
            }
        )

        if not user:

            raise HTTPException(
                status_code=400,
                detail=(
                    "Invalid password reset request."
                ),
            )

        # =====================================================
        # 30-DAY RESTRICTION
        # =====================================================

        self._check_monthly_password_limit(
            user
        )

        # =====================================================
        # VERIFY TOKEN
        # =====================================================

        stored_hash = user.get(
            "passwordOtpVerifiedHash"
        )

        expires_at = user.get(
            "passwordOtpVerifiedExpiresAt"
        )

        if (
            not stored_hash
            or not expires_at
        ):

            raise HTTPException(
                status_code=400,
                detail=(
                    "Password change verification "
                    "is invalid or expired."
                ),
            )

        now = utc_now()

        expires_at = self._as_utc_datetime(
            expires_at
        )

        if now >= expires_at:

            self._clear_password_verification(
                user["_id"]
            )

            raise HTTPException(
                status_code=400,
                detail=(
                    "Password change verification "
                    "has expired."
                ),
            )

        submitted_hash = self._hash_otp(
            verification_token
        )

        if not secrets.compare_digest(
            submitted_hash,
            stored_hash,
        ):

            raise HTTPException(
                status_code=400,
                detail=(
                    "Invalid password change verification."
                ),
            )

        # =====================================================
        # CHANGE PASSWORD
        # =====================================================

        self.db[
            USERS
        ].update_one(
            {
                "_id": user["_id"],
            },
            {
                "$set": {
                    "passwordHash": hash_password(
                        new_password
                    ),
                    "forcePasswordChange": False,
                    "passwordLastChangedAt": now,
                },
                "$unset": {
                    "passwordOtpVerifiedHash": "",
                    "passwordOtpVerifiedExpiresAt": "",
                    "passwordOtpHash": "",
                    "passwordOtpExpiresAt": "",
                    "passwordOtpRequestedAt": "",
                },
            },
        )

    # =========================================================
    # ADMIN PASSWORD RESET
    # =========================================================

    def reset_password(
        self,
        user_id: str,
        new_password: str,
    ) -> None:

        object_id = self._object_id(
            user_id
        )

        user = self.db[
            USERS
        ].find_one(
            {
                "_id": object_id,
            }
        )

        if not user:

            raise HTTPException(
                status_code=404,
                detail="User not found",
            )

        self.db[
            USERS
        ].update_one(
            {
                "_id": object_id,
            },
            {
                "$set": {
                    "passwordHash": hash_password(
                        new_password
                    ),
                    "forcePasswordChange": True,
                },
                "$unset": {
                    "passwordOtpHash": "",
                    "passwordOtpExpiresAt": "",
                    "passwordOtpRequestedAt": "",
                    "passwordOtpVerifiedHash": "",
                    "passwordOtpVerifiedExpiresAt": "",
                },
            },
        )

    # =========================================================
    # DEFAULT ADMIN
    # =========================================================

    def ensure_default_admin(
        self,
        email: str,
        password: str,
        name: str,
    ) -> None:

        existing_admin = self.db[
            USERS
        ].find_one(
            {
                "role": "admin",
            }
        )

        if existing_admin:
            return

        self.db[
            USERS
        ].insert_one(
            {
                "name": name.strip(),

                "email": (
                    email.strip().lower()
                ),

                "passwordHash": hash_password(
                    password
                ),

                "role": "admin",

                "vtuNumber": None,

                "portalUsername": None,

                "portalPasswordEncrypted": None,

                "portalCredentialsConfigured": False,

                "phoneNumber": None,

                "parentName": None,

                "parentPhone": None,

                "branch": None,

                "year": None,

                "semester": None,

                "section": None,

                "batch": None,

                "photoUrl": None,

                "smsEnabled": False,

                "notificationsEnabled": True,

                "active": True,

                "forcePasswordChange": False,

                # Password tracking
                "passwordLastChangedAt": None,

                "passwordOtpHash": None,

                "passwordOtpExpiresAt": None,

                "passwordOtpAttempts": 0,

                "passwordOtpRequestedAt": None,

                "passwordOtpVerifiedHash": None,

                "passwordOtpVerifiedExpiresAt": None,

                "portalSynced": False,

                "lastSyncedAt": None,

                "source": "system",
            }
        )

    # =========================================================
    # 30-DAY PASSWORD LIMIT
    # =========================================================

    def _check_monthly_password_limit(
        self,
        user: dict,
    ) -> None:

        last_changed = user.get(
            "passwordLastChangedAt"
        )

        # -----------------------------------------------------
        # Existing students who have never changed their
        # application password are allowed to change it.
        # -----------------------------------------------------

        if not last_changed:
            return

        last_changed = (
            self._as_utc_datetime(
                last_changed
            )
        )

        now = utc_now()

        next_allowed = (
            last_changed
            + timedelta(
                days=self.PASSWORD_CHANGE_INTERVAL_DAYS
            )
        )

        # -----------------------------------------------------
        # STILL LOCKED
        # -----------------------------------------------------

        if now < next_allowed:

            remaining = (
                next_allowed - now
            )

            remaining_seconds = (
                remaining.total_seconds()
            )

            remaining_days = max(
                1,
                int(
                    (
                        remaining_seconds
                        + 86399
                    )
                    // 86400
                ),
            )

            # -------------------------------------------------
            # Exact date for frontend/user message.
            # -------------------------------------------------

            available_date = (
                next_allowed.strftime(
                    "%d %B %Y"
                )
            )

            raise HTTPException(
                status_code=429,
                detail=(
                    "You recently changed your password. "
                    f"Please wait {remaining_days} "
                    f"day(s) before changing it again. "
                    f"You can change your password "
                    f"again on {available_date}."
                ),
            )

    # =========================================================
    # PASSWORD CHANGE STATUS
    # =========================================================
    #
    # Used by /auth/me so the frontend can immediately know
    # whether the student can change the password.
    #
    # This method only REPORTS the status.
    #
    # _check_monthly_password_limit() remains the actual
    # security enforcement.
    #
    # =========================================================

    def get_password_change_status(
        self,
        user: dict,
    ) -> dict:

        last_changed = user.get(
            "passwordLastChangedAt"
        )

        # -----------------------------------------------------
        # Password has never been changed.
        # -----------------------------------------------------

        if not last_changed:

            return {
                "passwordLastChangedAt": None,

                "passwordChangeAllowed": True,

                "passwordChangeRemainingDays": 0,

                "passwordChangeAvailableDate": None,
            }

        # -----------------------------------------------------
        # Normalize stored datetime.
        # -----------------------------------------------------

        last_changed = (
            self._as_utc_datetime(
                last_changed
            )
        )

        now = utc_now()

        # -----------------------------------------------------
        # Calculate next allowed date.
        # -----------------------------------------------------

        next_allowed = (
            last_changed
            + timedelta(
                days=self.PASSWORD_CHANGE_INTERVAL_DAYS
            )
        )

        # -----------------------------------------------------
        # 30 DAYS COMPLETED
        # -----------------------------------------------------

        if now >= next_allowed:

            return {
                "passwordLastChangedAt": (
                    last_changed.isoformat()
                ),

                "passwordChangeAllowed": True,

                "passwordChangeRemainingDays": 0,

                "passwordChangeAvailableDate": (
                    next_allowed.strftime(
                        "%d %B %Y"
                    )
                ),
            }

        # -----------------------------------------------------
        # STILL LOCKED
        # -----------------------------------------------------

        remaining = (
            next_allowed - now
        )

        remaining_seconds = (
            remaining.total_seconds()
        )

        remaining_days = max(
            1,
            int(
                (
                    remaining_seconds
                    + 86399
                )
                // 86400
            ),
        )

        return {
            "passwordLastChangedAt": (
                last_changed.isoformat()
            ),

            "passwordChangeAllowed": False,

            "passwordChangeRemainingDays": (
                remaining_days
            ),

            "passwordChangeAvailableDate": (
                next_allowed.strftime(
                    "%d %B %Y"
                )
            ),
        }

    # =========================================================
    # NORMALIZE DATETIME TO UTC
    # =========================================================

    @staticmethod
    def _as_utc_datetime(
        value: datetime,
    ) -> datetime:

        if value.tzinfo is None:

            return value.replace(
                tzinfo=timezone.utc
            )

        return value.astimezone(
            timezone.utc
        )

    # =========================================================
    # HASH OTP / VERIFICATION TOKEN
    # =========================================================

    @staticmethod
    def _hash_otp(
        value: str,
    ) -> str:

        return hashlib.sha256(
            value.encode(
                "utf-8"
            )
        ).hexdigest()

    # =========================================================
    # CLEAR OTP
    # =========================================================

    def _clear_password_otp(
        self,
        user_id: ObjectId,
    ) -> None:

        self.db[
            USERS
        ].update_one(
            {
                "_id": user_id,
            },
            {
                "$unset": {
                    "passwordOtpHash": "",
                    "passwordOtpExpiresAt": "",
                    "passwordOtpRequestedAt": "",
                },
                "$set": {
                    "passwordOtpAttempts": 0,
                },
            },
        )

    # =========================================================
    # CLEAR VERIFIED TOKEN
    # =========================================================

    def _clear_password_verification(
        self,
        user_id: ObjectId,
    ) -> None:

        self.db[
            USERS
        ].update_one(
            {
                "_id": user_id,
            },
            {
                "$unset": {
                    "passwordOtpVerifiedHash": "",
                    "passwordOtpVerifiedExpiresAt": "",
                }
            },
        )

    # =========================================================
    # OBJECT ID HELPER
    # =========================================================

    def _object_id(
        self,
        user_id: str,
    ) -> ObjectId:

        try:

            return ObjectId(
                user_id
            )

        except Exception as exc:

            raise HTTPException(
                status_code=400,
                detail="Invalid user ID",
            ) from exc