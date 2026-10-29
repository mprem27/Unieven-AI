from __future__ import annotations

import re
from datetime import date, datetime
from typing import Any, Callable, Iterable

from bs4 import BeautifulSoup, Tag

from app.college.normalizer import (
    normalize_subject_code,
    normalize_subject_name,
)
from app.schemas.attendance import IncomingAttendanceRecord


# =========================================================
# STATUS CONSTANTS
# =========================================================

STATUS_PRESENT = {
    "P",
    "PRESENT",
    "YES",
    "Y",
    "1",
    "✓",
    "✔",
    "CHECK",
    "CHECKED",
    "PR",
    "PRESENT(P)",
    "PRESENT(PR)",
}

STATUS_ABSENT = {
    "A",
    "ABSENT",
    "NO",
    "N",
    "0",
    "X",
    "✗",
    "✘",
    "AB",
    "ABSENT(A)",
    "ABSENT(AB)",
}

STATUS_IGNORED = {
    "",
    "-",
    "--",
    "–",
    "—",
    "N/A",
    "NA",
    "NONE",
    "NULL",
    "UNDEFINED",
    "NIL",
    "NO CLASS",
    "NOCLASS",
    "ACTIVITY",
    "ACTIVITY HOUR",
    "ACTIVITY HOURS",
    "PROJECT",
    "PROJECT HOUR",
    "PROJECT HOURS",
    "PROJECT WORK",
    "TOTAL",
    "TOTAL HOURS",
    "TOTAL ATTENDANCE",
    "PERCENTAGE",
    "PERCENT",
    "%",
    "ATTENDANCE",
    "STATUS",
    "SUBJECT",
    "SUBJECT NAME",
    "SUBJECT CODE",
    "COURSE",
    "COURSE NAME",
    "COURSE CODE",
}

# =========================================================
# DATE PATTERNS
# =========================================================

DATE_PATTERNS = (
    re.compile(r"\b\d{4}-\d{2}-\d{2}\b"),
    re.compile(r"\b\d{2}/\d{2}/\d{4}\b"),
    re.compile(r"\b\d{2}-\d{2}-\d{4}\b"),
    re.compile(r"\b\d{2}\.\d{2}\.\d{4}\b"),
)

DATE_BLOCK_RE = re.compile(
    r"\[\s*(\d{4}-\d{2}-\d{2})\s*\]"
    r"\s*=>\s*Array\s*\(",
    re.IGNORECASE,
)


# =========================================================
# AMS PROFILE
# =========================================================

def parse_ams_profile(html: str) -> dict[str, Any]:
    if not html or not html.strip():
        return {}

    soup = BeautifulSoup(
        html,
        "html.parser",
    )

    profile: dict[str, Any] = {}

    mappings = {
        "MainContent_lblStuname": "name",
        # VTU number / AMS login username: VTU00000
        "MainContent_lblID": "vtuNumber",

        # Actual college roll / registration number: 23UECS1039
        "MainContent_lblRollNo": "rollNumber",
        "MainContent_lblgender": "gender",
        "MainContent_lblFathername": "fatherName",
        "MainContent_lblMothername": "motherName",
        "MainContent_lbldob": "dateOfBirth",
        "MainContent_lblDegree": "degree",
        "MainContent_lblBranch": "branch",
        "MainContent_lblcommunity": "community",
        "MainContent_lblReligion": "religion",
        "MainContent_lblNation": "nationality",
        "MainContent_lblAadhar": "aadhaarNumber",
        "MainContent_lblmobile": "phoneNumber",
        "MainContent_Lblabcid": "academicBankCreditsId",
        "MainContent_Label45": "semester",
        "MainContent_lblstatus": "registrationStatus",
        "MainContent_lblMentorName": "mentorName",
        "MainContent_lblMentor": "mentorName",
        "MainContent_lblBatch": "batch",
    }

    for html_id, target_key in mappings.items():
        element = soup.find(
            id=html_id
        )

        if element:
            profile[target_key] = _clean_text(
                element.get_text(
                    " ",
                    strip=True,
                )
            )

    # Static dashboard label/value rows are a fallback for source variants.
    # Unknown labels and inputs are never promoted to official identity fields.
    labels = {
        'studentname':'name', 'name':'name', 'vtunumber':'vtuNumber', 'vtuno':'vtuNumber',
        'rollnumber':'rollNumber', 'rollno':'rollNumber', 'registrationnumber':'rollNumber',
        'gender':'gender', 'fathername':'fatherName', 'fathersname':'fatherName',
        'mothername':'motherName', 'mothersname':'motherName', 'dateofbirth':'dateOfBirth',
        'degree':'degree', 'branch':'branch', 'department':'department', 'section':'section',
        'year':'year', 'academicyear':'academicYear', 'semester':'semester', 'batch':'batch',
        'regulation':'regulation', 'regulationname':'regulation',
        'mentorname':'mentorName', 'mentor':'mentorName', 'community':'community',
        'religion':'religion', 'nationality':'nationality', 'aadhaarnumber':'aadhaarNumber',
        'aadharnumber':'aadhaarNumber', 'mobilenumber':'phoneNumber', 'contactnumber':'phoneNumber',
        'collegeemail':'amsEmail', 'institutionalemail':'amsEmail', 'email':'amsEmail',
        'academicbankofcreditsid':'academicBankCreditsId', 'abcid':'academicBankCreditsId',
        'registrationstatus':'registrationStatus',
    }
    pairs=[]
    for tr in soup.find_all('tr'):
        cells=tr.find_all(['td','th'],recursive=False)
        if len(cells)==2 and not any(cell.find(['input','select','textarea','table']) for cell in cells):
            pairs.append(tuple(cell.get_text(' ',strip=True) for cell in cells))
    for dt in soup.find_all('dt'):
        dd=dt.find_next_sibling('dd')
        if dd and not dd.find(['input','select','textarea']):pairs.append((dt.get_text(' ',strip=True),dd.get_text(' ',strip=True)))
    for label,value in pairs:
        key=labels.get(re.sub(r'[^a-z0-9]','',label.lower()))
        value=_clean_text(value)
        if key and value and len(value)<=300 and not profile.get(key):profile[key]=value

    # =====================================================
    # IDENTIFIER NORMALIZATION
    # =====================================================
    # Project rule:
    #   VTU number / AMS username = VTU00000
    #   Roll / registration       = 23UECS1039
    #
    # Never use the roll/registration number as the
    # Parent Portal login username.

    vtu_number = _clean_text(
        profile.get("vtuNumber")
    )

    if vtu_number:
        profile["vtuNumber"] = vtu_number
        profile["portalUsername"] = vtu_number

    image = soup.find(
        id="MainContent_Stuimage"
    )

    if image and image.get("src"):
        profile["photoUrl"] = str(
            image["src"]
        ).strip()

    return profile


