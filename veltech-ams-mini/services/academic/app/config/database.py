from pymongo import ASCENDING, MongoClient
from pymongo.database import Database

from app.config.settings import settings
from app.models.attendance import ATTENDANCE_RECORDS
from app.models.attendance_change import ATTENDANCE_CHANGES
from app.models.notification import NOTIFICATIONS, SMS_LOGS
from app.models.subject import SUBJECTS
from app.models.sync_log import SYNC_LOGS
from app.models.user import USERS
from app.models.timetable import TIMETABLE


class Mongo:
    client: MongoClient | None = None
    db: Database | None = None

    def connect(self) -> None:
        self.client = MongoClient(
            settings.mongo_uri,
            serverSelectionTimeoutMS=5000,
        )

        # Test MongoDB connection
        self.client.admin.command("ping")

        self.db = self.client[
            settings.mongo_db_name
        ]

        self.ensure_indexes()

    def disconnect(self) -> None:
        if self.client is not None:
            self.client.close()

        self.client = None
        self.db = None

    def get_db(self) -> Database:
        if self.db is None:
            raise RuntimeError(
                "MongoDB is not connected"
            )

        return self.db

    def ensure_indexes(self) -> None:
        db = self.get_db()

        # =====================================================
        # USERS
        # =====================================================

        db[USERS].create_index(
            [("email", ASCENDING)],
            unique=True,
        )
        db[USERS].create_index('campusUserId', unique=True, sparse=True)

        db[USERS].create_index(
            [("vtuNumber", ASCENDING)],
            unique=True,
            sparse=True,
        )

        # =====================================================
        # SUBJECTS
        # =====================================================

        # Portal courses belong to a student. The same course code can have
        # different names, staff, or status for different students. Preserve
        # ownerless catalog rows while replacing the old global constraint.
        db[SUBJECTS].create_index(
            [("studentId", ASCENDING), ("code", ASCENDING)],
            name="student_course_code_unique",
            unique=True,
            partialFilterExpression={"code": {"$type": "string", "$gt": ""}},
        )
        for name, specification in db[SUBJECTS].index_information().items():
            if specification.get("unique") and specification.get("key") == [("code", ASCENDING)]:
                db[SUBJECTS].drop_index(name)

        # =====================================================
        # ATTENDANCE
        # =====================================================

        db[ATTENDANCE_RECORDS].create_index(
            [
                ("studentId", ASCENDING),
                ("subjectId", ASCENDING),
                ("date", ASCENDING),
            ],
            unique=True,
        )

        # =====================================================
        # ATTENDANCE CHANGES
        # =====================================================

        db[ATTENDANCE_CHANGES].create_index(
            [
                ("studentId", ASCENDING),
                ("subjectId", ASCENDING),
                ("date", ASCENDING),
            ],
        )

        # =====================================================
        # NOTIFICATIONS
        # =====================================================

        db[NOTIFICATIONS].create_index(
            [
                ("studentId", ASCENDING),
                ("read", ASCENDING),
                ("createdAt", ASCENDING),
            ],
        )

        # =====================================================
        # SMS LOGS
        # =====================================================

        db[SMS_LOGS].create_index(
            [
                ("studentId", ASCENDING),
                ("createdAt", ASCENDING),
            ],
        )

        # =====================================================
        # SYNC LOGS
        # =====================================================

        db[SYNC_LOGS].create_index(
            [
                ("startedAt", ASCENDING),
            ],
        )

        # =====================================================
        # TIMETABLE
        # =====================================================

        db[TIMETABLE].create_index(
            [
                ("studentId", ASCENDING),
                ("day", ASCENDING),
                ("startTime", ASCENDING),
            ],
        )


mongo = Mongo()


def get_db() -> Database:
    return mongo.get_db()
