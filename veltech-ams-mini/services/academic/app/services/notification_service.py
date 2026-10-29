from datetime import date as Date
from zoneinfo import ZoneInfo

from bson import ObjectId
from bson.errors import InvalidId
from fastapi import HTTPException
from pymongo.database import Database

from app.models.notification import NOTIFICATIONS
from app.models.user import USERS
from app.services.base import serialize_document
from app.services.sms_service import SMSService
from app.services.email_service import EmailService
from app.utils.dates import utc_now


class NotificationService:
    """
    Handles in-app notifications, email notifications,
    and SMS status.

    Attendance data itself is not modified here.
    """

    def __init__(self, db: Database):
        self.db = db

        # =================================================
        # EXISTING SMS SERVICE
        # =================================================

        self.sms_service = SMSService(db)

        # =================================================
        # EMAIL SERVICE
        # =================================================

        self.email_service = EmailService(db)

    # =====================================================
    # LIST STUDENT NOTIFICATIONS
    # =====================================================

    def list_notifications(
        self,
        student_id: str,
    ) -> list[dict]:

        cursor = (
            self.db[NOTIFICATIONS]
            .find(
                {
                    "studentId": student_id,
                }
            )
            .sort(
                "createdAt",
                -1,
            )
            .limit(100)
        )

        return [
            serialize_document(item)
            for item in cursor
        ]

    # =====================================================
    # LIST ALL NOTIFICATIONS
    # =====================================================

    def list_all_notifications(
        self,
    ) -> list[dict]:

        cursor = (
            self.db[NOTIFICATIONS]
            .find()
            .sort(
                "createdAt",
                -1,
            )
            .limit(500)
        )

        return [
            serialize_document(item)
            for item in cursor
        ]

    # =====================================================
    # UNREAD COUNT
    # =====================================================

    def get_unread_count(
        self,
        student_id: str,
    ) -> int:

        return self.db[
            NOTIFICATIONS
        ].count_documents(
            {
                "studentId": student_id,
                "read": False,
            }
        )

    # =====================================================
    # MARK ONE AS READ
    # =====================================================

    def mark_read(
        self,
        notification_id: str,
        student_id: str,
    ) -> dict:

        try:
            object_id = ObjectId(
                notification_id
            )

        except Exception as exc:
            raise HTTPException(
                status_code=400,
                detail="Invalid notification ID.",
            ) from exc

        result = self.db[
            NOTIFICATIONS
        ].update_one(
            {
                "_id": object_id,
                "studentId": student_id,
            },
            {
                "$set": {
                    "read": True,
                    "updatedAt": utc_now(),
                }
            },
        )

        if result.matched_count == 0:
            raise HTTPException(
                status_code=404,
                detail="Notification not found.",
            )

        return {
            "id": notification_id,
            "read": True,
        }

    # =====================================================
    # MARK ALL AS READ
    # =====================================================

    def mark_all_read(
        self,
        student_id: str,
    ) -> int:

        result = self.db[
            NOTIFICATIONS
        ].update_many(
            {
                "studentId": student_id,
                "read": False,
            },
            {
                "$set": {
                    "read": True,
                    "updatedAt": utc_now(),
                }
            },
        )

        return result.modified_count

    # =====================================================
    # DELETE ONE NOTIFICATION
    # =====================================================

    def delete_notification(
        self,
        notification_id: str,
        student_id: str,
    ) -> bool:

        try:
            object_id = ObjectId(
                notification_id
            )

        except Exception as exc:
            raise HTTPException(
                status_code=400,
                detail="Invalid notification ID.",
            ) from exc

        result = self.db[
            NOTIFICATIONS
        ].delete_one(
            {
                "_id": object_id,
                "studentId": student_id,
            }
        )

        return result.deleted_count > 0

    # =====================================================
    # CREATE ATTENDANCE NOTIFICATION
    # =====================================================

    def notify_new_absences(self, student_id: str, absent_entries: list[dict]) -> int:
        """Notify current-day source absences after the caller persists new rows.

        The storage caller owns detecting genuinely new records. Recheck the
        student's persisted source rows here, and claim each deterministic event
        before attempting delivery so retries cannot create duplicate alerts.
        Historical imports, missing periods and ambiguous source rows never alert.
        """
        try:
            student = self.db[USERS].find_one({'_id': ObjectId(student_id), 'role': 'student'})
        except (InvalidId, TypeError):
            return 0
        if (not student or student.get('absentAlertsEnabled') is not True
                or not student.get('notificationsEnabled', True)):
            return 0

        today = utc_now().astimezone(ZoneInfo('Asia/Kolkata')).date().isoformat()

        def record_key(row):
            return (str(row.get('subjectCode') or '').strip().upper(),
                    str(row.get('date') or '').strip(),
                    ' '.join(str(row.get('period') or '').split()))

        persisted = {
            record_key(row) for row in student.get('amsClassRecords', [])
            if isinstance(row, dict) and row.get('source') == 'ams'
            and str(row.get('status') or '').strip().lower() == 'absent'
        }
        created = 0
        for row in absent_entries:
            if (not isinstance(row, dict) or row.get('source') not in {'ams', 'college_portal'}
                    or str(row.get('status') or '').strip().lower() != 'absent'):
                continue
            code, day, period = record_key(row)
            if not code or not period or day != today or (code, day, period) not in persisted:
                continue
            notification = self.create_attendance_notification(
                student_id=student_id,
                subject_id=str(row.get('subjectId') or code),
                subject_name=str(row.get('subjectName') or code),
                date=day, old_status='', new_status='ABSENT',
                subject_code=code, period_id=period, new_only=True, source='ams',
            )
            created += notification is not None
        return created

    def create_attendance_notification(
        self, student_id: str, subject_id: str, subject_name: str,
        date: str, old_status: str, new_status: str,
        subject_code: str | None = None,
        attendance_percentage: float | None = None,
        period_id: str | None = None,
        *, new_only: bool = False, source: str = 'college_portal',
    ) -> dict | None:
        """Notify only a confirmed source change; claim the event before delivery.

        The deterministic identifier makes concurrent sync retries idempotent.
        No absence is inferred from an empty timetable or a missing source row.
        """
        from hashlib import sha256
        from pymongo.errors import DuplicateKeyError
        from app.services.push_notification_service import PushNotificationService

        new_status = str(new_status or '').strip().upper()
        old_status = str(old_status or '').strip().upper()
        if new_status not in {'ABSENT', 'PRESENT'} or new_status == old_status:
            return None
        # A newly imported present row is a baseline, not a correction.
        if new_status == 'PRESENT' and not old_status:
            return None
        try:
            record_date = Date.fromisoformat(str(date))
        except (ValueError, TypeError):
            return None
        if record_date > utc_now().astimezone(ZoneInfo('Asia/Kolkata')).date():
            return None
        try:
            student = self.db[USERS].find_one({'_id': ObjectId(student_id), 'role': 'student'})
        except Exception as exc:
            raise HTTPException(400, 'Invalid student ID.') from exc
        if not student or not student.get('notificationsEnabled', True):
            return None
        if new_status == 'ABSENT' and student.get('absentAlertsEnabled') is not True:
            return None

        course_key = str(subject_code or subject_id)
        event_key = f'attendance:{student_id}:{course_key}:{date}:{period_id or "day"}:{new_status}'
        existing = self.db[NOTIFICATIONS].find_one({'eventKey': event_key, 'studentId': student_id})
        if existing:
            return None if new_only else serialize_document(existing)
        absent = new_status == 'ABSENT'
        message = (f'You were marked absent for {subject_name} on {date}.' if absent else
                   f'Attendance corrected for {subject_name} on {date}: {old_status} to {new_status}.')
        now = utc_now()
        doc = {
            '_id': ObjectId(sha256(event_key.encode()).hexdigest()[:24]),
            'studentId': student_id, 'subjectId': str(subject_id),
            'subjectName': subject_name, 'subjectCode': subject_code,
            'date': date, 'attendanceStatus': new_status,
            'periodId': period_id,
            'attendancePercentage': attendance_percentage,
            'type': 'ATTENDANCE_ABSENT' if absent else 'ATTENDANCE_CORRECTED',
            'title': 'Attendance alert' if absent else 'Attendance corrected',
            'message': message, 'priority': 'HIGH' if absent else 'NORMAL',
            'read': False, 'emailStatus': 'NOT_REQUIRED', 'smsStatus': 'NOT_REQUIRED',
            'pushStatus': 'NOT_ATTEMPTED', 'pushAccepted': 0,
            'eventKey': event_key, 'source': source,
            'category': 'academic', 'link': '/attendance',
            'createdAt': now, 'updatedAt': now,
        }
        try:
            self.db[NOTIFICATIONS].insert_one(doc)
        except DuplicateKeyError:
            return None if new_only else serialize_document(self.db[NOTIFICATIONS].find_one({'_id': doc['_id']}))

        delivery = {}
        if absent:
            if student.get('email'):
                try:
                    result = self.email_service.send_attendance_email(
                        student_id=student_id, email_address=student['email'],
                        student_name=student.get('name', 'Student'),
                        subject_name=subject_name, subject_code=subject_code,
                        date=date, message=message, attendance_percentage=attendance_percentage)
                    delivery.update(emailStatus=result.get('status', 'FAILED'),
                                    emailMessageId=result.get('messageId'), emailSentAt=result.get('sentAt'))
                except Exception:
                    delivery['emailStatus'] = 'FAILED'
            else:
                delivery['emailStatus'] = 'SKIPPED_NO_EMAIL'
            if student.get('smsEnabled', True):
                try:
                    result = self.sms_service.send_sms(student_id=student_id, phone_number=student.get('phoneNumber'), message=message)
                    delivery.update(smsStatus=result.get('status', 'FAILED'),
                                    smsMessageId=result.get('messageId'), smsSentAt=result.get('sentAt'))
                except Exception:
                    delivery['smsStatus'] = 'FAILED'
            else:
                delivery['smsStatus'] = 'DISABLED'
        try:
            result = PushNotificationService(self.db).send_to_user(
                user_id=student_id, title='Campus update', message='Open your campus inbox to read your update.',
                notification_type=doc['type'], notification_id=str(doc['_id']), link='/attendance')
            accepted = result.get('accepted', result.get('sent', 0))
            delivery.update(pushStatus='ACCEPTED' if accepted else 'NOT_CONFIGURED' if not result.get('configured', True) or 'not configured' in result.get('reason', '').lower() else 'NOT_ACCEPTED', pushAccepted=accepted)
        except Exception:
            delivery['pushStatus'] = 'FAILED'
        self.db[NOTIFICATIONS].update_one({'_id': doc['_id']}, {'$set': delivery})
        doc.update(delivery)
        return serialize_document(doc)
