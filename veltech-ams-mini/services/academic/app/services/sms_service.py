from pymongo.database import Database

from app.config.settings import settings
from app.models.notification import SMS_LOGS
from app.utils.dates import utc_now


class SMSService:
    """
    Handles SMS preparation, provider status, and SMS logging.

    IMPORTANT:
    - TEST mode never sends a real SMS.
    - PRODUCTION mode does not claim success until a real
      SMS provider is configured.
    - Every attempt is logged in MongoDB.
    """

    def __init__(self, db: Database):
        self.db = db

    # =====================================================
    # SEND SMS
    # =====================================================

    def send_sms(
        self,
        student_id: str,
        phone_number: str | None,
        message: str,
    ) -> dict:
        """
        Process an SMS request and return its delivery status.

        Current supported modes:

        TEST
            Logs the SMS without sending it.

        PRODUCTION
            Requires a real SMS provider configuration.

        Any other value
            SMS is treated as disabled.
        """

        mode = str(
            settings.sms_mode or ""
        ).strip().upper()

        phone = (
            str(phone_number).strip()
            if phone_number
            else None
        )

        sms_message = str(
            message or ""
        ).strip()

        created_at = utc_now()

        status = "DISABLED"
        message_id = None
        error = None

        # =================================================
        # INVALID MESSAGE
        # =================================================

        if not sms_message:
            status = "FAILED"
            error = "SMS message is empty."

        # =================================================
        # NO PHONE NUMBER
        # =================================================

        elif not phone:
            status = "SKIPPED_NO_PHONE"

        # =================================================
        # TEST MODE
        # =================================================

        elif mode == "TEST":
            """
            TEST mode intentionally does not contact
            an external SMS provider.
            """

            status = "TEST_LOGGED"

        # =================================================
        # PRODUCTION MODE
        # =================================================

        elif mode == "PRODUCTION":

            # -------------------------------------------------
            # Provider configuration check
            # -------------------------------------------------

            provider_configured = bool(
                str(
                    settings.sms_api_key or ""
                ).strip()
            )

            if not provider_configured:
                status = (
                    "PROVIDER_NOT_CONFIGURED"
                )

                error = (
                    "SMS provider API key is not configured."
                )

            else:
                # -------------------------------------------------
                # IMPORTANT
                # -------------------------------------------------
                # Do not mark the SMS as SENT here.
                #
                # A real provider request must be implemented
                # before this status can become SENT.
                # -------------------------------------------------

                status = (
                    "PROVIDER_NOT_CONFIGURED"
                )

                error = (
                    "SMS provider integration is not "
                    "implemented yet."
                )

        # =================================================
        # UNKNOWN MODE
        # =================================================

        else:
            status = "DISABLED"

            error = (
                f"Unsupported SMS mode: {mode}"
            )

        # =================================================
        # LOG SMS
        # =================================================

        sms_log = {
            "studentId": student_id,
            "phoneNumber": phone,
            "message": sms_message,
            "mode": mode,
            "status": status,
            "messageId": message_id,
            "error": error,
            "createdAt": created_at,
            "updatedAt": created_at,
        }

        result = self.db[
            SMS_LOGS
        ].insert_one(
            sms_log
        )

        # =================================================
        # RETURN RESULT
        # =================================================

        return {
            "status": status,
            "messageId": message_id,
            "error": error,
            "logId": str(
                result.inserted_id
            ),
            "sentAt": (
                created_at
                if status == "SENT"
                else None
            ),
        }