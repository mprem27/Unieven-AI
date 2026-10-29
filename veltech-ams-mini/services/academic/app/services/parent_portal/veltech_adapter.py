from __future__ import annotations

import base64
import re
import time
from typing import Any
from urllib.parse import urljoin

import httpx
from bs4 import BeautifulSoup

from app.college.base_adapter import CollegeDataAdapter
from app.college.normalizer import (
    normalize_subject_code,
    normalize_subject_name,
)
from app.college.parser import (
    parse_attendance_table,
    parse_parent_portal_profile,
    parse_parent_portal_subjects,
    parse_parent_portal_timetable,
)
from app.config.settings import settings
from app.schemas.attendance import IncomingAttendanceRecord


class VeltechAdapter(CollegeDataAdapter):
    """
    Vel Tech Parent Portal adapter.

    IDENTIFIERS
    -----------
    Parent Portal login:
        VTU00000

    Parent Portal password:
        NOT REQUIRED

    College roll / registration number:
        23UECS1039

    IMPORTANT:
        VTU00000 MUST be used as Stu_id.
        23UECS1039 MUST NEVER be used as Stu_id.
    """

    LOGIN_PATH = "miniapps/parent_login.php"
    DASHBOARD_PATH = "miniapps/parent_dashboard.php"

    def __init__(self) -> None:
        self.base_url = (
            settings.college_base_url.rstrip("/")
        )

        self.login_url = urljoin(
            self.base_url + "/",
            self.LOGIN_PATH,
        )

        self.dashboard_url = urljoin(
            self.base_url + "/",
            self.DASHBOARD_PATH,
        )

        timeout = getattr(
            settings,
            "sync_request_timeout_seconds",
            60,
        )

        try:
            timeout = float(timeout)
        except (TypeError, ValueError):
            timeout = 60.0

        self.timeout = max(timeout, 30.0)

        self.headers = {
            "User-Agent": (
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                "AppleWebKit/537.36 "
                "(KHTML, like Gecko) "
                "Chrome/151.0.0.0 Safari/537.36"
            ),
            "Accept": (
                "text/html,application/xhtml+xml,"
                "application/xml;q=0.9,image/avif,"
                "image/webp,image/apng,*/*;q=0.8"
            ),
            "Accept-Language": (
                "en-IN,en-GB;q=0.9,en-US;q=0.8,en;q=0.7"
            ),
            "Connection": "keep-alive",
            "Cache-Control": "no-cache",
            "Pragma": "no-cache",
        }

    # =========================================================
    # LOGIN
    # =========================================================

    async def login(
        self,
        username: str,
        password: str = "",
        vtu_number: str | None = None,
    ) -> dict[str, Any]:
        raise RuntimeError('The parent portal is retired. Use the manually verified AMS connection.')
        mode = str(
            getattr(
                settings,
                "college_adapter_mode",
                "portal",
            )
        ).strip().lower()

        if mode != "portal":
            raise RuntimeError(
                "Unsupported COLLEGE_ADAPTER_MODE. "
                "Set COLLEGE_ADAPTER_MODE=portal."
            )

        # -----------------------------------------------------
        # CRITICAL:
        #
        # username = VTU00000
        # vtu_number = 23UECS1039
        #
        # Parent Portal MUST receive:
        #
        # Stu_id = VTU00000
        #
        # Never send 23UECS1039 as Stu_id.
        # -----------------------------------------------------

        parent_vtu = str(
            username or ""
        ).strip().upper()

        roll_number = str(
            vtu_number or ""
        ).strip().upper()

        if not parent_vtu:
            raise ValueError(
                "Parent Portal VTU number is required."
            )

        if not self._is_vtu_username(parent_vtu):
            raise ValueError(
                f"Invalid Parent Portal VTU number: "
                f"{parent_vtu}. Expected format like VTU00000."
            )


        client = httpx.AsyncClient(
            timeout=httpx.Timeout(
                connect=20.0,
                read=self.timeout,
                write=30.0,
                pool=20.0,
            ),
            follow_redirects=True,
            headers=self.headers,
        )

        try:
            # =================================================
            # 1. OPEN LOGIN PAGE
            # =================================================

            login_response = await client.get(
                self.login_url,
                headers={
                    "Referer": self.base_url + "/",
                },
            )
            login_response.raise_for_status()

            login_html = login_response.text


            # =================================================
            # 2. EXTRACT FORM
            # =================================================

            form_data = self._extract_login_form(
                login_html
            )

            # Parent Portal identifier
            form_data["Stu_id"] = parent_vtu

            # No password for Parent Portal
            self._remove_password_fields(
                form_data
            )


            # =================================================
            # 3. LOGIN
            # =================================================

            response = await client.post(
                self.dashboard_url,
                data=form_data,
                headers={
                    "Content-Type": (
                        "application/x-www-form-urlencoded"
                    ),
                    "Accept": self.headers["Accept"],
                    "Referer": self.login_url,
                    "Origin": self.base_url,
                    "Cache-Control": (
                        "no-cache, no-store, max-age=0"
                    ),
                    "Pragma": "no-cache",
                },
            )
            response.raise_for_status()

            post_html = response.text


            # =================================================
            # 4. GET FRESH DASHBOARD
            # =================================================

            dashboard_html = await self._request_dashboard(
                client,
                referer=str(response.url),
            )

            # =================================================
            # 5. SELECT BEST RESPONSE
            # =================================================

            candidates = []

            for source, html in (
                ("POST", post_html),
                ("GET", dashboard_html),
            ):
                if not html:
                    continue

                if self._contains_vtu_error(html):
                    continue

                candidates.append(
                    (
                        source,
                        html,
                        self._portal_data_score(html),
                    )
                )

            if not candidates:
                raise RuntimeError(
                    "Parent Portal did not return a valid "
                    "dashboard for VTU number "
                    f"{parent_vtu}."
                )

            source, selected_html, score = max(
                candidates,
                key=lambda item: item[2],
            )


            if not self._is_dashboard(selected_html):

                raise RuntimeError(
                    "Parent Portal response does not "
                    "contain the expected student dashboard."
                )

            return {
                "client": client,
                "username": parent_vtu,
                "portal_username": parent_vtu,

                # Parent Portal identity
                "student_id": parent_vtu,

                # College roll/registration number
                "vtu_number": roll_number,

                "dashboard_html": selected_html,
                "post_dashboard_html": post_html,
                "live_dashboard_html": dashboard_html,

                "login_url": self.login_url,
                "dashboard_url": self.dashboard_url,
                "success": True,
            }

        except httpx.TimeoutException as exc:
            await self._close_client(client)

            raise RuntimeError(
                "Parent Portal request timed out."
            ) from exc

        except Exception:
            await self._close_client(client)
            raise

    # =========================================================
    # LIVE PORTAL DATA
    # =========================================================

    async def get_live_portal_data(
        self,
        session: dict[str, Any],
    ) -> dict[str, Any]:

        html = await self._get_dashboard_html(
            session,
            force_refresh=True,
        )

        if not html:
            raise RuntimeError(
                "Parent Portal returned empty dashboard."
            )

        # =====================================================
        # PROFILE
        # =====================================================

        try:
            profile = (
                parse_parent_portal_profile(
                    html
                )
                or {}
            )
        except Exception as exc:
            profile = {}

        # =====================================================
        # SUBJECTS
        # =====================================================

        try:
            raw_subjects = (
                parse_parent_portal_subjects(
                    html
                )
                or []
            )
        except Exception as exc:
            raw_subjects = []

        subjects = self._normalize_subjects(
            raw_subjects
        )

        # =====================================================
        # ATTENDANCE
        # =====================================================

        attendance_error = None

        try:
            attendance = self._normalize_attendance(
                html,
                subjects=subjects,
            )
        except Exception as exc:
            attendance = []
            attendance_error = str(exc)


        # =====================================================
        # TIMETABLE
        # =====================================================

        try:
            timetable = (
                parse_parent_portal_timetable(
                    html
                )
                or []
            )
        except Exception as exc:
            timetable = []


        if attendance_error:
            pass


        return {
            "success": True,
            "profile": profile,
            "subjects": subjects,
            "attendance": attendance,
            "timetable": timetable,
            "attendanceError": attendance_error,
            "profileError": None,
            "student": {
                "username": session.get(
                    "username"
                ),
                "vtuNumber": session.get(
                    "student_id"
                ),
                "rollNumber": session.get(
                    "vtu_number"
                ),
            },
        }

    # =========================================================
    # PROFILE
    # =========================================================

    async def get_student_profile(
        self,
        session: dict[str, Any],
    ) -> dict[str, Any]:

        html = await self._get_dashboard_html(
            session,
            force_refresh=True,
        )

        return (
            parse_parent_portal_profile(
                html
            )
            or {}
        )

    # =========================================================
    # SUBJECTS
    # =========================================================

    async def get_subjects(
        self,
        session: dict[str, Any],
    ) -> list[dict[str, Any]]:

        data = await self.get_live_portal_data(
            session
        )

        return data.get(
            "subjects",
            [],
        )

    # =========================================================
    # ATTENDANCE
    # =========================================================

    async def get_attendance(
        self,
        session: dict[str, Any],
    ) -> list[IncomingAttendanceRecord]:

        data = await self.get_live_portal_data(
            session
        )

        return data.get(
            "attendance",
            [],
        )

    # =========================================================
    # TIMETABLE
    # =========================================================

    async def get_timetable(
        self,
        session: dict[str, Any],
    ) -> list[dict[str, Any]]:

        html = await self._get_dashboard_html(
            session,
            force_refresh=True,
        )

        return (
            parse_parent_portal_timetable(
                html
            )
            or []
        )

    # =========================================================
    # DASHBOARD REQUEST
    # =========================================================

    async def _request_dashboard(
        self,
        client: httpx.AsyncClient,
        referer: str,
    ) -> str:

        response = await client.get(
            self.dashboard_url,
            params={
                "_": str(
                    int(
                        time.time() * 1000
                    )
                ),
            },
            headers={
                "Accept": self.headers["Accept"],
                "Referer": referer,
                "Cache-Control": (
                    "no-cache, no-store, max-age=0"
                ),
                "Pragma": "no-cache",
            },
        )

        response.raise_for_status()

        return response.text

    # =========================================================
    # GET DASHBOARD
    # =========================================================

    async def _get_dashboard_html(
        self,
        session: dict[str, Any],
        *,
        force_refresh: bool = False,
    ) -> str:

        if not force_refresh:
            cached = session.get(
                "dashboard_html"
            )

            if cached:
                return cached

        client = session.get(
            "client"
        )

        if not client:
            raise ValueError(
                "Parent Portal HTTP session is missing."
            )

        # -----------------------------------------------------
        # ALWAYS USE VTU NUMBER HERE
        # -----------------------------------------------------

        parent_vtu = str(
            session.get(
                "student_id"
            )
            or session.get(
                "username"
            )
            or ""
        ).strip().upper()

        if not self._is_vtu_username(
            parent_vtu
        ):
            raise ValueError(
                "Parent Portal VTU number is missing."
            )

        html = await self._request_dashboard(
            client,
            self.login_url,
        )

        # =====================================================
        # SESSION EXPIRED
        # =====================================================

        if (
            self._looks_like_login_page(html)
            or self._contains_vtu_error(html)
        ):


            login_response = await client.get(
                self.login_url,
                headers={
                    "Referer": self.base_url + "/",
                },
            )

            login_response.raise_for_status()

            form_data = (
                self._extract_login_form(
                    login_response.text
                )
            )

            # CRITICAL:
            # Parent login = VTU number
            form_data["Stu_id"] = parent_vtu

            self._remove_password_fields(
                form_data
            )

            response = await client.post(
                self.dashboard_url,
                data=form_data,
                headers={
                    "Content-Type": (
                        "application/x-www-form-urlencoded"
                    ),
                    "Accept": self.headers["Accept"],
                    "Referer": self.login_url,
                    "Origin": self.base_url,
                    "Cache-Control": (
                        "no-cache, no-store, max-age=0"
                    ),
                    "Pragma": "no-cache",
                },
            )

            response.raise_for_status()

            html = response.text

            # One more fresh dashboard request
            if not self._is_dashboard(html):
                html = await self._request_dashboard(
                    client,
                    str(response.url),
                )

        # =====================================================
        # VALIDATE DASHBOARD
        # =====================================================

        if self._contains_vtu_error(html):
            raise RuntimeError(
                "Parent Portal rejected VTU number "
                f"{parent_vtu}."
            )

        if self._looks_like_login_page(html):
            raise RuntimeError(
                "Parent Portal login/session failed."
            )

        if not self._is_dashboard(html):

            raise RuntimeError(
                "Parent Portal did not return "
                "the student dashboard."
            )

        session["dashboard_html"] = html
        session["live_dashboard_html"] = html

        return html

    # =========================================================
    # LOGIN FORM
    # =========================================================

    @staticmethod
    def _extract_login_form(
        html: str,
    ) -> dict[str, str]:

        soup = BeautifulSoup(
            html,
            "html.parser",
        )

        form = soup.find("form")

        if not form:
            return {
                "Stu_id": "",
            }

        data: dict[str, str] = {}

        # Hidden/text inputs
        for field in form.find_all("input"):

            name = field.get("name")

            if not name:
                continue

            input_type = str(
                field.get(
                    "type",
                    "text",
                )
            ).lower()

            if input_type in {
                "submit",
                "button",
                "image",
                "reset",
            }:
                continue

            data[str(name)] = str(
                field.get(
                    "value",
                    "",
                )
            )

        # Select values
        for select in form.find_all(
            "select"
        ):

            name = select.get("name")

            if not name:
                continue

            option = select.find(
                "option",
                selected=True,
            )

            if option is None:
                option = select.find(
                    "option"
                )

            if option is not None:
                data[str(name)] = str(
                    option.get(
                        "value",
                        "",
                    )
                )

        data["Stu_id"] = ""

        return data

    # =========================================================
    # REMOVE PASSWORD FIELDS
    # =========================================================

    @staticmethod
    def _remove_password_fields(
        data: dict[str, str],
    ) -> None:

        for key in list(data.keys()):

            if key.lower() in {
                "password",
                "passwd",
                "pass",
                "pwd",
            }:
                data.pop(
                    key,
                    None,
                )

    # =========================================================
    # ATTENDANCE
    # =========================================================

    def _normalize_attendance(
        self,
        html: str,
        subjects: list[dict[str, Any]] | None = None,
    ) -> list[IncomingAttendanceRecord]:

        if subjects is None:

            try:
                raw_subjects = (
                    parse_parent_portal_subjects(
                        html
                    )
                    or []
                )
            except Exception:
                raw_subjects = []

            subjects = self._normalize_subjects(
                raw_subjects
            )

        by_code = {
            str(
                item.get(
                    "code",
                    "",
                )
            ).strip().casefold(): item
            for item in subjects
            if item.get("code")
        }

        by_name = {
            self._subject_key(
                item.get(
                    "name",
                    "",
                )
            ): item
            for item in subjects
            if item.get("name")
        }

        try:
            raw_records = (
                parse_attendance_table(
                    html
                )
                or []
            )
        except Exception as exc:
            raw_records = []


        result = []

        for raw in raw_records:

            try:

                if isinstance(
                    raw,
                    IncomingAttendanceRecord,
                ):
                    record = raw

                elif isinstance(
                    raw,
                    dict,
                ):
                    record = (
                        IncomingAttendanceRecord(
                            **raw
                        )
                    )

                else:
                    continue

                name = normalize_subject_name(
                    str(
                        getattr(
                            record,
                            "subjectName",
                            "",
                        )
                        or ""
                    )
                )

                code = normalize_subject_code(
                    str(
                        getattr(
                            record,
                            "subjectCode",
                            "",
                        )
                        or ""
                    )
                ) or ""

                subject = None

                if code:
                    subject = by_code.get(
                        code.casefold()
                    )

                if (
                    subject is None
                    and name
                ):
                    subject = by_name.get(
                        self._subject_key(
                            name
                        )
                    )

                if subject:

                    name = subject.get(
                        "name",
                        name,
                    )

                    code = subject.get(
                        "code",
                        code,
                    )

                status_value = str(
                    getattr(
                        record,
                        "status",
                        "",
                    )
                    or ""
                ).strip().upper()

                if status_value in {
                    "P",
                    "PRESENT",
                    "YES",
                    "Y",
                    "1",
                }:
                    status_value = "PRESENT"

                elif status_value in {
                    "A",
                    "ABSENT",
                    "NO",
                    "N",
                    "0",
                }:
                    status_value = "ABSENT"

                else:
                    continue

                date_value = str(
                    getattr(
                        record,
                        "date",
                        "",
                    )
                    or ""
                ).strip()

                if not name or not date_value:
                    continue

                result.append(
                    IncomingAttendanceRecord(
                        subjectName=name,
                        subjectCode=code,
                        date=date_value,
                        status=status_value,
                        source="parent_portal",
                    )
                )

            except Exception as exc:
                pass

        return self._deduplicate_attendance(
            result
        )

    # =========================================================
    # SUBJECTS
    # =========================================================

    @staticmethod
    def _normalize_subjects(
        subjects: list[dict[str, Any]] | None,
    ) -> list[dict[str, Any]]:

        if not subjects:
            return []

        result = []
        seen = set()

        for raw in subjects:

            if not isinstance(
                raw,
                dict,
            ):
                continue

            name = normalize_subject_name(
                str(
                    raw.get(
                        "name",
                        "",
                    )
                    or ""
                )
            )

            code = normalize_subject_code(
                str(
                    raw.get(
                        "code",
                        "",
                    )
                    or ""
                )
            )

            if not name:
                continue

            key = (
                code.casefold()
                if code
                else VeltechAdapter._subject_key(
                    name
                )
            )

            if key in seen:
                continue

            seen.add(key)

            result.append(
                {
                    "code": code,
                    "name": name,
                }
            )

        return result

    # =========================================================
    # DEDUPLICATE ATTENDANCE
    # =========================================================

    @staticmethod
    def _deduplicate_attendance(
        records: list[IncomingAttendanceRecord],
    ) -> list[IncomingAttendanceRecord]:

        unique = {}

        for record in records:

            name = normalize_subject_name(
                str(
                    getattr(
                        record,
                        "subjectName",
                        "",
                    )
                    or ""
                )
            )

            code = normalize_subject_code(
                str(
                    getattr(
                        record,
                        "subjectCode",
                        "",
                    )
                    or ""
                )
            ) or ""

            date_value = str(
                getattr(
                    record,
                    "date",
                    "",
                )
                or ""
            ).strip()

            status_value = str(
                getattr(
                    record,
                    "status",
                    "",
                )
                or ""
            ).strip().upper()

            if not name or not date_value:
                continue

            if status_value not in {
                "PRESENT",
                "ABSENT",
            }:
                continue

            key = (
                VeltechAdapter._subject_key(
                    name
                ),
                code.casefold(),
                date_value,
            )

            if key not in unique:

                unique[key] = (
                    IncomingAttendanceRecord(
                        subjectName=name,
                        subjectCode=code,
                        date=date_value,
                        status=status_value,
                        source="parent_portal",
                    )
                )

        return list(
            unique.values()
        )

    # =========================================================
    # DATA SCORE
    # =========================================================

    @staticmethod
    def _portal_data_score(
        html: str,
    ) -> int:

        if not html:
            return -1

        score = 0

        try:
            subjects = (
                parse_parent_portal_subjects(
                    html
                )
                or []
            )

            score += min(
                len(subjects),
                20,
            ) * 10

        except Exception:
            pass

        try:
            attendance = (
                parse_attendance_table(
                    html
                )
                or []
            )

            score += min(
                len(attendance),
                200,
            )

        except Exception:
            pass

        text = VeltechAdapter._page_text(
            html
        ).lower()

        for marker in (
            "attendance",
            "student details",
            "weekly timetable",
            "credits earned summary",
            "subject",
            "present",
            "absent",
        ):
            if marker in text:
                score += 10

        return score

    # =========================================================
    # LOGIN PAGE
    # =========================================================

    @staticmethod
    def _looks_like_login_page(
        html: str,
    ) -> bool:

        if not html:
            return True

        soup = BeautifulSoup(
            html,
            "html.parser",
        )

        title = ""

        if soup.title:
            title = soup.title.get_text(
                " ",
                strip=True,
            ).lower()

        if (
            "parent login" in title
            or title.strip() == "login"
        ):
            return True

        text = soup.get_text(
            " ",
            strip=True,
        ).lower()

        dashboard_markers = (
            "student details",
            "weekly timetable",
            "credits earned summary",
        )

        if sum(
            marker in text
            for marker in dashboard_markers
        ) >= 2:
            return False

        return (
            "parent login" in text
            or "login to parent" in text
            or "parent portal login" in text
        )

    # =========================================================
    # DASHBOARD CHECK
    # =========================================================

    @staticmethod
    def _is_dashboard(
        html: str,
    ) -> bool:

        if not html:
            return False

        text = VeltechAdapter._page_text(
            html
        ).lower()

        markers = (
            "student details",
            "weekly timetable",
            "credits earned summary",
            "attendance",
            "subject",
            "present",
            "absent",
        )

        return (
            sum(
                marker in text
                for marker in markers
            )
            >= 2
        )

    # =========================================================
    # VTU ERROR
    # =========================================================

    @staticmethod
    def _contains_vtu_error(
        html: str,
    ) -> bool:

        if not html:
            return False

        text = VeltechAdapter._page_text(
            html
        ).lower()

        return (
            "vtu number is required" in text
            or "enter a valid vtu number" in text
            or "valid vtu number" in text
        )

    # =========================================================
    # VTU VALIDATOR
    # =========================================================

    @staticmethod
    def _is_vtu_username(
        value: str,
    ) -> bool:

        value = str(
            value or ""
        ).strip().upper()

        return bool(
            re.fullmatch(
                r"VTU\d+",
                value,
            )
        )

    # =========================================================
    # PAGE TEXT
    # =========================================================

    @staticmethod
    def _page_text(
        html: str,
    ) -> str:

        if not html:
            return ""

        soup = BeautifulSoup(
            html,
            "html.parser",
        )

        return soup.get_text(
            " ",
            strip=True,
        )

    # =========================================================
    # PHOTO
    # =========================================================

    async def get_student_photo(
        self,
        session: dict[str, Any],
    ) -> bytes | None:

        html = await self._get_dashboard_html(
            session
        )

        soup = BeautifulSoup(
            html,
            "html.parser",
        )

        for image in soup.find_all(
            "img"
        ):

            src = str(
                image.get(
                    "src",
                    "",
                )
                or ""
            ).strip()

            if src.startswith(
                "data:image/"
            ):
                return self._decode_data_image(
                    src
                )

        client = session.get(
            "client"
        )

        if not client:
            return None

        for image in soup.find_all(
            "img"
        ):

            src = str(
                image.get(
                    "src",
                    "",
                )
                or ""
            ).strip()

            if (
                not src
                or src.startswith("data:")
            ):
                continue

            try:

                response = await client.get(
                    urljoin(
                        self.dashboard_url,
                        src,
                    ),
                    headers={
                        "Referer": self.dashboard_url,
                    },
                )

                content_type = (
                    response.headers.get(
                        "content-type",
                        "",
                    ).lower()
                )

                if (
                    response.status_code == 200
                    and response.content
                    and content_type.startswith(
                        "image/"
                    )
                ):
                    return response.content

            except Exception:
                continue

        return None

    # =========================================================
    # LOGOUT
    # =========================================================

    async def logout(
        self,
        session: dict[str, Any],
    ) -> None:

        client = session.get(
            "client"
        )

        if client:
            await self._close_client(
                client
            )

    # =========================================================
    # CLOSE CLIENT
    # =========================================================

    @staticmethod
    async def _close_client(
        client: Any,
    ) -> None:

        try:
            await client.aclose()
        except Exception:
            pass

    # =========================================================
    # DATA IMAGE
    # =========================================================

    @staticmethod
    def _decode_data_image(
        source: str,
    ) -> bytes | None:

        try:

            encoded = source.split(
                ",",
                1,
            )[1]

            return base64.b64decode(
                encoded
            )

        except Exception:
            return None

    # =========================================================
    # SUBJECT KEY
    # =========================================================

    @staticmethod
    def _subject_key(
        value: str,
    ) -> str:

        return re.sub(
            r"\s+",
            " ",
            str(
                value or ""
            ).strip().casefold(),
        )