# =========================================================
# PARENT PORTAL PROFILE
# =========================================================

def parse_parent_portal_profile(
    html: str,
) -> dict[str, Any]:

    if not html or not html.strip():
        return {}

    soup = BeautifulSoup(
        html,
        "html.parser",
    )

    profile: dict[str, Any] = {}

    # -----------------------------------------------------
    # First try Student Details heading
    # -----------------------------------------------------

    heading = soup.find(
        ["h1", "h2", "h3", "h4"],
        string=re.compile(
            r"student\s+details",
            re.IGNORECASE,
        ),
    )

    tables = []

    if heading:
        table = heading.find_next(
            "table"
        )

        if table:
            tables.append(table)

    # -----------------------------------------------------
    # Fallback: inspect all tables
    # -----------------------------------------------------

    for table in soup.find_all("table"):
        if table not in tables:
            text = _clean_text(
                table.get_text(
                    " ",
                    strip=True,
                )
            ).lower()

            if (
                "university identification" in text
                or "student details" in text
                or "branch" in text
                or "semester" in text
            ):
                tables.append(table)

    # -----------------------------------------------------
    # Extract key/value rows
    # -----------------------------------------------------

    for table in tables:
        for row in table.find_all("tr"):
            cells = row.find_all(
                ["th", "td"],
                recursive=False,
            )

            if len(cells) < 2:
                continue

            key = _clean_text(
                cells[0].get_text(
                    " ",
                    strip=True,
                )
            ).lower()

            value = _clean_text(
                cells[1].get_text(
                    " ",
                    strip=True,
                )
            )

            if not key or not value:
                continue

            if "university identification" in key:
                values = _extract_identifiers(
                    cells[1]
                )

                # First value is normally the VTU number;
                # second value is normally the roll/registration number.
                for value in values:
                    value = _clean_text(value).upper()

                    if not value:
                        continue

                    if value.startswith("VTU"):
                        profile["vtuNumber"] = value
                        profile["portalUsername"] = value
                    elif not profile.get("rollNumber"):
                        profile["rollNumber"] = value

            elif (
                "name" in key
                and "mentor" not in key
            ):
                profile["name"] = value

            elif "branch" in key:
                profile["branch"] = value

            elif "batch" in key:
                profile["batch"] = value

            elif "semester" in key:
                profile["semester"] = value

    # -----------------------------------------------------
    # Identifier fallback
    # -----------------------------------------------------

    page_text = _clean_text(
        soup.get_text(
            " ",
            strip=True,
        )
    ).upper()

    vtu_match = re.search(
        r"\bVTU\s*\d{3,10}\b",
        page_text,
    )

    roll_match = re.search(
        r"\b\d{2}[A-Z]{2,8}\d{3,10}\b",
        page_text,
    )

    if vtu_match:
        vtu_number = (
            vtu_match.group(0)
            .replace(" ", "")
        )

        profile["vtuNumber"] = vtu_number
        profile["portalUsername"] = vtu_number

    if roll_match:
        roll_number = roll_match.group(0)

        if not roll_number.startswith("VTU"):
            profile["rollNumber"] = roll_number

    # -----------------------------------------------------
    # Find photo
    # -----------------------------------------------------

    for image in soup.find_all("img"):
        classes = " ".join(
            image.get("class", [])
        ).lower()

        src = str(
            image.get("src", "")
            or ""
        ).strip()

        if (
            "student-photo" in classes
            or "student" in src.lower()
            or "photo" in src.lower()
        ):
            if src:
                profile["photoUrl"] = src
                break

    return profile


