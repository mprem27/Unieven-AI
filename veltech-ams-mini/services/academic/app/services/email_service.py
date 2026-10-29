from __future__ import annotations

import logging
import secrets
import smtplib
from datetime import datetime
from email.message import EmailMessage

from pymongo.database import Database

from app.config.settings import settings
from app.utils.dates import utc_now


logger = logging.getLogger(__name__)

EMAIL_LOGS = "email_logs"


class EmailService:
    """
    Handles email notifications.

    This service does NOT modify attendance data.

    Email failures are logged and returned as a status
    instead of breaking the attendance notification flow.
    """

    def __init__(self, db: Database):
        self.db = db

    # =====================================================
    # SEND ATTENDANCE EMAIL
    # =====================================================

    def send_attendance_email(
        self,
        student_id: str,
        email_address: str | None,
        student_name: str,
        subject_name: str,
        subject_code: str | None,
        date: str,
        message: str,
        attendance_percentage: float | None = None,
    ) -> dict:

        # =================================================
        # NORMALIZE EMAIL
        # =================================================

        email = (
            str(email_address).strip()
            if email_address
            else None
        )

        # =================================================
        # NO EMAIL
        # =================================================

        if not email:
            result = {
                "status": "SKIPPED_NO_EMAIL",
                "messageId": None,
                "error": None,
                "sentAt": None,
            }

            self._log_email(
                student_id=student_id,
                email_address=None,
                subject_name=subject_name,
                email_type="ATTENDANCE_ABSENT",
                status=result["status"],
                message_id=None,
                error=None,
                sent_at=None,
            )

            return result

        # =================================================
        # EMAIL DISABLED
        # =================================================

        if not bool(
            getattr(
                settings,
                "email_enabled",
                False,
            )
        ):

            result = {
                "status": "DISABLED",
                "messageId": None,
                "error": None,
                "sentAt": None,
            }

            self._log_email(
                student_id=student_id,
                email_address=email,
                subject_name=subject_name,
                email_type="ATTENDANCE_ABSENT",
                status=result["status"],
                message_id=None,
                error=None,
                sent_at=None,
            )

            return result

        # =================================================
        # ATTENDANCE EMAILS DISABLED
        # =================================================

        if not bool(
            getattr(
                settings,
                "email_attendance_alerts",
                True,
            )
        ):

            result = {
                "status": "DISABLED",
                "messageId": None,
                "error": None,
                "sentAt": None,
            }

            self._log_email(
                student_id=student_id,
                email_address=email,
                subject_name=subject_name,
                email_type="ATTENDANCE_ABSENT",
                status=result["status"],
                message_id=None,
                error=None,
                sent_at=None,
            )

            return result

        # =================================================
        # SMTP CONFIGURATION
        # =================================================

        smtp_config = self._get_smtp_config()

        configuration_error = (
            self._validate_smtp_config(
                smtp_config
            )
        )

        if configuration_error:

            return self._configuration_error(
                student_id=student_id,
                email_address=email,
                subject_name=subject_name,
                error=configuration_error,
                email_type="ATTENDANCE_ABSENT",
            )

        # =================================================
        # BUILD EMAIL
        # =================================================

        subject = (
            f"Attendance Alert - "
            f"{subject_name}"
        )

        body_lines = [
            f"Dear {student_name or 'Student'},",
            "",
            "This is an attendance notification "
            "from the Smart Attendance System.",
            "",
            f"Subject: {subject_name}",
        ]

        if subject_code:
            body_lines.append(
                f"Subject Code: {subject_code}"
            )

        body_lines.extend(
            [
                f"Date: {date}",
                "Attendance Status: ABSENT",
            ]
        )

        if attendance_percentage is not None:
            body_lines.append(
                "Current Attendance Percentage: "
                f"{attendance_percentage:.2f}%"
            )

        body_lines.extend(
            [
                "",
                message,
                "",
                "Please check your attendance "
                "details in the student portal.",
                "",
                "Regards,",
                smtp_config["email_from_name"],
                "Smart Attendance System",
            ]
        )

        email_body = "\n".join(
            body_lines
        )

        email_message = self._create_message(
            to_email=email,
            subject=subject,
            body=email_body,
            smtp_config=smtp_config,
        )

        # =================================================
        # SEND EMAIL
        # =================================================

        try:

            self._send_message(
                email_message,
                smtp_config,
            )

            sent_at = utc_now()

            result = {
                "status": "SENT",
                "messageId": None,
                "error": None,
                "sentAt": sent_at,
            }

            self._log_email(
                student_id=student_id,
                email_address=email,
                subject_name=subject_name,
                email_type="ATTENDANCE_ABSENT",
                status="SENT",
                message_id=None,
                error=None,
                sent_at=sent_at,
            )

            logger.info(
                "Attendance email sent successfully "
                "to %s for student %s",
                email,
                student_id,
            )

            return result

        except Exception as exc:

            error_message = str(exc)

            logger.exception(
                "Failed to send attendance email "
                "to %s for student %s",
                email,
                student_id,
            )

            self._log_email(
                student_id=student_id,
                email_address=email,
                subject_name=subject_name,
                email_type="ATTENDANCE_ABSENT",
                status="FAILED",
                message_id=None,
                error=error_message,
                sent_at=None,
            )

            return {
                "status": "FAILED",
                "messageId": None,
                "error": error_message,
                "sentAt": None,
            }

    # =====================================================
    # SEND PASSWORD OTP EMAIL
    # =====================================================

    def send_password_otp(
        self,
        student_id: str,
        email_address: str | None,
        student_name: str,
        otp: str,
    ) -> dict:
        """
        Send a password-change OTP to the student's
        registered email address.

        The OTP is generated by AuthService.
        This method only sends it.

        The plain OTP is never stored by this service.
        """

        # =================================================
        # NORMALIZE EMAIL
        # =================================================

        email = (
            str(email_address).strip()
            if email_address
            else None
        )

        # =================================================
        # NO EMAIL
        # =================================================

        if not email:

            result = {
                "status": "SKIPPED_NO_EMAIL",
                "messageId": None,
                "error": None,
                "sentAt": None,
            }

            self._log_email(
                student_id=student_id,
                email_address=None,
                subject_name="Password Change",
                email_type="PASSWORD_OTP",
                status=result["status"],
                message_id=None,
                error=None,
                sent_at=None,
            )

            return result

        # =================================================
        # EMAIL DISABLED
        # =================================================

        if not bool(
            getattr(
                settings,
                "email_enabled",
                False,
            )
        ):

            result = {
                "status": "DISABLED",
                "messageId": None,
                "error": None,
                "sentAt": None,
            }

            self._log_email(
                student_id=student_id,
                email_address=email,
                subject_name="Password Change",
                email_type="PASSWORD_OTP",
                status=result["status"],
                message_id=None,
                error=None,
                sent_at=None,
            )

            return result

        # =================================================
        # GENERATE DISPLAY-SAFE OTP
        # =================================================
        #
        # AuthService already generates the real OTP.
        #
        # This validation prevents accidentally sending
        # malformed values.
        # =================================================

        clean_otp = str(otp).strip()

        if (
            len(clean_otp) != 6
            or not clean_otp.isdigit()
        ):

            error = (
                "Password OTP must contain "
                "exactly 6 digits."
            )

            self._log_email(
                student_id=student_id,
                email_address=email,
                subject_name="Password Change",
                email_type="PASSWORD_OTP",
                status="FAILED",
                message_id=None,
                error=error,
                sent_at=None,
            )

            return {
                "status": "FAILED",
                "messageId": None,
                "error": error,
                "sentAt": None,
            }

        # =================================================
        # SMTP CONFIGURATION
        # =================================================

        smtp_config = self._get_smtp_config()

        configuration_error = (
            self._validate_smtp_config(
                smtp_config
            )
        )

        if configuration_error:

            return self._configuration_error(
                student_id=student_id,
                email_address=email,
                subject_name="Password Change",
                error=configuration_error,
                email_type="PASSWORD_OTP",
            )

        # =================================================
        # BUILD OTP EMAIL
        # =================================================

        subject = (
            "Password Change OTP - "
            "Smart Attendance System"
        )

        body_lines = [
            f"Dear {student_name or 'Student'},",
            "",
            "We received a request to change your "
            "Smart Attendance System password.",
            "",
            f"Your OTP is: {clean_otp}",
            "",
            "This OTP is valid for 10 minutes.",
            "",
            "For your security:",
            "- Do not share this OTP with anyone.",
            "- The Smart Attendance System will "
            "never ask you to share your OTP.",
            "",
            "If you did not request a password change, "
            "you can safely ignore this email.",
            "",
            "Regards,",
            smtp_config["email_from_name"],
            "Smart Attendance System",
        ]

        email_body = "\n".join(
            body_lines
        )

        email_message = self._create_message(
            to_email=email,
            subject=subject,
            body=email_body,
            smtp_config=smtp_config,
        )

        # =================================================
        # SEND OTP EMAIL
        # =================================================

        try:

            self._send_message(
                email_message,
                smtp_config,
            )

            sent_at = utc_now()

            result = {
                "status": "SENT",
                "messageId": None,
                "error": None,
                "sentAt": sent_at,
            }

            self._log_email(
                student_id=student_id,
                email_address=email,
                subject_name="Password Change",
                email_type="PASSWORD_OTP",
                status="SENT",
                message_id=None,
                error=None,
                sent_at=sent_at,
            )

            logger.info(
                "Password OTP email sent successfully "
                "to %s for student %s",
                email,
                student_id,
            )

            return result

        except Exception as exc:

            error_message = str(exc)

            logger.exception(
                "Failed to send password OTP email "
                "to %s for student %s",
                email,
                student_id,
            )

            self._log_email(
                student_id=student_id,
                email_address=email,
                subject_name="Password Change",
                email_type="PASSWORD_OTP",
                status="FAILED",
                message_id=None,
                error=error_message,
                sent_at=None,
            )

            return {
                "status": "FAILED",
                "messageId": None,
                "error": error_message,
                "sentAt": None,
            }

    # =====================================================
    # SMTP CONFIG
    # =====================================================

    def _get_smtp_config(self) -> dict:

        smtp_host = str(
            getattr(
                settings,
                "email_host",
                "",
            )
            or ""
        ).strip()

        smtp_port = int(
            getattr(
                settings,
                "email_port",
                587,
            )
            or 587
        )

        smtp_username = str(
            getattr(
                settings,
                "email_username",
                "",
            )
            or ""
        ).strip()

        smtp_password = str(
            getattr(
                settings,
                "email_password",
                "",
            )
            or ""
        )

        email_from = str(
            getattr(
                settings,
                "email_from",
                "",
            )
            or ""
        ).strip()

        email_from_name = str(
            getattr(
                settings,
                "email_from_name",
                "Smart Attendance System",
            )
            or "Smart Attendance System"
        ).strip()

        use_tls = bool(
            getattr(
                settings,
                "email_use_tls",
                True,
            )
        )

        if not email_from:
            email_from = smtp_username

        return {
            "host": smtp_host,
            "port": smtp_port,
            "username": smtp_username,
            "password": smtp_password,
            "email_from": email_from,
            "email_from_name": email_from_name,
            "use_tls": use_tls,
        }

    # =====================================================
    # VALIDATE SMTP CONFIG
    # =====================================================

    def _validate_smtp_config(
        self,
        smtp_config: dict,
    ) -> str | None:

        if not smtp_config["host"]:
            return (
                "Email SMTP host is not configured."
            )

        if not smtp_config["username"]:
            return (
                "Email username is not configured."
            )

        if not smtp_config["password"]:
            return (
                "Email password/app password "
                "is not configured."
            )

        return None

    # =====================================================
    # CREATE EMAIL MESSAGE
    # =====================================================

    def _create_message(
        self,
        to_email: str,
        subject: str,
        body: str,
        smtp_config: dict,
    ) -> EmailMessage:

        email_message = EmailMessage()

        email_message["From"] = (
            f"{smtp_config['email_from_name']} "
            f"<{smtp_config['email_from']}>"
        )

        email_message["To"] = to_email

        email_message["Subject"] = subject

        email_message.set_content(
            body
        )

        return email_message

    # =====================================================
    # SEND EMAIL MESSAGE
    # =====================================================

    def _send_message(
        self,
        email_message: EmailMessage,
        smtp_config: dict,
    ) -> None:

        with smtplib.SMTP(
            smtp_config["host"],
            smtp_config["port"],
            timeout=30,
        ) as smtp:

            if smtp_config["use_tls"]:
                smtp.starttls()

            smtp.login(
                smtp_config["username"],
                smtp_config["password"],
            )

            smtp.send_message(
                email_message
            )

    # =====================================================
    # CONFIGURATION ERROR
    # =====================================================

    def _configuration_error(
        self,
        student_id: str,
        email_address: str | None,
        subject_name: str,
        error: str,
        email_type: str,
    ) -> dict:

        logger.warning(
            "Email configuration error: %s",
            error,
        )

        self._log_email(
            student_id=student_id,
            email_address=email_address,
            subject_name=subject_name,
            email_type=email_type,
            status="PROVIDER_NOT_CONFIGURED",
            message_id=None,
            error=error,
            sent_at=None,
        )

        return {
            "status": "PROVIDER_NOT_CONFIGURED",
            "messageId": None,
            "error": error,
            "sentAt": None,
        }

    # =====================================================
    # EMAIL LOG
    # =====================================================

    def _log_email(
        self,
        student_id: str,
        email_address: str | None,
        subject_name: str,
        email_type: str,
        status: str,
        message_id: str | None,
        error: str | None,
        sent_at: datetime | None,
    ) -> None:

        try:

            self.db[
                EMAIL_LOGS
            ].insert_one(
                {
                    "studentId": student_id,
                    "email": email_address,
                    "subjectName": subject_name,
                    "type": email_type,
                    "status": status,
                    "messageId": message_id,
                    "error": error,
                    "sentAt": sent_at,
                    "createdAt": utc_now(),
                }
            )

        except Exception:

            # Email logging failure must never
            # break the main notification flow.

            logger.exception(
                "Failed to save email log."
            )