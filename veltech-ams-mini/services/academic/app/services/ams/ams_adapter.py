from __future__ import annotations

import logging
import re
from typing import Any
from urllib.parse import urljoin, urlsplit

import httpx
from bs4 import BeautifulSoup

from app.college.parser import parse_ams_profile
from app.services.ams.login_admission import source_login_admission


logger = logging.getLogger(__name__)

class AmsChallengeRequired(RuntimeError):
    pass

def parse_login_form(html: str) -> dict[str, Any]:
    soup = BeautifulSoup(html, 'html.parser')
    fields = {item['name']: item.get('value', '') for item in soup.select('input[type="hidden"][name]')}
    challenge = soup.select_one('.captcha')
    display = challenge.get_text(' ', strip=True) if challenge else ''
    if any('{{' in value for value in fields.values()) or '{{' in display:
        raise AmsChallengeRequired('AMS returned an unrendered login template. Use the official Login.aspx page.')
    return {'fields': fields, 'requiresCaptcha': soup.select_one('input[name="captcha"]') is not None, 'challenge': display}


class AmsAuthenticationError(Exception):
    """
    Raised when the supplied AMS credentials are invalid.

    This is different from:
    - network errors
    - timeout errors
    - AMS server errors
    - parsing errors
    """

    def __init__(
        self,
        message: str = (
            "Invalid AMS credentials. "
            "Check the VTU number and AMS password."
        ),
    ) -> None:
        super().__init__(message)