# =========================================================
# PARENT PORTAL SUBJECTS
# =========================================================

def parse_parent_portal_subjects(
    html: str,
) -> list[dict[str, str]]:
    """
    Extract current subjects from the Parent Portal.

    The portal has used more than one HTML layout. This parser therefore
    checks:
      1. data-label rows
      2. normal tables with headers
      3. rows containing a recognizable subject code
      4. subject/code text blocks
      5. visible attendance-summary cards

    It never creates a subject from a percentage, date, status, or total.
    """
    if not html or not html.strip():
        return []

    soup = BeautifulSoup(html, "html.parser")
    subjects: list[dict[str, str]] = []
    seen: set[str] = set()

    def add_subject(code_value: object, name_value: object) -> None:
        code = normalize_subject_code(_clean_text(code_value))
        name = normalize_subject_name(_clean_text(name_value))

        if not name or not _is_valid_live_subject_name(name):
            return

        if code and not _looks_like_subject_code(code):
            code = ""

        key = code.casefold() if code else _subject_key(name)

        if key in seen:
            return

        seen.add(key)
        subjects.append({"code": code, "name": name})

    # 1. data-label based layouts
    for element in soup.find_all(["tr", "div", "li"]):
        labels = element.find_all(attrs={"data-label": True})
        if not labels:
            continue

        code_value = ""
        name_value = ""

        for item in labels:
            label = _clean_text(item.get("data-label", "")).lower()
            value = _clean_text(item.get_text(" ", strip=True))

            if re.search(r"(course|subject).*(code|id)|^code$", label):
                code_value = value
            elif re.search(r"(course|subject).*(name|title)|^name$", label):
                name_value = value

        if name_value:
            add_subject(code_value, name_value)

    # 2. Normal HTML tables
    for table in soup.find_all("table"):
        _extract_subjects_from_table(table, add_subject)

    # 3. Cards / div blocks that contain subject code + name
    for container in soup.find_all(["div", "li", "article"]):
        text_value = _clean_text(container.get_text(" ", strip=True))

        if len(text_value) > 300:
            continue

        code_match = re.search(
            r"\b(?:[A-Z]{2,8}\s*[-/]?\s*\d{2,8}|\d{2,4}[A-Z]{2,8}\d{2,8})\b",
            text_value.upper(),
        )

        if not code_match:
            continue

        code = normalize_subject_code(code_match.group(0))
        remainder = _clean_text(
            text_value[:code_match.start()] + " " +
            text_value[code_match.end():]
        )

        # Remove common attendance fields from the remainder.
        remainder = re.sub(
            r"\b(?:present|absent|total|attendance|percentage|percent|classes|hours)\b"
            r"\s*:?\s*\d+(?:\.\d+)?%?",
            " ",
            remainder,
            flags=re.IGNORECASE,
        )
        remainder = _clean_text(remainder)

        if _is_valid_live_subject_name(remainder):
            add_subject(code, remainder)

    # 4. Visible text fallback.
    if not subjects:
        _extract_subjects_from_text(soup, add_subject)

    # 5. Last-resort row scan.
    if not subjects:
        for row in soup.find_all("tr"):
            cells = row.find_all(["td", "th"], recursive=False)
            if len(cells) < 2:
                continue

            values = [
                _clean_text(cell.get_text(" ", strip=True))
                for cell in cells
            ]

            code_index = next(
                (
                    i for i, value in enumerate(values)
                    if _looks_like_subject_code(
                        normalize_subject_code(value)
                    )
                ),
                None,
            )

            if code_index is None:
                continue

            candidates = [
                value
                for i, value in enumerate(values)
                if i != code_index
                and _is_valid_live_subject_name(value)
            ]

            if candidates:
                add_subject(
                    values[code_index],
                    max(candidates, key=len),
                )

    return subjects


# =========================================================
# SUBJECT TABLE EXTRACTION
# =========================================================

