from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from bson import ObjectId
from pymongo.database import Database

from app.models.user import USERS
from app.models.subject import SUBJECTS
from app.schemas.attendance import IncomingAttendanceRecord
from app.security.portal_credentials import decrypt_portal_password
from app.services.ams.ams_adapter import AmsAdapter
from app.services.base import serialize_document
from app.services.parent_portal.veltech_adapter import VeltechAdapter


class StudentService:
    """
    Student synchronization service.

    LOGIN IDENTIFIERS
    -----------------

    AMS:
        Username = VTU number
        Password = AMS password

        Example:
            VTU00000 + AMS password

    Parent Portal:
        Username = VTU number
        Password = NOT REQUIRED

        Example:
            VTU00000

    College roll / registration number:
        23UECS1039

    IMPORTANT:
        VTU00000 and 23UECS1039 are different values.

        portalUsername = VTU00000
        vtuNumber      = VTU00000
        rollNumber      = 23UECS1039
    """

    def __init__(self, db: Database):
        self.db = db
        self.ams_adapter = AmsAdapter()
        self.parent_adapter = VeltechAdapter()

    # =========================================================
    # TIME
    # =========================================================

    @staticmethod
    def _now() -> datetime:
        return datetime.now(timezone.utc)

    # =========================================================
    # ACTIVE STUDENTS
    # =========================================================

    def active_students(self) -> list[dict]:
        students = (
            self.db[USERS]
            .find(
                {
                    "role": "student",
                    "active": True,
                }
            )
            .sort("name", 1)
        )

        return [
            serialize_document(student)
            for student in students
        ]

    # =========================================================
    # GET STUDENT
    # =========================================================

    def _get_student(
        self,
        student_id: str,
    ) -> dict:

        try:
            object_id = ObjectId(
                str(student_id)
            )
        except Exception as exc:
            raise ValueError(
                "Invalid student ID."
            ) from exc

        student = self.db[USERS].find_one(
            {
                "_id": object_id,
                "role": "student",
                "active": True,
            }
        )

        if not student:
            raise ValueError(
                "Student not found or inactive."
            )

        return serialize_document(student)

    # =========================================================
    # GET RAW STUDENT
    # =========================================================

    def _get_raw_student(
        self,
        student_id: str,
    ) -> dict:

        try:
            object_id = ObjectId(
                str(student_id)
            )
        except Exception as exc:
            raise ValueError(
                "Invalid student ID."
            ) from exc

        student = self.db[USERS].find_one(
            {
                "_id": object_id,
                "role": "student",
                "active": True,
            }
        )

        if not student:
            raise ValueError(
                "Student not found or inactive."
            )

        return student

    # =========================================================
    # STUDENT ID
    # =========================================================

    @staticmethod
    def _student_id(
        student: dict,
    ) -> str | None:

        value = (
            student.get("id")
            or student.get("_id")
        )

        if value is None:
            return None

        return str(value)

    # =========================================================
    # VTU LOGIN NUMBER
    # =========================================================
    # THIS IS THE VALUE USED BY:
    #
    # AMS LOGIN
    # Parent Portal LOGIN
    #
    # Example:
    # VTU00000
    # =========================================================

    @staticmethod
    def _portal_username(
        student: dict,
    ) -> str:
        """
        VTU login number used by both AMS and Parent Portal.
        Example: VTU00000.
        """
        value = str(
            student.get("portalUsername")
            or student.get("portal_username")
            or ""
        ).strip()

        # Repair older records where VTU login was stored in vtuNumber.
        if not value:
            candidate = str(
                student.get("vtuNumber")
                or ""
            ).strip()

            if re_match_vtu(candidate):
                value = candidate

        return value

    # =========================================================
    # COLLEGE ROLL / REGISTRATION NUMBER
    # =========================================================
    #
    # Example:
    # 23UECS1039
    #
    # NEVER use this for Parent Portal login.
    # =========================================================

    @staticmethod
    def _vtu_number(
        student: dict,
    ) -> str:
        """
        College roll/registration number.
        Example: 23UECS1039.

        VTU00000 must never be treated as this value.
        """
        for value in (
            student.get("rollNumber"),
            student.get("registrationNumber"),
            student.get("vtuNumber"),
        ):
            value = str(value or "").strip()

            if value and not re_match_vtu(value):
                return value

        return ""

    # =========================================================
    # FIND CREDENTIALS
    # =========================================================

    def _find_student_credentials(
        self,
        student_id: str,
    ) -> dict | None:

        if not student_id:
            return None

        queries = []

        try:
            queries.append(
                {
                    "_id": ObjectId(
                        str(student_id)
                    ),
                    "role": "student",
                }
            )
        except Exception:
            pass

        queries.append(
            {
                "id": str(student_id),
                "role": "student",
            }
        )

        for query in queries:

            stored = self.db[USERS].find_one(
                query,
                {
                    "portalUsername": 1,
                    "portalPasswordEncrypted": 1,
                    "portalCredentialsConfigured": 1,
                    "vtuNumber": 1,
                    "rollNumber": 1,
                    "registrationNumber": 1,
                    "active": 1,
                },
            )

            if stored:
                return stored

        return None

    # =========================================================
    # AMS CREDENTIALS
    # =========================================================

    def _get_ams_credentials(
        self,
        student: dict,
    ) -> tuple[str, str] | None:

        username = self._portal_username(
            student
        )

        encrypted_password = student.get(
            "portalPasswordEncrypted"
        )

        if (
            not username
            or not encrypted_password
        ):

            student_id = self._student_id(
                student
            )

            if student_id:

                stored = (
                    self._find_student_credentials(
                        student_id
                    )
                )

                if stored:

                    username = str(
                        stored.get(
                            "portalUsername",
                            username,
                        )
                        or username
                    ).strip()

                    encrypted_password = (
                        stored.get(
                            "portalPasswordEncrypted"
                        )
                    )

        if (
            not username
            or not encrypted_password
        ):
            return None

        if not self._looks_like_portal_username(
            username
        ):
            return None

        try:
            password = decrypt_portal_password(
                encrypted_password
            )
        except Exception as exc:
            raise ValueError(
                "Unable to decrypt the AMS password."
            ) from exc

        if not password:
            return None

        return (
            username,
            password,
        )

    # =========================================================
    # PORTAL CREDENTIAL STATUS
    # =========================================================

    def has_portal_credentials(
        self,
        student: dict,
    ) -> bool:

        try:
            return (
                self._get_ams_credentials(
                    student
                )
                is not None
            )
        except Exception:
            return False

    # =========================================================
    # VERIFY CREDENTIALS
    # =========================================================

    def verify_portal_credentials(
        self,
        student: dict,
    ) -> dict:

        username = self._portal_username(
            student
        )

        encrypted_password = student.get(
            "portalPasswordEncrypted"
        )

        if (
            not username
            or not encrypted_password
        ):

            student_id = self._student_id(
                student
            )

            if student_id:

                stored = (
                    self._find_student_credentials(
                        student_id
                    )
                )

                if stored:

                    username = str(
                        stored.get(
                            "portalUsername",
                            username,
                        )
                        or username
                    ).strip()

                    encrypted_password = (
                        stored.get(
                            "portalPasswordEncrypted"
                        )
                    )

        valid_username = (
            self._looks_like_portal_username(
                username
            )
        )

        return {
            "configured": bool(
                valid_username
                and encrypted_password
            ),
            "portalUsername": (
                username
                if username
                else None
            ),
            "encryptedPasswordPresent": bool(
                encrypted_password
            ),
            "configuredFlag": bool(
                student.get(
                    "portalCredentialsConfigured",
                    False,
                )
            ),
            "parentPortalPasswordRequired": False,
        }

    # =========================================================
    # AMS LOGIN
    # =========================================================

    async def _login_ams(
        self,
        student: dict,
    ) -> Any:

        credentials = (
            self._get_ams_credentials(
                student
            )
        )

        if credentials is None:
            raise ValueError(
                "AMS username and password "
                "have not been configured."
            )

        username, password = credentials


        return await self.ams_adapter.login(
            username=username,
            password=password,
        )

    # =========================================================
    # PARENT PORTAL LOGIN
    # =========================================================
    #
    # CRITICAL:
    #
    # Parent Portal login:
    #
    #     username = VTU00000
    #     password = ""
    #
    # NOT:
    #
    #     username = 23UECS1039
    #
    # =========================================================

    async def _login_parent_portal(
        self,
        student: dict,
    ) -> Any:

        parent_vtu = (
            self._portal_username(
                student
            )
        )

        if not parent_vtu:
            raise ValueError(
                "Parent Portal VTU number is missing."
            )

        parent_vtu = parent_vtu.upper()

        if not self._looks_like_portal_username(
            parent_vtu
        ):
            raise ValueError(
                "Invalid Parent Portal VTU number: "
                f"{parent_vtu}. "
                "Expected format such as VTU00000."
            )

        college_roll = (
            self._vtu_number(
                student
            )
        )


        return await self.parent_adapter.login(
            username=parent_vtu,
            password="",
            vtu_number=parent_vtu,
        )

    # =========================================================
    # FIRST VALUE
    # =========================================================

    @staticmethod
    def _first_value(
        data: dict,
        *keys: str,
    ):

        for key in keys:

            value = data.get(
                key
            )

            if value is None:
                continue

            if isinstance(
                value,
                str,
            ):

                value = value.strip()

                if value:
                    return value

            else:
                return value

        return None

    # =========================================================
    # VTU USERNAME CHECK
    # =========================================================

    @staticmethod
    def _looks_like_portal_username(
        value: Any,
    ) -> bool:

        if value is None:
            return False

        value = (
            str(value)
            .strip()
            .upper()
        )

        return bool(
            re_match_vtu(value)
        )

    # =========================================================
    # NORMALIZE AMS PROFILE
    # =========================================================

    def _normalize_ams_profile(
        self,
        profile: dict | None,
    ) -> dict:

        if not isinstance(
            profile,
            dict,
        ):
            return {}

        source = dict(
            profile
        )

        for wrapper in (
            "student",
            "profile",
            "data",
            "studentDetails",
            "studentProfile",
            "details",
        ):

            wrapped = profile.get(
                wrapper
            )

            if isinstance(
                wrapped,
                dict,
            ):

                source = {
                    **source,
                    **wrapped,
                }

        normalized: dict[str, Any] = {}

        mappings = {
            "name": (
                "name",
                "studentName",
                "fullName",
                "student_name",
            ),
            "gender": (
                "gender",
                "Gender",
                "sex",
            ),
            "dateOfBirth": (
                "dateOfBirth",
                "dob",
                "date_of_birth",
                "birthDate",
                "dateOfBirthText",
            ),
            "degree": (
                "degree",
                "course",
                "program",
                "programme",
                "courseName",
            ),
            "branch": (
                "branch",
                "branchName",
                "department",
                "departmentName",
                "specialization",
            ),
            "department": ("department", "departmentName"),
            "regulation": ("regulation", "regulationName"),
            "academicYear": ("academicYear", "academicSession"),
            "year": (
                "year",
                "studyYear",
                "currentYear",
                "yearOfStudy",
            ),
            "semester": (
                "semester",
                "sem",
                "currentSemester",
            ),
            "section": (
                "section",
                "sectionName",
            ),
            "batch": (
                "batch",
                "batchName",
                "batchYear",
            ),
            "fatherName": (
                "fatherName",
                "father",
                "father_name",
                "fathersName",
                "fathername",
            ),
            "motherName": (
                "motherName",
                "mother",
                "mother_name",
                "mothersName",
                "mothername",
            ),
            "phoneNumber": (
                "phoneNumber",
                "phone",
                "mobileNumber",
                "mobile",
                "mobileNo",
                "contactNumber",
                "contactNo",
            ),
            "amsEmail": (
                "amsEmail",
                "email",
                "emailAddress",
                "mail",
            ),
            "aadhaarNumber": (
                "aadhaarNumber",
                "aadhaarNo",
                "aadharNumber",
                "aadharNo",
                "aadhaar",
                "aadhar",
            ),
            "academicBankCreditsId": (
                "academicBankCreditsId",
                "academicBankCreditId",
                "abcId",
                "abcID",
                "academicBankAccountId",
                "academicBankCreditsID",
            ),
            "community": (
                "community",
                "communityName",
                "caste",
            ),
            "religion": (
                "religion",
                "religionName",
            ),
            "nationality": (
                "nationality",
                "nationalityName",
            ),
            "photoUrl": (
                "photoUrl",
                "photoURL",
                "photo",
                "profilePhoto",
                "profilePhotoUrl",
                "imageUrl",
            ),
            "registrationStatus": (
                "registrationStatus",
                "status",
                "registration_status",
            ),
            "mentorName": ("mentorName", "mentor", "facultyAdvisor", "advisorName"),
        }

        for target, keys in mappings.items():

            value = self._first_value(
                source,
                *keys,
            )

            if value is not None:
                normalized[target] = str(
                    value
                ).strip()

        # Keep the verified AMS username and college roll as distinct fields.
        vtu = self._first_value(source, 'vtuNumber', 'vtuNo', 'portalUsername')
        roll = self._first_value(source, 'rollNumber', 'rollNo', 'registrationNumber', 'registrationNo')
        if vtu and self._looks_like_portal_username(str(vtu)):
            normalized['vtuNumber'] = str(vtu).strip()
        elif vtu and not roll:
            roll = vtu  # Legacy source records used vtuNumber for the college roll.
        if roll and not self._looks_like_portal_username(str(roll)):
            normalized['rollNumber'] = str(roll).strip()

        if isinstance(source.get('photoDataUri'),str) and source['photoDataUri'].startswith(('data:image/jpeg;base64,','data:image/png;base64,','data:image/gif;base64,','data:image/webp;base64,')) and len(source['photoDataUri'])<2_700_000:
            normalized['photoDataUri']=source['photoDataUri']

        phone = normalized.get(
            "phoneNumber"
        )

        if phone:
            normalized[
                "mobileNumber"
            ] = phone

        return normalized

    # =========================================================
    # SAVE AMS PROFILE
    # =========================================================

    def _save_ams_profile(
        self,
        student_id: str,
        profile: dict | None,
    ) -> dict:

        normalized = (
            self._normalize_ams_profile(
                profile
            )
        )

        try:
            object_id = ObjectId(
                str(student_id)
            )
        except Exception as exc:
            raise ValueError(
                "Invalid student ID."
            ) from exc

        existing = self.db[USERS].find_one(
            {
                "_id": object_id,
                "role": "student",
                "active": True,
            }
        )

        if not existing:
            raise ValueError(
                "Student not found while "
                "saving AMS profile."
            )

        protected = {
            "_id",
            "id",
            "email",
            "passwordHash",
            "role",
            "portalUsername",
            "portalPasswordEncrypted",
            "portalCredentialsConfigured",
            "active",
            "forcePasswordChange",
            "smsEnabled",
            "notificationsEnabled",
            "absentAlertsEnabled",
            "createdAt",
        }

        normalized = {
            key: value
            for key, value in normalized.items()
            if key not in protected
        }

        # Audience restrictions may only originate in an authenticated AMS read.
        # Legacy display fields can include student imports and must never seed
        # this protected record, even after that account later verifies its AMS.
        official_fields = {'branch', 'department', 'semester', 'section', 'batch', 'regulation'}
        previous_official = existing.get('amsOfficialProfile')
        previous_official = previous_official if isinstance(previous_official, dict) else {}
        normalized['amsOfficialProfile'] = {
            **{key: value for key, value in previous_official.items()
               if key in official_fields and isinstance(value, str) and value.strip()},
            **{key: value for key, value in normalized.items()
               if key in official_fields and isinstance(value, str) and value.strip()},
        }

        now = self._now()

        normalized[
            "profileSynced"
        ] = True

        normalized[
            "lastSyncedAt"
        ] = now

        normalized[
            "profileLastSyncedAt"
        ] = now

        normalized[
            "updatedAt"
        ] = now

        self.db[USERS].update_one(
            {
                "_id": object_id,
                "role": "student",
                "active": True,
            },
            {
                "$set": normalized,
            },
        )

        updated = self.db[USERS].find_one(
            {
                "_id": object_id
            }
        )

        if not updated:
            raise ValueError(
                "Student could not be reloaded "
                "after AMS synchronization."
            )

        return serialize_document(
            updated
        )

    # =========================================================
    # CURRENT AMS PROFILE
    # =========================================================

    async def get_current_profile(
        self,
        student: dict,
    ) -> dict:

        session = None

        try:

            session = await self._login_ams(
                student
            )

            profile = (
                await self.ams_adapter
                .get_student_profile(
                    session
                )
            )

            return profile or {}

        finally:

            if session:

                try:
                    await self.ams_adapter.logout(
                        session
                    )
                except Exception:
                    pass

    # =========================================================
    # SYNC AMS PROFILE
    # =========================================================

    async def sync_student_profile(
        self,
        student_id: str,
    ) -> dict:

        student = self._get_student(
            student_id
        )

        credentials = (
            self._get_ams_credentials(
                student
            )
        )

        if credentials is None:
            raise ValueError(
                "AMS username and password "
                "have not been configured."
            )

        profile = (
            await self.get_current_profile(
                student
            )
        )

        if not profile:
            raise ValueError(
                "AMS login succeeded, but "
                "no student profile data was returned."
            )

        updated_student = (
            self._save_ams_profile(
                student_id,
                profile,
            )
        )

        # Keep Parent Portal login identity separate from the
        # college roll/registration number after AMS synchronization.
        portal_username = (
            self._portal_username(updated_student)
            or self._portal_username(student)
        )

        if portal_username:
            self.db[USERS].update_one(
                {"_id": ObjectId(str(student_id))},
                {
                    "$set": {
                        "portalUsername": portal_username,
                    }
                },
            )
            updated_student["portalUsername"] = portal_username

        return {
            "success": True,
            "message": (
                "Student profile fetched "
                "from AMS successfully."
            ),
            "vtuNumber": updated_student.get(
                "vtuNumber"
            ),
            "rollNumber": updated_student.get(
                "rollNumber"
            ),
            "parentPortalUsername": (
                updated_student.get(
                    "portalUsername"
                )
            ),
            "profile": profile,
            "student": updated_student,
        }

    # =========================================================
    # LIVE PARENT PORTAL DATA
    # =========================================================

    async def get_current_portal_data(
        self,
        student: dict,
        fetch_ams_profile: bool = False,
    ) -> dict[str, Any]:

        result: dict[str, Any] = {
            "success": False,
            "profile": {},
            "attendance": [],
            "subjects": [],
            "timetable": [],
            "student": student,
            "attendanceError": None,
            "profileError": None,
        }

        # =====================================================
        # OPTIONAL AMS PROFILE SYNC
        # =====================================================

        if fetch_ams_profile:

            try:

                student_id = (
                    self._student_id(
                        student
                    )
                )

                if not student_id:
                    raise ValueError(
                        "Student ID is missing."
                    )

                profile_result = (
                    await self.sync_student_profile(
                        student_id
                    )
                )

                result["profile"] = (
                    profile_result.get(
                        "profile",
                        {},
                    )
                )

                result["student"] = (
                    profile_result.get(
                        "student",
                        student,
                    )
                )

            except Exception as exc:

                result["profileError"] = str(
                    exc
                )

        else:

            result["profile"] = {
                key: student.get(key)
                for key in (
                    "name",
                    "gender",
                    "fatherName",
                    "motherName",
                    "dateOfBirth",
                    "degree",
                    "branch",
                    "year",
                    "semester",
                    "section",
                    "batch",
                    "phoneNumber",
                    "mobileNumber",
                    "amsEmail",
                    "vtuNumber",
                    "rollNumber",
                    "academicBankCreditsId",
                    "aadhaarNumber",
                    "community",
                    "religion",
                    "nationality",
                    "photoUrl",
                    "registrationStatus",
                )
                if student.get(key) is not None
            }

        # =====================================================
        # RELOAD STUDENT
        # =====================================================

        portal_student = (
            result.get("student")
            or student
        )

        student_id = self._student_id(
            portal_student
        )

        if student_id:

            try:

                portal_student = (
                    self._get_student(
                        student_id
                    )
                )

                result["student"] = (
                    portal_student
                )

            except Exception:
                pass

        # =====================================================
        # PARENT PORTAL LOGIN ID
        # =====================================================

        parent_vtu = (
            self._portal_username(
                portal_student
            )
        )

        if not self._looks_like_portal_username(
            parent_vtu
        ):

            result["attendanceError"] = (
                "Parent Portal VTU number is "
                "missing or invalid. "
                "Expected format such as VTU00000."
            )

            return result

        # =====================================================
        # LIVE PARENT PORTAL
        # =====================================================

        session = None

        try:

            session = (
                await self._login_parent_portal(
                    portal_student
                )
            )


            portal_data = (
                await self.parent_adapter
                .get_live_portal_data(
                    session
                )
            )

            if not isinstance(
                portal_data,
                dict,
            ):
                raise ValueError(
                    "Parent Portal adapter "
                    "returned an invalid response."
                )

            result["profile"] = (
                portal_data.get(
                    "profile",
                    result["profile"],
                )
            )

            result["subjects"] = (
                portal_data.get(
                    "subjects",
                    [],
                )
                or []
            )

            result["attendance"] = (
                portal_data.get(
                    "attendance",
                    [],
                )
                or []
            )

            result["timetable"] = (
                portal_data.get(
                    "timetable",
                    [],
                )
                or []
            )

            result["attendanceError"] = (
                portal_data.get(
                    "attendanceError"
                )
            )

            # Login success alone is not attendance success.
            # The Parent Portal must return actual current rows.
            result["success"] = bool(
                result["subjects"]
                or result["attendance"]
            )


            if not result["subjects"]:
                result["attendanceError"] = (
                    result["attendanceError"]
                    or
                    "Parent Portal login succeeded, but "
                    "no current subject rows were returned."
                )


            if not result["attendance"]:
                result["attendanceError"] = (
                    result["attendanceError"]
                    or
                    "Parent Portal returned "
                    "zero attendance records."
                )

        except Exception as exc:

            result["success"] = False
            result["attendance"] = []
            result["subjects"] = []

            result["attendanceError"] = (
                "Parent Portal synchronization "
                f"failed: {exc}"
            )


        finally:

            if session:

                try:
                    await self.parent_adapter.logout(
                        session
                    )
                except Exception as exc:

                    pass

        return result

    # =========================================================
    # GET PORTAL DATA BY STUDENT ID
    # =========================================================

    async def get_portal_data_by_student_id(
        self,
        student_id: str,
        fetch_ams_profile: bool = False,
    ) -> dict[str, Any]:

        student = self._get_student(
            student_id
        )

        return (
            await self.get_current_portal_data(
                student,
                fetch_ams_profile=(
                    fetch_ams_profile
                ),
            )
        )

    # =========================================================
    # CURRENT PARENT ATTENDANCE
    # =========================================================

    async def get_current_attendance(
        self,
        student: dict,
    ) -> tuple[
        list[IncomingAttendanceRecord],
        list[dict],
    ]:

        portal_data = (
            await self.get_current_portal_data(
                student,
                fetch_ams_profile=False,
            )
        )

        raw_attendance = (
            portal_data.get(
                "attendance",
                [],
            )
            or []
        )

        subjects = (
            portal_data.get(
                "subjects",
                [],
            )
            or []
        )

        valid_records: list[
            IncomingAttendanceRecord
        ] = []

        for record in raw_attendance:

            if isinstance(
                record,
                IncomingAttendanceRecord,
            ):

                valid_records.append(
                    record
                )

            elif isinstance(
                record,
                dict,
            ):

                try:

                    valid_records.append(
                        IncomingAttendanceRecord(
                            **record
                        )
                    )

                except Exception as exc:

                    pass

        return (
            valid_records,
            subjects,
        )

    # =========================================================
    # STUDENT ASSOCIATED SUBJECTS
    # =========================================================

    def get_student_associated_subjects(
        self,
        student_id: str,
    ) -> list[dict]:

        student_id = str(
            student_id
        ).strip()

        if not student_id:
            return []

        subjects = (
            self.db[SUBJECTS]
            .find(
                {
                    "studentId": student_id,
                    "active": True,
                }
            )
            .sort(
                [
                    ("name", 1),
                    ("code", 1),
                ]
            )
        )

        return [
            serialize_document(subject)
            for subject in subjects
        ]


# =========================================================
# VTU FORMAT VALIDATOR
# =========================================================

def re_match_vtu(
    value: str,
) -> bool:

    return (
        value.startswith("VTU")
        and value[3:].isdigit()
    )
