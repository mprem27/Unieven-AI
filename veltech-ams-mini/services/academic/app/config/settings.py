from functools import lru_cache
from typing import List

from pydantic import Field, field_validator
from pydantic_settings import (
    BaseSettings,
    SettingsConfigDict,
)


class Settings(BaseSettings):
    # =====================================================
    # APPLICATION
    # =====================================================

    app_name: str = "Smart Attendance API"

    app_env: str = "development"

    api_v1_prefix: str = "/api/v1"

    # =====================================================
    # DATABASE
    # =====================================================

    mongo_uri: str = (
        "mongodb://localhost:27017"
    )

    mongo_db_name: str = (
        "smart_attendance"
    )
    campus_service_key: str = ""

    # =====================================================
    # JWT AUTHENTICATION
    # =====================================================

    jwt_secret: str = (
        "change-this-to-a-long-random-secret"
    )

    jwt_algorithm: str = "HS256"

    # -----------------------------------------------------
    # LOGIN SESSION
    # -----------------------------------------------------

    access_token_expire_minutes: int = 43200

    # =====================================================
    # CORS
    # =====================================================

    cors_origins: List[str] = Field(
        default_factory=lambda: [
            "http://localhost:5173",
            "http://127.0.0.1:5173",
        ]
    )

    # =====================================================
    # COLLEGE / PARENT PORTAL
    # =====================================================

    college_base_url: str = (
        "https://miniapps.veltech.edu.in"
    )

    college_parent_login_url: str = (
        "https://miniapps.veltech.edu.in/"
        "miniapps/parent_login.php"
    )

    college_parent_dashboard_url: str = (
        "https://miniapps.veltech.edu.in/"
        "miniapps/parent_dashboard.php"
    )

    # =====================================================
    # ADAPTER MODE
    # =====================================================

    college_adapter_mode: str = "mock"

    # =====================================================
    # PORTAL REQUEST SETTINGS
    # =====================================================

    sync_request_timeout_seconds: int = 30

    portal_session_timeout_seconds: int = 60

    sync_max_retries: int = 3

    # =====================================================
    # PARENT PORTAL SYNCHRONIZATION
    # =====================================================

    sync_enabled: bool = False

    sync_interval_minutes: int = 60

    # =====================================================
    # STUDENT DATA SYNCHRONIZATION
    # =====================================================

    sync_student_profile: bool = True

    sync_student_photo: bool = True

    sync_subjects: bool = True

    sync_attendance: bool = True

    sync_timetable: bool = True

    sync_other_data: bool = True

    # =====================================================
    # ADMIN
    # =====================================================

    default_admin_email: str = (
        "admin@example.com"
    )

    default_admin_password: str = (
        "Admin@12345"
    )

    default_admin_name: str = "Admin"

    # =====================================================
    # USER MANAGEMENT
    # =====================================================

    admin_can_manage_users: bool = True

    admin_can_create_users: bool = True

    admin_can_edit_users: bool = True

    admin_can_delete_users: bool = True

    # =====================================================
    # ATTENDANCE
    # =====================================================

    admin_can_manage_attendance: bool = True

    # =====================================================
    # SUBJECTS
    # =====================================================

    admin_can_manage_subjects: bool = True

    # =====================================================
    # TIMETABLE
    # =====================================================

    admin_can_manage_timetable: bool = True

    # =====================================================
    # NOTIFICATIONS
    # =====================================================

    admin_can_manage_notifications: bool = True

    # =====================================================
    # PASSWORD
    # =====================================================

    admin_can_reset_passwords: bool = True

    force_password_change_after_admin_reset: bool = True

    # =====================================================
    # SYNCHRONIZATION
    # =====================================================

    admin_can_sync: bool = True

    admin_can_view_sync_logs: bool = True

    # =====================================================
    # LOGS
    # =====================================================

    admin_can_view_audit_logs: bool = True

    admin_can_view_sms_logs: bool = True

    # =====================================================
    # PASSWORD SECURITY
    # =====================================================

    expose_passwords: bool = False

    # =====================================================
    # COLLEGE PORTAL CREDENTIAL ENCRYPTION
    # =====================================================

    portal_credential_encryption_key: str = ""

    # =====================================================
    # AUDIT LOGGING
    # =====================================================

    audit_logging_enabled: bool = True

    audit_profile_changes: bool = True

    audit_attendance_changes: bool = True

    audit_subject_changes: bool = True

    audit_timetable_changes: bool = True

    audit_password_changes: bool = True

    # =====================================================
    # SMS
    # =====================================================

    sms_mode: str = "TEST"

    sms_api_key: str = ""

    sms_sender_id: str = ""

    sms_dlt_entity_id: str = ""

    sms_dlt_template_id: str = ""

    sms_flow_id: str = ""

    # =====================================================
    # SMS BEHAVIOUR
    # =====================================================

    sms_enabled: bool = False

    sms_attendance_alerts: bool = True

    sms_absence_alerts: bool = True

    attendance_warning_percentage: float = 75.0

    attendance_critical_percentage: float = 65.0

    sms_duplicate_protection: bool = True

    # =====================================================
    # NOTIFICATIONS
    # =====================================================

    notifications_enabled: bool = True

    attendance_change_notifications: bool = True

    attendance_warning_notifications: bool = True

    attendance_critical_notifications: bool = True

    # =====================================================
    # EMAIL NOTIFICATIONS
    # =====================================================
    #
    # Added for:
    #
    # 1. Attendance absent emails
    # 2. Password OTP emails
    #
    # Existing notification/SMS settings are untouched.
    # =====================================================

    email_enabled: bool = False

    email_host: str = "smtp.gmail.com"

    email_port: int = 587

    email_username: str = ""

    email_password: str = ""

    email_from: str = ""

    email_from_name: str = (
        "Smart Attendance System"
    )

    email_use_tls: bool = True

    email_attendance_alerts: bool = True

    # =====================================================
    # FILE / PHOTO STORAGE
    # =====================================================

    student_photo_directory: str = (
        "uploads/students"
    )

    max_student_photo_size_mb: int = 5

    # =====================================================
    # LOGGING
    # =====================================================

    log_level: str = "INFO"

    # =====================================================
    # PYDANTIC SETTINGS CONFIGURATION
    # =====================================================

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # =====================================================
    # VALIDATORS
    # =====================================================

    @field_validator(
        "cors_origins",
        mode="before",
    )
    @classmethod
    def parse_cors_origins(cls, value):
        if isinstance(value, str):
            return [
                item.strip()
                for item in value.split(",")
                if item.strip()
            ]

        return value

    # =====================================================
    # COLLEGE ADAPTER MODE
    # =====================================================

    @field_validator(
        "college_adapter_mode",
        mode="before",
    )
    @classmethod
    def normalize_adapter_mode(cls, value):
        if isinstance(value, str):
            value = value.strip().lower()

            if value not in {
                "mock",
                "portal",
            }:
                raise ValueError(
                    "college_adapter_mode must be "
                    "'mock' or 'portal'"
                )

            return value

        return value

    # =====================================================
    # SMS MODE
    # =====================================================

    @field_validator(
        "sms_mode",
        mode="before",
    )
    @classmethod
    def normalize_sms_mode(cls, value):
        if isinstance(value, str):
            value = value.strip().upper()

            if value not in {
                "TEST",
                "PRODUCTION",
            }:
                raise ValueError(
                    "sms_mode must be "
                    "'TEST' or 'PRODUCTION'"
                )

            return value

        return value

    # =====================================================
    # LOG LEVEL
    # =====================================================

    @field_validator(
        "log_level",
        mode="before",
    )
    @classmethod
    def normalize_log_level(cls, value):
        if isinstance(value, str):
            return value.strip().upper()

        return value

    # =====================================================
    # POSITIVE VALUES
    # =====================================================

    @field_validator(
        "sync_interval_minutes",
        "sync_request_timeout_seconds",
        "portal_session_timeout_seconds",
        "sync_max_retries",
        mode="after",
    )
    @classmethod
    def validate_positive_values(cls, value):
        if value <= 0:
            raise ValueError(
                "Value must be greater than 0"
            )

        return value

    # =====================================================
    # PERCENTAGE VALIDATION
    # =====================================================

    @field_validator(
        "attendance_warning_percentage",
        "attendance_critical_percentage",
        mode="after",
    )
    @classmethod
    def validate_percentage(cls, value):
        if not 0 <= value <= 100:
            raise ValueError(
                "Percentage must be between 0 and 100"
            )

        return value


# =========================================================
# SETTINGS SINGLETON
# =========================================================

@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