def _extract_subjects_from_table(
    table: Tag,
    add_subject: Callable,
) -> None:

    rows = table.find_all("tr")

    if not rows:
        return

    header_row = None
    headers: list[Tag] = []

    for row in rows[:5]:
        row_headers = row.find_all(
            "th",
            recursive=False,
        )

        if row_headers:
            header_row = row
            headers = row_headers
            break

    if not headers:
        first_cells = rows[0].find_all(
            ["td", "th"],
            recursive=False,
        )

        header_texts = [
            _clean_text(
                cell.get_text(
                    " ",
                    strip=True,
                )
            ).lower()
            for cell in first_cells
        ]

        if any(
            re.search(
                r"(course|subject)\s*(code|name|title)",
                value,
                re.IGNORECASE,
            )
            for value in header_texts
        ):
            header_row = rows[0]
            headers = first_cells

    if headers:
        code_index = None
        name_index = None

        for index, header in enumerate(
            headers
        ):
            value = _clean_text(
                header.get_text(
                    " ",
                    strip=True,
                )
            )

            if (
                code_index is None
                and re.search(
                    r"(course|subject)\s*code|code",
                    value,
                    re.IGNORECASE,
                )
            ):
                code_index = index

            if (
                name_index is None
                and re.search(
                    r"(course|subject)\s*(name|title)|name|subject",
                    value,
                    re.IGNORECASE,
                )
            ):
                name_index = index

        if (
            code_index is not None
            and name_index is not None
        ):
            for row in rows:
                if row is header_row:
                    continue

                cells = row.find_all(
                    ["td", "th"],
                    recursive=False,
                )

                if (
                    len(cells)
                    <= max(
                        code_index,
                        name_index,
                    )
                ):
                    continue

                add_subject(
                    cells[code_index].get_text(
                        " ",
                        strip=True,
                    ),
                    cells[name_index].get_text(
                        " ",
                        strip=True,
                    ),
                )

    # -----------------------------------------------------
    # Generic table row detection
    # -----------------------------------------------------

    for row in rows:
        cells = row.find_all(
            ["td", "th"],
            recursive=False,
        )

        if len(cells) < 2:
            continue

        code_index = None
        code = ""

        for index, cell in enumerate(
            cells
        ):
            candidate = normalize_subject_code(
                _clean_text(
                    cell.get_text(
                        " ",
                        strip=True,
                    )
                )
            )

            if _looks_like_subject_code(
                candidate
            ):
                code_index = index
                code = candidate
                break

        if code_index is None:
            continue

        names = []

        for index, cell in enumerate(
            cells
        ):
            if index == code_index:
                continue

            value = _clean_text(
                cell.get_text(
                    " ",
                    strip=True,
                )
            )

            if (
                value
                and not _extract_date(value)
                and not _normalize_status(value)
                and not _is_number(value)
                and _is_valid_live_subject_name(
                    value
                )
            ):
                names.append(value)

        if names:
            add_subject(
                code,
                max(
                    names,
                    key=len,
                ),
            )


# =========================================================
# SUBJECT TEXT FALLBACK
# =========================================================

def _extract_subjects_from_text(
    soup: BeautifulSoup,
    add_subject: Callable,
) -> None:

    text = soup.get_text(
        "\n",
        strip=True,
    )

    if not text:
        return

    lines = [
        _clean_text(line)
        for line in text.splitlines()
    ]

    for index, line in enumerate(
        lines
    ):
        code = normalize_subject_code(
            line
        )

        if not _looks_like_subject_code(
            code
        ):
            continue

        for next_line in lines[
            index + 1:index + 4
        ]:
            if (
                _is_valid_live_subject_name(
                    next_line
                )
            ):
                add_subject(
                    code,
                    next_line,
                )
                break


# =========================================================
# SUBJECT CODE CHECK
# =========================================================

def _looks_like_subject_code(
    value: str | None,
) -> bool:

    if not value:
        return False

    value = _clean_text(
        value
    ).upper()

    patterns = (
        r"\d{4,6}[A-Z]{2,8}\d{1,5}",
        r"[A-Z]{2,8}\d{3,6}",
        r"[A-Z]{2,8}-\d{2,6}",
        r"\d{2,4}[A-Z]{2,8}\d{2,6}",
    )

    return any(
        re.fullmatch(
            pattern,
            value,
        )
        for pattern in patterns
    )


# =========================================================
# VALID SUBJECT NAME
# =========================================================

def _is_valid_live_subject_name(
    value: str | None,
) -> bool:

    if not value:
        return False

    value = _clean_text(
        value
    )

    if not value:
        return False

    upper = value.upper()

    if upper in STATUS_IGNORED:
        return False

    if _extract_date(value):
        return False

    if _normalize_status(value):
        return False

    if _looks_like_subject_code(
        value
    ):
        return False

    if _is_number(value):
        return False

    if len(value) < 3:
        return False

    blocked = {
        "DATE",
        "COURSE",
        "COURSE CODE",
        "COURSE NAME",
        "SUBJECT",
        "SUBJECT CODE",
        "SUBJECT NAME",
        "NAME",
        "CODE",
        "STATUS",
        "ATTENDANCE",
        "PRESENT",
        "ABSENT",
        "TOTAL",
        "PERCENTAGE",
        "PERCENT",
        "CREDIT",
        "CREDITS",
    }

    return upper not in blocked


# =========================================================
# TIMETABLE
# =========================================================