class AmsAdapter:
    """
    Vel Tech Academic Management System adapter.

    IMPORTANT
    ---------
    This adapter does NOT handle attendance.

    It handles:
        - AMS login
        - student profile
        - timetable page
        - bucket
        - course registered details
        - timetable grid

    Existing attendance implementation is untouched.
    """

    BASE_URL = "https://ams.veltech.edu.in"

    LOGIN_URL = f"{BASE_URL}/Login.aspx"
    VALIDATION_URL = f"{BASE_URL}/Validation.aspx"
    DEFAULT_URL = f"{BASE_URL}/Default.aspx"
    LOGOUT_URL = f"{BASE_URL}/Logout.aspx"

    TIMETABLE_URL = f"{BASE_URL}/TimeTable.aspx"

    def __init__(self) -> None:
        self.timeout = 60.0

        self.headers = {
            "User-Agent": (
                "Mozilla/5.0 "
                "(Windows NT 10.0; Win64; x64) "
                "AppleWebKit/537.36 "
                "(KHTML, like Gecko) "
                "Chrome/151.0.0.0 Safari/537.36"
            ),
            "Accept": (
                "text/html,application/xhtml+xml,"
                "application/xml;q=0.9,image/avif,"
                "image/webp,*/*;q=0.8"
            ),
            "Accept-Language": (
                "en-IN,en-GB;q=0.9,en-US;q=0.8"
            ),
            "Connection": "keep-alive",
        }

    # =========================================================
    # LOGIN
    # =========================================================

    async def prepare_login(self) -> dict[str, Any]:
        async with source_login_admission.slot():
            return await self._prepare_login()

    async def _prepare_login(self) -> dict[str, Any]:
        client = httpx.AsyncClient(follow_redirects=True, timeout=30.0, headers=self.headers)
        try:
            response = await client.get(self.LOGIN_URL)
            response.raise_for_status()
            return {'client': client, **parse_login_form(response.text)}
        except BaseException:
            await client.aclose()
            raise

    async def login(
        self,
        username: str,
        password: str,
        vtu_number: str | None = None,
        captcha: str | None = None,
        prepared: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        async with source_login_admission.slot():
            return await self._login(username, password, vtu_number, captcha, prepared)

    async def _login(
        self,
        username: str,
        password: str,
        vtu_number: str | None = None,
        captcha: str | None = None,
        prepared: dict[str, Any] | None = None,
    ) -> dict[str, Any]:

        username = str(
            username or ""
        ).strip()

        password = str(
            password or ""
        )

        vtu_number = str(
            vtu_number or ""
        ).strip()

        if not username:
            raise ValueError(
                "AMS username / VTU number is required."
            )

        if not password:
            raise ValueError(
                "AMS password is required."
            )

        client = prepared['client'] if prepared else httpx.AsyncClient(
            follow_redirects=True,
            timeout=httpx.Timeout(
                connect=20.0,
                read=60.0,
                write=30.0,
                pool=20.0,
            ),
            headers=self.headers,
        )

        try:
            # =================================================
            # 1. OPEN LOGIN PAGE
            # =================================================

            if prepared:
                form = prepared
            else:
                login_response = await client.get(self.LOGIN_URL)
                login_response.raise_for_status()
                form = parse_login_form(login_response.text)
            if form['requiresCaptcha'] and not captcha:
                await client.aclose()
                raise AmsChallengeRequired('AMS requires manual CAPTCHA verification. Open Settings → Connections and load the AMS challenge.')

            # =================================================
            # 2. LOGIN
            # =================================================

            validation_response = await client.post(
                self.VALIDATION_URL,
                data={
                    **form['fields'],
                    "username": username,
                    "password": password,
                    **({'captcha': captcha.strip()} if captcha else {}),
                },
                headers={
                    "Content-Type": (
                        "application/x-www-form-urlencoded"
                    ),
                    "Referer": self.LOGIN_URL,
                    "Origin": self.BASE_URL,
                },
            )

            validation_response.raise_for_status()

            # =================================================
            # 3. CHECK LOGIN
            # =================================================

            if self._is_invalid_login_response(
                validation_response
            ):
                raise AmsAuthenticationError()

            # =================================================
            # 4. OPEN DASHBOARD
            # =================================================

            dashboard_response = await client.get(
                self.DEFAULT_URL,
                headers={
                    "Referer": self.LOGIN_URL,
                },
            )

            dashboard_response.raise_for_status()

            if self._is_login_page(
                str(dashboard_response.url)
            ):
                raise AmsAuthenticationError()

            html = dashboard_response.text

            if self._contains_authentication_error(
                html
            ):
                raise AmsAuthenticationError()

            if not self._looks_like_student_page(
                html
            ):
                raise AmsAuthenticationError(
                    "AMS login was not accepted. "
                    "Please check the VTU number and AMS password."
                )

            logger.info("AMS authentication successful")

            return {
                "client": client,
                "username": username,
                "portalUsername": username,
                "vtuNumber": vtu_number,
                "dashboard_html": html,
                "url": str(
                    dashboard_response.url
                ),
            }

        except AmsAuthenticationError:

            try:
                await client.aclose()
            except Exception:
                pass

            raise

        except httpx.HTTPStatusError as exc:

            status_code = (
                exc.response.status_code
                if exc.response is not None
                else None
            )

            if status_code in {
                401,
                403,
            }:

                try:
                    await client.aclose()
                except Exception:
                    pass

                raise AmsAuthenticationError() from exc

            try:
                await client.aclose()
            except Exception:
                pass

            raise

        except (
            httpx.ConnectError,
            httpx.ConnectTimeout,
            httpx.ReadTimeout,
            httpx.WriteTimeout,
            httpx.PoolTimeout,
        ):

            try:
                await client.aclose()
            except Exception:
                pass

            raise

        except BaseException:

            try:
                await client.aclose()
            except Exception:
                pass

            raise

    # =========================================================
    # LOGIN RESPONSE CHECK
    # =========================================================

    @classmethod
    def _is_invalid_login_response(
        cls,
        response: httpx.Response,
    ) -> bool:

        final_url = str(
            response.url
        )

        if cls._is_login_page(
            final_url
        ):
            return True

        return cls._contains_authentication_error(
            response.text
        )

    # =========================================================
    # LOGIN PAGE DETECTION
    # =========================================================

    @classmethod
    def _is_login_page(
        cls,
        url: str,
    ) -> bool:

        path = urlsplit(str(url or "")).path.lower()
        return path.endswith(("/login", "/login.aspx", "/login.html", "/login.htm"))

    # =========================================================
    # AUTH ERROR DETECTION
    # =========================================================

    @classmethod
    def _contains_authentication_error(
        cls,
        html: str,
    ) -> bool:

        if not html:
            return False

        soup = BeautifulSoup(
            html,
            "html.parser",
        )

        text = soup.get_text(
            " ",
            strip=True,
        ).lower()

        error_phrases = (
            "invalid username",
            "invalid password",
            "invalid user",
            "invalid credentials",
            "incorrect username",
            "incorrect password",
            "login failed",
            "authentication failed",
            "authentication failure",
            "invalid login",
            "wrong username",
            "wrong password",
        )

        return any(
            phrase in text
            for phrase in error_phrases
        )

    # =========================================================
    # STUDENT PROFILE
    # =========================================================

    async def get_student_profile(
        self,
        session: dict[str, Any],
    ) -> dict[str, Any]:

        client = session.get(
            "client"
        )

        if not client:
            raise ValueError(
                "AMS session is missing."
            )

        html = session.get(
            "dashboard_html"
        )

        if not html:

            response = await client.get(
                self.DEFAULT_URL,
                headers={
                    "Referer": self.LOGIN_URL,
                },
            )

            response.raise_for_status()

            if self._is_login_page(
                str(response.url)
            ):
                raise AmsAuthenticationError()

            html = response.text

            session[
                "dashboard_html"
            ] = html

        profile = parse_ams_profile(
            html
        )

        if not profile.get('name'):
            from app.services.ams.academic_pages import discover_academic_pages, iter_module_views, session_identifiers
            identifiers = session_identifiers(session)
            pages = discover_academic_pages(html, session.get('url') or self.DEFAULT_URL, identifiers, include_modules=True)
            budget = [0]
            for page in (page for page in pages if page['kind'] == 'profile'):
                try:
                    async for response in iter_module_views(session, page, self, budget):
                        candidate = parse_ams_profile(response.text)
                        source_id = candidate.get('vtuNumber') or candidate.get('portalUsername')
                        own = {str(value).casefold() for value in identifiers}
                        if candidate.get('name') and (not source_id or str(source_id).casefold() in own):
                            profile.update(candidate)
                except (httpx.HTTPError, ValueError):
                    continue
                if profile.get('name'):
                    break

        if not isinstance(
            profile,
            dict,
        ):
            raise ValueError(
                "AMS profile parser returned invalid data."
            )

        portal_username = (
            profile.get(
                "portalUsername"
            )
            or profile.get(
                "portal_username"
            )
            or session.get(
                "portalUsername"
            )
            or session.get(
                "username"
            )
        )

        roll_number = (
            profile.get(
                "vtuNumber"
            )
            or profile.get(
                "vtu_number"
            )
            or profile.get(
                "registrationNumber"
            )
            or profile.get(
                "registration_number"
            )
        )

        if portal_username:
            profile[
                "portalUsername"
            ] = str(
                portal_username
            ).strip()

        if roll_number:
            profile[
                "vtuNumber"
            ] = str(
                roll_number
            ).strip()

        # =====================================================
        # PHOTO
        # =====================================================

        photo_url = profile.get(
            "photoUrl"
        )

        if photo_url:
            from app.services.ams.safe_photo import fetch_source_photo
            photo = await fetch_source_photo(client, photo_url)
            if photo:
                profile['photoDataUri'] = photo
            else:
                profile['photoRequiresPortalSession'] = True

        return profile

    # =========================================================
    # GET TIMETABLE
    # =========================================================

    async def get_timetable(
        self,
        session: dict[str, Any],
    ) -> list[dict[str, Any]]:

        details = await self.get_timetable_details(
            session
        )

        return details.get(
            "timetable",
            [],
        )

    # =========================================================
    # COMPLETE TIMETABLE DETAILS
    # =========================================================

    async def get_timetable_details(
        self,
        session: dict[str, Any],
    ) -> dict[str, Any]:
        """
        Fetch complete TimeTable.aspx information.

        Includes:
            - student profile
            - bucket
            - registered courses
            - timetable
        """

        from app.services.ams.academic_pages import discover_academic_pages, iter_module_views, session_identifiers
        if not session.get('client'):
            raise ValueError('AMS session is missing.')
        views = discover_academic_pages(session.get('dashboard_html', ''),
            session.get('url', self.DEFAULT_URL), session_identifiers(session), include_modules=True)
        page = next((view for view in views if view['kind'] == 'timetable'),
                    {'url': self.TIMETABLE_URL, 'kind': 'timetable'})
        profile, bucket, courses, timetable = {}, None, [], []
        seen_courses, seen_periods = set(), set()
        async for response in iter_module_views(session, page, self, [0]):
            soup = BeautifulSoup(response.text, 'html.parser')
            profile.update({key: value for key, value in self._parse_timetable_profile(soup).items()
                            if value not in (None, '')})
            bucket = self._parse_bucket(soup) or bucket
            current_courses = self._parse_registered_courses(soup)
            for course in current_courses:
                key = tuple(sorted((key, str(value)) for key, value in course.items()))
                if key not in seen_courses:
                    seen_courses.add(key); courses.append(course)
            for period in self._parse_timetable_grid(soup, courses):
                key = tuple(sorted((key, str(value)) for key, value in period.items()))
                if key not in seen_periods:
                    seen_periods.add(key); timetable.append(period)
        logger.info('AMS timetable read: courses=%s periods=%s', len(courses), len(timetable))
        return {'profile': profile, 'bucket': bucket, 'courses': courses, 'timetable': timetable}

    # =========================================================
    # TIMETABLE PROFILE
    # =========================================================

    @classmethod
    def _parse_timetable_profile(
        cls,
        soup: BeautifulSoup,
    ) -> dict[str, Any]:

        profile = {
            "idNumber": cls._get_first_text(
                soup,
                [
                    "MainContent_lblID",
                    "MainContent_lblId",
                    "MainContent_lblIDNumber",
                ],
            ),

            "name": cls._get_first_text(
                soup,
                [
                    "MainContent_lblName",
                    "MainContent_lblStuname",
                    "MainContent_lblStudentName",
                ],
            ),

            "rollNumber": cls._get_first_text(
                soup,
                [
                    "MainContent_lblrollno",
                    "MainContent_lblRollNo",
                    "MainContent_lblRollNumber",
                ],
            ),

            "degree": cls._get_first_text(
                soup,
                [
                    "MainContent_lblDegree",
                ],
            ),

            "branch": cls._get_first_text(
                soup,
                [
                    "MainContent_lblBranch",
                ],
            ),

            "batch": cls._get_first_text(
                soup,
                [
                    "MainContent_lblbatch",
                    "MainContent_lblBatch",
                ],
            ),

            "semester": cls._get_first_text(
                soup,
                [
                    "MainContent_lblSemester",
                ],
            ),

            "regulation": cls._get_first_text(
                soup,
                [
                    "MainContent_lblRegulation",
                ],
            ),
        }

        return {
            key: value
            for key, value in profile.items()
            if value not in (
                None,
                "",
            )
        }

    # =========================================================
    # BUCKET
    # =========================================================

    @classmethod
    def _parse_bucket(
        cls,
        soup: BeautifulSoup,
    ) -> str | None:

        element = soup.find(
            id="MainContent_TextBox1"
        )

        if element:

            value = element.get(
                "value"
            )

            if value:
                return cls._clean_text(
                    value
                )

            text = cls._clean_text(
                element.get_text(
                    " ",
                    strip=True,
                )
            )

            if text:
                return text

        label = soup.find(
            id="MainContent_Label30"
        )

        if label:

            parent = label.parent

            if parent:

                text = cls._clean_text(
                    parent.get_text(
                        " ",
                        strip=True,
                    )
                )

                match = re.search(
                    r"bucket\s*:?\s*(.+)",
                    text,
                    flags=re.IGNORECASE,
                )

                if match:
                    value = cls._clean_text(
                        match.group(1)
                    )

                    if value:
                        return value

        return None

    # =========================================================
    # COURSE REGISTERED DETAILS
    # =========================================================

    @classmethod
    def _parse_registered_courses(
        cls,
        soup: BeautifulSoup,
    ) -> list[dict[str, Any]]:

        table = soup.find(
            id="MainContent_GridView3"
        )

        # -----------------------------------------------------
        # Fallback table detection
        # -----------------------------------------------------

        if table is None:

            for candidate in soup.find_all(
                "table"
            ):

                text = cls._clean_text(
                    candidate.get_text(
                        " ",
                        strip=True,
                    )
                ).lower()

                if (
                    "course code" in text
                    and "course name" in text
                ):
                    table = candidate
                    break

        if table is None:

            logger.warning(
                "AMS registered-course table not found."
            )

            return []

        rows = table.find_all(
            "tr"
        )

        if not rows:
            return []

        # -----------------------------------------------------
        # Find header row
        # -----------------------------------------------------

        header_index = None
        headers: list[str] = []

        for index, row in enumerate(
            rows
        ):

            values = [
                cls._clean_text(
                    cell.get_text(
                        " ",
                        strip=True,
                    )
                )
                for cell in row.find_all(
                    ["th", "td"]
                )
            ]

            normalized = [
                cls._normalize_header(
                    value
                )
                for value in values
            ]

            if (
                "coursecode" in normalized
                or "coursename" in normalized
            ):

                header_index = index
                headers = values
                break

        if header_index is None:
            return []

        indexes = {
            "sno": cls._find_column(
                headers,
                {
                    "sno",
                    "serialno",
                    "serialnumber",
                },
            ),

            "category": cls._find_column(
                headers,
                {
                    "category",
                },
            ),

            "courseCode": cls._find_column(
                headers,
                {
                    "coursecode",
                    "code",
                },
            ),

            "courseName": cls._find_column(
                headers,
                {
                    "coursename",
                    "subjectname",
                    "subject",
                    "name",
                },
            ),

            "credit": cls._find_column(
                headers,
                {
                    "credit",
                    "credits",
                },
            ),

            "facultyName": cls._find_column(
                headers,
                {
                    "facultyname",
                    "faculty",
                    "teacher",
                    "staff",
                },
            ),

            "facultyId": cls._find_column(
                headers,
                {
                    "facultyid",
                    "staffid",
                    "teacherid",
                },
            ),

            "slot": cls._find_column(
                headers,
                {
                    "slot",
                },
            ),

            "room": cls._find_column(
                headers,
                {
                    "room",
                    "roomno",
                    "roomnumber",
                    "classroom",
                },
            ),
        }

        courses: list[
            dict[str, Any]
        ] = []

        for row in rows[
            header_index + 1:
        ]:

            values = [
                cls._clean_text(
                    cell.get_text(
                        " ",
                        strip=True,
                    )
                )
                for cell in row.find_all(
                    ["th", "td"]
                )
            ]

            if not values:
                continue

            course: dict[str, Any] = {}

            for field, index in indexes.items():

                if index is None:
                    course[field] = None
                    continue

                if index >= len(values):
                    course[field] = None
                    continue

                value = values[index]

                if field == "credit":
                    course[field] = (
                        cls._parse_credit(
                            value
                        )
                    )
                else:
                    course[field] = (
                        value or None
                    )

            if not any(
                value not in (
                    None,
                    "",
                )
                for value in course.values()
            ):
                continue

            courses.append(
                course
            )

        logger.info(
            "AMS registered courses parsed: %s",
            len(courses),
        )

        return courses

    # =========================================================
    # TIMETABLE GRID
    # =========================================================

    @classmethod
    def _parse_timetable_grid(
        cls,
        soup: BeautifulSoup,
        courses: list[dict[str, Any]],
    ) -> list[dict[str, Any]]:

        table = soup.find(
            id="MainContent_GridTimetable"
        )

        # -----------------------------------------------------
        # Fallback table detection
        # -----------------------------------------------------

        if table is None:

            for candidate in soup.find_all(
                "table"
            ):

                text = cls._clean_text(
                    candidate.get_text(
                        " ",
                        strip=True,
                    )
                ).lower()

                day_count = sum(
                    1
                    for day in (
                        "monday",
                        "tuesday",
                        "wednesday",
                        "thursday",
                        "friday",
                        "saturday",
                        "sunday",
                    )
                    if day in text
                )

                if day_count >= 3:
                    table = candidate
                    break

        if table is None:

            logger.warning(
                "AMS timetable grid not found."
            )

            return []

        rows = table.find_all(
            "tr"
        )

        if not rows:
            return []

        # -----------------------------------------------------
        # Find header
        # -----------------------------------------------------

        header_index = None
        headers: list[str] = []

        for index, row in enumerate(
            rows
        ):

            values = [
                cls._clean_text(
                    cell.get_text(
                        " ",
                        strip=True,
                    )
                )
                for cell in row.find_all(
                    ["th", "td"]
                )
            ]

            if len(values) < 2:
                continue

            has_time = any(
                cls._looks_like_time_slot(
                    value
                )
                for value in values[1:]
            )

            if has_time:

                header_index = index
                headers = values
                break

        if header_index is None:

            # -------------------------------------------------
            # Fallback: first row as header
            # -------------------------------------------------

            first_row = rows[0]

            headers = [
                cls._clean_text(
                    cell.get_text(
                        " ",
                        strip=True,
                    )
                )
                for cell in first_row.find_all(
                    ["th", "td"]
                )
            ]

            if len(headers) < 2:
                return []

            header_index = 0

        time_slots = headers[1:]

        records: list[
            dict[str, Any]
        ] = []

        # -----------------------------------------------------
        # Parse day rows
        # -----------------------------------------------------

        for row in rows[
            header_index + 1:
        ]:

            cells = row.find_all(
                ["td", "th"]
            )

            if not cells:
                continue

            values = [
                cls._clean_text(
                    cell.get_text(
                        " ",
                        strip=True,
                    )
                )
                for cell in cells
            ]

            if not values:
                continue

            day = cls._detect_day(
                values[0]
            )

            if not day:
                continue

            # -------------------------------------------------
            # Each timetable period
            # -------------------------------------------------

            for index, subject in enumerate(
                values[1:]
            ):

                if index >= len(
                    time_slots
                ):
                    continue

                if not subject:
                    continue

                if subject.lower() in {
                    "-",
                    "--",
                    "—",
                    "free",
                    "free hour",
                    "none",
                    "nil",
                }:
                    continue

                slot = time_slots[
                    index
                ]

                start_time, end_time = (
                    cls._parse_time_slot(
                        slot
                    )
                )

                matched_course = (
                    cls._find_course(
                        subject,
                        courses,
                    )
                )

                record = {
                    "day": day,

                    "slot": slot,

                    "startTime": start_time,

                    "endTime": end_time,

                    "subjectName": (
                        matched_course.get(
                            "courseName"
                        )
                        if matched_course
                        else subject
                    ),

                    "courseName": (
                        matched_course.get(
                            "courseName"
                        )
                        if matched_course
                        else subject
                    ),

                    "subjectCode": (
                        matched_course.get(
                            "courseCode"
                        )
                        if matched_course
                        else cls._extract_course_code(
                            subject
                        )
                    ),

                    "faculty": (
                        matched_course.get(
                            "facultyName"
                        )
                        if matched_course
                        else None
                    ),

                    "facultyId": (
                        matched_course.get(
                            "facultyId"
                        )
                        if matched_course
                        else None
                    ),

                    "room": (
                        matched_course.get(
                            "room"
                        )
                        if matched_course
                        else None
                    ),

                    "category": (
                        matched_course.get(
                            "category"
                        )
                        if matched_course
                        else None
                    ),

                    "credit": (
                        matched_course.get(
                            "credit"
                        )
                        if matched_course
                        else None
                    ),

                    "active": True,

                    "source": "ams",
                }

                records.append(
                    record
                )

        logger.info(
            "AMS timetable records parsed: %s",
            len(records),
        )

        return records

    # =========================================================
    # FIND COURSE
    # =========================================================

    @classmethod
    def _find_course(
        cls,
        subject: str,
        courses: list[dict[str, Any]],
    ) -> dict[str, Any] | None:

        normalized_subject = (
            cls._normalize_match(
                subject
            )
        )

        if not normalized_subject:
            return None

        for course in courses:

            course_name = str(
                course.get(
                    "courseName"
                )
                or ""
            )

            course_code = str(
                course.get(
                    "courseCode"
                )
                or ""
            )

            normalized_name = (
                cls._normalize_match(
                    course_name
                )
            )

            normalized_code = (
                cls._normalize_match(
                    course_code
                )
            )

            # Exact course name
            if (
                normalized_name
                and normalized_name
                == normalized_subject
            ):
                return course

            # Course name contained in timetable cell
            if (
                normalized_name
                and normalized_name
                in normalized_subject
            ):
                return course

            # Timetable cell contained in course name
            if (
                normalized_subject
                and normalized_subject
                in normalized_name
            ):
                return course

            # Course code match
            if (
                normalized_code
                and normalized_code
                in normalized_subject
            ):
                return course

        return None

    # =========================================================
    # FIND COLUMN
    # =========================================================

    @classmethod
    def _find_column(
        cls,
        headers: list[str],
        names: set[str],
    ) -> int | None:

        normalized_names = {
            cls._normalize_header(
                name
            )
            for name in names
        }

        for index, header in enumerate(
            headers
        ):

            normalized = (
                cls._normalize_header(
                    header
                )
            )

            if normalized in normalized_names:
                return index

        return None

    # =========================================================
    # NORMALIZE HEADER
    # =========================================================

    @staticmethod
    def _normalize_header(
        value: str,
    ) -> str:

        return re.sub(
            r"[^a-zA-Z0-9]+",
            "",
            str(value or ""),
        ).lower()

    # =========================================================
    # NORMALIZE MATCH
    # =========================================================

    @staticmethod
    def _normalize_match(
        value: str,
    ) -> str:

        return re.sub(
            r"[^a-zA-Z0-9]+",
            "",
            str(value or ""),
        ).lower()

    # =========================================================
    # CLEAN TEXT
    # =========================================================

    @staticmethod
    def _clean_text(
        value: str,
    ) -> str:

        return re.sub(
            r"\s+",
            " ",
            str(value or ""),
        ).strip()

    # =========================================================
    # GET FIRST ELEMENT TEXT
    # =========================================================

    @classmethod
    def _get_first_text(
        cls,
        soup: BeautifulSoup,
        ids: list[str],
    ) -> str | None:

        for element_id in ids:

            element = soup.find(
                id=element_id
            )

            if element:

                value = cls._clean_text(
                    element.get_text(
                        " ",
                        strip=True,
                    )
                )

                if value:
                    return value

                input_value = element.get(
                    "value"
                )

                if input_value:
                    return cls._clean_text(
                        input_value
                    )

        return None

    # =========================================================
    # DETECT DAY
    # =========================================================

    @staticmethod
    def _detect_day(
        value: str,
    ) -> str | None:

        normalized = (
            str(value or "")
            .strip()
            .lower()
        )

        days = {
            "monday": "Monday",
            "tuesday": "Tuesday",
            "wednesday": "Wednesday",
            "thursday": "Thursday",
            "friday": "Friday",
            "saturday": "Saturday",
            "sunday": "Sunday",
        }

        # Exact match
        if normalized in days:
            return days[
                normalized
            ]

        # Handle values like:
        # Monday -
        # Monday 1
        # Monday:
        for key, display in days.items():

            if normalized.startswith(
                key
            ):
                return display

        return None

    # =========================================================
    # TIME SLOT CHECK
    # =========================================================

    @staticmethod
    def _looks_like_time_slot(
        value: str,
    ) -> bool:

        if not value:
            return False

        return bool(
            re.search(
                r"\d{1,2}\s*[:.]\s*\d{2}",
                value,
            )
            and re.search(
                r"[-–]",
                value,
            )
        )

    # =========================================================
    # PARSE TIME SLOT
    # =========================================================

    @staticmethod
    def _parse_time_slot(
        value: str,
    ) -> tuple[
        str | None,
        str | None,
    ]:

        value = re.sub(
            r"\s+",
            " ",
            str(value or ""),
        ).strip()

        if not value:
            return None, None

        match = re.match(
            r"^(.*?)\s*[-–]\s*(.*?)$",
            value,
        )

        if not match:
            return (
                value,
                None,
            )

        start = match.group(
            1
        ).strip()

        end = match.group(
            2
        ).strip()

        return (
            start or None,
            end or None,
        )

    # =========================================================
    # PARSE CREDIT
    # =========================================================

    @staticmethod
    def _parse_credit(
        value: str | None,
    ) -> int | float | str | None:

        if not value:
            return None

        value = value.strip()

        try:

            if "." in value:
                return float(
                    value
                )

            return int(
                value
            )

        except ValueError:

            return value

    # =========================================================
    # EXTRACT COURSE CODE
    # =========================================================

    @staticmethod
    def _extract_course_code(
        value: str,
    ) -> str | None:
        """
        Try to extract a course code from a timetable cell.

        Example:
            22AI301
            CS301
            23CSE102
        """

        if not value:
            return None

        match = re.search(
            r"\b[A-Z]{1,6}\d{2,4}[A-Z]?\b",
            value.upper(),
        )

        if match:
            return match.group(
                0
            )

        match = re.search(
            r"\b\d{2}[A-Z]{2,6}\d{2,4}\b",
            value.upper(),
        )

        if match:
            return match.group(
                0
            )

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

        if not client:
            return

        try:

            await client.get(
                self.LOGOUT_URL,
                headers={
                    "Referer": self.DEFAULT_URL,
                },
            )

        except Exception as exc:

            logger.warning(
                "AMS logout warning: %s",
                exc,
            )

        finally:

            try:
                await client.aclose()
            except Exception:
                pass

    # =========================================================
    # CHECK AUTHENTICATED STUDENT PAGE
    # =========================================================

    @classmethod
    def _looks_like_student_page(
        cls,
        html: str,
    ) -> bool:

        if not html:
            return False

        soup = BeautifulSoup(
            html,
            "html.parser",
        )

        important_ids = [
            "MainContent_lblStuname",
            "MainContent_lblID",
            "MainContent_lblRollNo",
            "MainContent_lblBranch",
            "MainContent_lblFathername",
            "MainContent_lblMothername",
        ]

        matches = sum(
            1
            for element_id in important_ids
            if soup.find(
                id=element_id
            )
        )

        if matches >= 2:
            return True

        page_text = soup.get_text(
            " ",
            strip=True,
        ).lower()

        indicators = (
            "student",
            "father",
            "mother",
            "branch",
            "semester",
            "academic",
        )

        indicator_count = sum(
            1
            for item in indicators
            if item in page_text
        )

        return indicator_count >= 3