def parse_parent_portal_timetable(
    html: str,
) -> list[dict[str, Any]]:

    if not html or not html.strip():
        return []

    soup = BeautifulSoup(
        html,
        "html.parser",
    )

    timetable = []

    tables = []

    heading = soup.find(
        ["h1", "h2", "h3", "h4"],
        string=re.compile(
            r"weekly\s+timetable",
            re.IGNORECASE,
        ),
    )

    if heading:
        table = heading.find_next(
            "table"
        )

        if table:
            tables.append(table)

    for table in soup.find_all(
        "table"
    ):
        if table not in tables:
            text = _clean_text(
                table.get_text(
                    " ",
                    strip=True,
                )
            ).lower()

            if (
                "timetable" in text
                or "monday" in text
                or "tuesday" in text
                or "wednesday" in text
            ):
                tables.append(table)

    for table in tables:
        rows = table.find_all("tr")

        if not rows:
            continue

        headers = rows[0].find_all(
            ["th", "td"],
            recursive=False,
        )

        if len(headers) < 2:
            continue

        slots = [
            _clean_text(
                cell.get_text(
                    " ",
                    strip=True,
                )
            )
            for cell in headers[1:]
        ]

        for row in rows[1:]:
            cells = row.find_all(
                ["td", "th"],
                recursive=False,
            )

            if not cells:
                continue

            day = _clean_text(
                cells[0].get_text(
                    " ",
                    strip=True,
                )
            )

            if not day:
                continue

            for index, cell in enumerate(
                cells[1:]
            ):
                if index >= len(slots):
                    continue

                subject = _clean_text(
                    cell.get_text(
                        " ",
                        strip=True,
                    )
                )

                if (
                    not subject
                    or subject in {
                        "-",
                        "--",
                        "—",
                    }
                ):
                    continue

                start_time = ""
                end_time = ""

                slot = slots[index]

                if "-" in slot:
                    parts = slot.split(
                        "-",
                        1,
                    )

                    start_time = (
                        parts[0].strip()
                    )
                    end_time = (
                        parts[1].strip()
                    )

                timetable.append(
                    {
                        "day": day,
                        "startTime": start_time,
                        "endTime": end_time,
                        "subjectName": normalize_subject_name(
                            subject
                        ),
                    }
                )

    return timetable


# =========================================================
# ATTENDANCE PUBLIC FUNCTION
# =========================================================

def parse_attendance_table(
    html: str,
) -> list[IncomingAttendanceRecord]:
    """
    Extract attendance from the Parent Portal response.

    All known layouts are attempted. Results are merged and deduplicated.
    A ValueError is raised only when no real attendance record can be
    extracted.
    """
    if not html or not html.strip():
        raise ValueError("Empty Parent Portal response.")

    parsers = (
        _parse_display_attendance,
        _parse_html_attendance_matrix,
        _parse_detailed_php_attendance,
        _parse_generic_rows,
    )

    all_records: list[IncomingAttendanceRecord] = []

    for parser in parsers:
        try:
            records = parser(html)
            if records:
                all_records.extend(records)
        except Exception as exc:
            pass

    records = _deduplicate_records(all_records)

    if records:
        return records

    raise ValueError(
        "Attendance data was not found in the Parent Portal response."
    )


# =========================================================
# DEBUG DISPLAY ATTENDANCE
# =========================================================

def _parse_display_attendance(
    html: str,
) -> list[IncomingAttendanceRecord]:

    marker = re.search(
        r"Debug\s+displayAttendance\s*:\s*Array\s*\(",
        html,
        re.IGNORECASE,
    )

    if not marker:
        return []

    start = marker.end()

    comment_end = html.find(
        "-->",
        start,
    )

    block = (
        html[start:]
        if comment_end == -1
        else html[start:comment_end]
    )

    date_matches = list(
        DATE_BLOCK_RE.finditer(
            block
        )
    )

    if not date_matches:
        return []

    soup = BeautifulSoup(
        html,
        "html.parser",
    )

    subject_codes = _extract_subject_codes(
        soup
    )

    records = []

    for index, date_match in enumerate(
        date_matches
    ):
        attendance_date = date_match.group(
            1
        )

        if not _is_valid_date(
            attendance_date
        ):
            continue

        start_position = (
            date_match.end()
        )

        end_position = (
            date_matches[index + 1].start()
            if index + 1 < len(date_matches)
            else len(block)
        )

        date_block = block[
            start_position:end_position
        ]

        entries = re.finditer(
            r"\[\s*([^\]]+?)\s*\]"
            r"\s*=>\s*"
            r"([A-Za-z✓✔✗✘01]+)",
            date_block,
            re.IGNORECASE,
        )

        for entry in entries:
            raw_subject = entry.group(
                1
            )

            raw_status = entry.group(
                2
            )

            subject_name = (
                _safe_subject_name(
                    raw_subject
                )
            )

            if not subject_name:
                continue

            status = _normalize_status(
                raw_status
            )

            if not status:
                continue

            subject_code = subject_codes.get(
                _subject_key(
                    subject_name
                ),
                "",
            )

            records.append(
                IncomingAttendanceRecord(
                    subjectName=subject_name,
                    subjectCode=normalize_subject_code(
                        subject_code
                    ),
                    date=attendance_date,
                    status=status,
                    source="parent_portal",
                )
            )

    return records


# =========================================================
# HTML ATTENDANCE MATRIX
# =========================================================

def _parse_html_attendance_matrix(
    html: str,
) -> list[IncomingAttendanceRecord]:

    soup = BeautifulSoup(
        html,
        "html.parser",
    )

    subject_codes = _extract_subject_codes(
        soup
    )

    tables = list(
        soup.find_all("table")
    )

    for table in tables:
        if not _looks_like_attendance_table(
            table
        ):
            continue

        records = _parse_matrix_table(
            table,
            subject_codes,
        )

        if records:
            return records

    return []


def _parse_matrix_table(
    table: Tag,
    subject_codes: dict[str, str],
) -> list[IncomingAttendanceRecord]:

    records = []

    for row in table.find_all(
        "tr"
    ):
        cells = row.find_all(
            ["td", "th"],
            recursive=False,
        )

        if not cells:
            continue

        attendance_date = (
            _find_date_in_row(
                cells
            )
        )

        if not attendance_date:
            continue

        for cell in cells:
            label = cell.get(
                "data-label"
            )

            if not label:
                continue

            label = _clean_text(
                label
            )

            if label.lower() in {
                "date",
                "date \\ course",
                "date/course",
            }:
                continue

            subject_name = (
                _safe_subject_name(
                    label
                )
            )

            if not subject_name:
                continue

            status = _extract_cell_status(
                cell
            )

            if not status:
                continue

            subject_code = subject_codes.get(
                _subject_key(
                    subject_name
                ),
                "",
            )

            records.append(
                IncomingAttendanceRecord(
                    subjectName=subject_name,
                    subjectCode=normalize_subject_code(
                        subject_code
                    ),
                    date=attendance_date,
                    status=status,
                    source="parent_portal",
                )
            )

    return records


# =========================================================
# SUBJECT CODE EXTRACTION
# =========================================================

def _extract_subject_codes(
    soup: BeautifulSoup,
) -> dict[str, str]:

    result: dict[str, str] = {}

    try:
        subjects = parse_parent_portal_subjects(
            str(soup)
        )
    except Exception:
        subjects = []

    for subject in subjects:
        code = normalize_subject_code(
            _clean_text(
                subject.get(
                    "code"
                )
            )
        )

        name = _safe_subject_name(
            subject.get(
                "name"
            )
        )

        if not name:
            continue

        if not code:
            continue

        result[
            _subject_key(name)
        ] = code

    return result


# =========================================================
# PHP ARRAY ATTENDANCE
# =========================================================

def _parse_detailed_php_attendance(
    html: str,
) -> list[IncomingAttendanceRecord]:

    date_matches = list(
        DATE_BLOCK_RE.finditer(
            html
        )
    )

    if not date_matches:
        return []

    records = []

    for index, date_match in enumerate(
        date_matches
    ):
        attendance_date = date_match.group(
            1
        )

        if not _is_valid_date(
            attendance_date
        ):
            continue

        block_start = (
            date_match.end()
        )

        block_end = (
            date_matches[index + 1].start()
            if index + 1 < len(date_matches)
            else len(html)
        )

        date_block = html[
            block_start:block_end
        ]

        subject_matches = list(
            re.finditer(
                r"\[\s*([^\]]+?)\s*\]"
                r"\s*=>\s*Array\s*\(",
                date_block,
                re.IGNORECASE,
            )
        )

        for subject_index, subject_match in enumerate(
            subject_matches
        ):
            subject_name = (
                _safe_subject_name(
                    subject_match.group(
                        1
                    )
                )
            )

            if not subject_name:
                continue

            subject_start = (
                subject_match.end()
            )

            subject_end = (
                subject_matches[
                    subject_index + 1
                ].start()
                if subject_index + 1
                < len(subject_matches)
                else len(date_block)
            )

            subject_block = date_block[
                subject_start:subject_end
            ]

            statuses = re.findall(
                r"\[\s*status\s*\]"
                r"\s*=>\s*"
                r"([A-Za-z✓✔✗✘01]+)",
                subject_block,
                re.IGNORECASE,
            )

            for raw_status in statuses:
                status = _normalize_status(
                    raw_status
                )

                if not status:
                    continue

                records.append(
                    IncomingAttendanceRecord(
                        subjectName=subject_name,
                        subjectCode="",
                        date=attendance_date,
                        status=status,
                        source="parent_portal",
                    )
                )

    return records


# =========================================================
# GENERIC ROW FALLBACK
# =========================================================

def _parse_generic_rows(
    html: str,
) -> list[IncomingAttendanceRecord]:

    soup = BeautifulSoup(
        html,
        "html.parser",
    )

    records = []

    for row in soup.find_all(
        "tr"
    ):
        cells = row.find_all(
            ["td", "th"],
            recursive=False,
        )

        if len(cells) < 2:
            continue

        attendance_date = (
            _find_date_in_row(
                cells
            )
        )

        if not attendance_date:
            continue

        for cell in cells:
            status = _extract_cell_status(
                cell
            )

            if not status:
                continue

            label = cell.get(
                "data-label",
                "",
            )

            if not label:
                continue

            subject_name = (
                _safe_subject_name(
                    label
                )
            )

            if not subject_name:
                continue

            records.append(
                IncomingAttendanceRecord(
                    subjectName=subject_name,
                    subjectCode="",
                    date=attendance_date,
                    status=status,
                    source="parent_portal",
                )
            )

    return records


# =========================================================
# ATTENDANCE TABLE DETECTION
# =========================================================

def _looks_like_attendance_table(
    table: Tag,
) -> bool:

    text = _clean_text(
        table.get_text(
            " ",
            strip=True,
        )
    ).lower()

    attendance_words = (
        "attendance",
        "present",
        "absent",
    )

    word_count = sum(
        word in text
        for word in attendance_words
    )

    cells = table.find_all(
        ["td", "th"]
    )

    has_date = any(
        _extract_date(
            _clean_text(
                cell.get_text(
                    " ",
                    strip=True,
                )
            )
        )
        for cell in cells
    )

    has_status = any(
        _extract_cell_status(
            cell
        )
        for cell in cells
    )

    has_data_labels = any(
        cell.get("data-label")
        for cell in cells
    )

    if word_count >= 2:
        return True

    return (
        has_date
        and has_status
        and has_data_labels
    )


# =========================================================
# DATE FINDER
# =========================================================

def _find_date_in_row(
    cells: Iterable[Tag],
) -> str | None:

    cells = list(
        cells
    )

    for cell in cells:
        label = _clean_text(
            cell.get(
                "data-label",
                "",
            )
        ).lower()

        if label == "date":
            value = _extract_date(
                _clean_text(
                    cell.get_text(
                        " ",
                        strip=True,
                    )
                )
            )

            if value:
                return value

    for cell in cells:
        value = _extract_date(
            _clean_text(
                cell.get_text(
                    " ",
                    strip=True,
                )
            )
        )

        if value:
            return value

    return None


# =========================================================
# DATE EXTRACTION
# =========================================================

def _extract_date(
    value: str | None,
) -> str | None:

    if not value:
        return None

    value = str(value)

    for pattern in DATE_PATTERNS:
        match = pattern.search(
            value
        )

        if not match:
            continue

        candidate = match.group(
            0
        )

        normalized = _normalize_date(
            candidate
        )

        if normalized:
            return normalized

    return None


def _normalize_date(
    value: str,
) -> str | None:

    value = _clean_text(
        value
    )

    formats = (
        "%Y-%m-%d",
        "%d/%m/%Y",
        "%d-%m-%Y",
        "%d.%m.%Y",
    )

    for fmt in formats:
        try:
            parsed = datetime.strptime(
                value,
                fmt,
            )

            return parsed.date().isoformat()

        except ValueError:
            continue

    return None


def _is_valid_date(
    value: str,
) -> bool:

    try:
        date.fromisoformat(
            value
        )

        return True

    except (
        TypeError,
        ValueError,
    ):
        return False


# =========================================================
# CELL STATUS
# =========================================================

def _extract_cell_status(
    cell: Tag,
) -> str | None:

    classes = {
        str(value)
        .strip()
        .lower()
        for value in cell.get(
            "class",
            [],
        )
    }

    if any(
        "present" in value
        for value in classes
    ):
        return "PRESENT"

    if any(
        "absent" in value
        for value in classes
    ):
        return "ABSENT"

    for attribute in (
        "data-status",
        "data-attendance",
        "status",
        "aria-label",
        "title",
    ):
        value = cell.get(
            attribute
        )

        if value:
            status = _normalize_status(
                str(value)
            )

            if status:
                return status

    text = _clean_text(
        cell.get_text(
            " ",
            strip=True,
        )
    )

    return _normalize_status(
        text
    )


# =========================================================
# STATUS NORMALIZATION
# =========================================================

def _normalize_status(
    value: str | None,
) -> str | None:

    if value is None:
        return None

    value = _clean_text(
        value
    ).upper()

    if value in STATUS_PRESENT:
        return "PRESENT"

    if value in STATUS_ABSENT:
        return "ABSENT"

    # Common portal variants such as:
    # "Present (P)", "P - Present", "Absent (A)".
    if re.fullmatch(
        r"(?:PRESENT|P)\s*(?:\(P\))?",
        value,
        re.IGNORECASE,
    ):
        return "PRESENT"

    if re.fullmatch(
        r"(?:ABSENT|A)\s*(?:\(A\))?",
        value,
        re.IGNORECASE,
    ):
        return "ABSENT"

    compact = re.sub(
        r"\s+",
        "",
        value,
    )

    if compact in STATUS_PRESENT:
        return "PRESENT"

    if compact in STATUS_ABSENT:
        return "ABSENT"

    return None


# =========================================================
# SUBJECT CLEANING
# =========================================================

def _safe_subject_name(
    value: str | None,
) -> str:

    if not value:
        return ""

    value = _clean_text(
        value
    )

    if not value:
        return ""

    upper = value.upper()

    if upper in STATUS_IGNORED:
        return ""

    if _extract_date(value):
        return ""

    if _normalize_status(value):
        return ""

    if _looks_like_subject_code(
        value
    ):
        return ""

    if _is_number(value):
        return ""

    if upper in {
        "DATE",
        "DATE \\ COURSE",
        "DATE/COURSE",
        "COURSE",
        "SUBJECT",
        "SUBJECT NAME",
        "COURSE NAME",
        "COURSE CODE",
        "SUBJECT CODE",
        "ATTENDANCE",
        "STATUS",
        "PRESENT",
        "ABSENT",
        "NAME",
        "PHOTO",
        "TOTAL",
        "PERCENTAGE",
        "CREDIT",
        "CREDITS",
    }:
        return ""

    if re.match(
        r"^[\-–—|:]+\s*",
        value,
    ):
        return ""

    try:
        normalized = normalize_subject_name(
            value
        )
    except Exception:
        normalized = value

    return _clean_text(
        normalized
    )


def _subject_key(
    value: str,
) -> str:

    return re.sub(
        r"\s+",
        " ",
        _clean_text(
            value
        ).casefold(),
    )


# =========================================================
# IDENTIFIER EXTRACTION
# =========================================================

def _extract_identifiers(
    cell: Tag,
) -> list[str]:

    values = []

    spans = cell.find_all(
        "span"
    )

    for span in spans:
        value = _clean_text(
            span.get_text(
                " ",
                strip=True,
            )
        )

        if value:
            values.append(
                value
            )

    if len(values) >= 2:
        return values

    raw = _clean_text(
        cell.get_text(
            " ",
            strip=True,
        )
    )

    parts = re.split(
        r"\s*\|\s*|\s{2,}",
        raw,
    )

    return [
        part.strip()
        for part in parts
        if part.strip()
    ]


# =========================================================
# NUMBER CHECK
# =========================================================

def _is_number(
    value: str,
) -> bool:

    value = value.strip()

    if not value:
        return False

    try:
        float(
            value.replace(
                "%",
                "",
            )
        )

        return True

    except ValueError:
        return False


# =========================================================
# DEDUPLICATION
# =========================================================

def _deduplicate_records(
    records: list[
        IncomingAttendanceRecord
    ],
) -> list[
    IncomingAttendanceRecord
]:

    unique: dict[
        tuple[str, str, str],
        IncomingAttendanceRecord,
    ] = {}

    for record in records:
        subject = _clean_text(
            record.subjectName
        )

        subject_code = _clean_text(
            getattr(
                record,
                "subjectCode",
                "",
            )
            or ""
        )

        attendance_date = _clean_text(
            record.date
        )

        status = _normalize_status(
            getattr(
                record,
                "status",
                "",
            )
        )

        if (
            not subject
            or not attendance_date
            or not status
        ):
            continue

        key = (
            _subject_key(
                subject
            ),
            attendance_date,
            subject_code.casefold(),
        )

        existing = unique.get(
            key
        )

        if existing is None:
            unique[key] = record

        elif (
            getattr(
                existing,
                "status",
                "",
            )
            != "PRESENT"
            and status == "PRESENT"
        ):
            unique[key] = record

    result = list(
        unique.values()
    )

    result.sort(
        key=lambda item: (
            str(
                getattr(
                    item,
                    "date",
                    "",
                )
            ),
            str(
                getattr(
                    item,
                    "subjectName",
                    "",
                )
            ).lower(),
        )
    )

    return result


# =========================================================
# CLEAN TEXT
# =========================================================

def _clean_text(
    value: object,
) -> str:

    if value is None:
        return ""

    value = str(
        value
    ).replace(
        "\xa0",
        " ",
    )

    return re.sub(
        r"\s+",
        " ",
        value,
    ).strip()

# =========================================================
# PARENT PORTAL DEBUG SUMMARY
# =========================================================

def inspect_parent_portal_html(
    html: str,
) -> dict[str, Any]:
    """
    Return a non-sensitive parser diagnostic.

    This is intentionally parser-only: it does not expose passwords,
    cookies, or raw portal HTML.
    """
    if not html or not html.strip():
        return {
            "htmlLength": 0,
            "tables": 0,
            "subjects": [],
            "attendanceRecords": 0,
        }

    soup = BeautifulSoup(html, "html.parser")

    subjects = parse_parent_portal_subjects(html)

    try:
        records = parse_attendance_table(html)
    except ValueError:
        records = []

    return {
        "htmlLength": len(html),
        "tables": len(soup.find_all("table")),
        "subjects": subjects,
        "attendanceRecords": len(records),
        "hasAttendanceText": bool(
            re.search(
                r"\battendance\b",
                soup.get_text(" ", strip=True),
                re.IGNORECASE,
            )
        ),
        "hasSubjectText": bool(
            re.search(
                r"\b(subject|course)\b",
                soup.get_text(" ", strip=True),
                re.IGNORECASE,
            )
        ),
    }
