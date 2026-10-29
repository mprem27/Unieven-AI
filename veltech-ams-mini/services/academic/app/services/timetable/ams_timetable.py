from __future__ import annotations

import re
from typing import Any

from bs4 import BeautifulSoup


# =========================================================
# AMS TIMETABLE PARSER
# =========================================================

DAYS = {
    "monday": "Monday",
    "tuesday": "Tuesday",
    "wednesday": "Wednesday",
    "thursday": "Thursday",
    "friday": "Friday",
    "saturday": "Saturday",
    "sunday": "Sunday",
}


# =========================================================
# COMMON HELPERS
# =========================================================


def _clean_text(
    value: str | None,
) -> str:
    if not value:
        return ""

    return " ".join(
        str(value).split()
    )


def _normalise_header(
    value: str,
) -> str:
    return (
        _clean_text(value)
        .lower()
        .replace(" ", "")
        .replace("_", "")
        .replace("-", "")
        .replace(".", "")
        .replace(":", "")
        .replace("/", "")
    )


def _find_column(
    headers: list[str],
    names: set[str],
) -> int | None:
    normalised_names = {
        _normalise_header(name)
        for name in names
    }

    for index, header in enumerate(headers):
        normalised = _normalise_header(
            header
        )

        if normalised in normalised_names:
            return index

    return None


def _extract_cell(
    row: list[str],
    index: int | None,
) -> str | None:
    if index is None:
        return None

    if index < 0 or index >= len(row):
        return None

    value = _clean_text(
        row[index]
    )

    return value or None


def _detect_day(
    value: str,
) -> str | None:
    normalised = (
        _clean_text(value)
        .lower()
    )

    for key, display_name in DAYS.items():
        if key in normalised:
            return display_name

    return None


def _is_day(
    value: str,
) -> bool:
    normalised = (
        _clean_text(value)
        .lower()
    )

    return normalised in DAYS


def _parse_number(
    value: str | None,
) -> int | float | str | None:
    if not value:
        return None

    value = _clean_text(value)

    try:
        if "." in value:
            return float(value)

        return int(value)

    except ValueError:
        return value


def _element_text(
    soup: BeautifulSoup,
    element_id: str,
) -> str | None:
    element = soup.find(
        id=element_id
    )

    if element is None:
        return None

    value = element.get("value")

    if value:
        return _clean_text(
            str(value)
        )

    text = _clean_text(
        element.get_text(
            " ",
            strip=True,
        )
    )

    return text or None


def _first_element_text(
    soup: BeautifulSoup,
    ids: list[str],
) -> str | None:
    for element_id in ids:
        value = _element_text(
            soup,
            element_id,
        )

        if value:
            return value

    return None


# =========================================================
# STUDENT PROFILE
# =========================================================


def _parse_student_profile(
    soup: BeautifulSoup,
) -> dict[str, Any]:
    profile = {
        "idNumber": _first_element_text(
            soup,
            [
                "MainContent_lblID",
                "MainContent_lblId",
                "MainContent_lblIDNumber",
            ],
        ),
        "name": _first_element_text(
            soup,
            [
                "MainContent_lblName",
                "MainContent_lblStuname",
                "MainContent_lblStudentName",
            ],
        ),
        "rollNumber": _first_element_text(
            soup,
            [
                "MainContent_lblrollno",
                "MainContent_lblRollNo",
                "MainContent_lblRollNumber",
            ],
        ),
        "degree": _first_element_text(
            soup,
            [
                "MainContent_lblDegree",
            ],
        ),
        "branch": _first_element_text(
            soup,
            [
                "MainContent_lblBranch",
            ],
        ),
        "batch": _first_element_text(
            soup,
            [
                "MainContent_lblbatch",
                "MainContent_lblBatch",
            ],
        ),
        "semester": _first_element_text(
            soup,
            [
                "MainContent_lblSemester",
            ],
        ),
        "regulation": _first_element_text(
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


def _parse_bucket(
    soup: BeautifulSoup,
) -> str | None:
    element = soup.find(
        id="MainContent_TextBox1"
    )

    if element is not None:
        value = element.get(
            "value"
        )

        if value:
            return _clean_text(
                str(value)
            )

        text = _clean_text(
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

    if label is not None:
        parent = label.parent

        if parent is not None:
            text = _clean_text(
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
                value = _clean_text(
                    match.group(1)
                )

                if value:
                    return value

    for element in soup.find_all(
        [
            "input",
            "span",
            "label",
            "td",
        ]
    ):
        text = _clean_text(
            element.get_text(
                " ",
                strip=True,
            )
        )

        if not text:
            continue

        if "bucket" not in text.lower():
            continue

        parent = element.parent

        if parent is None:
            continue

        parent_text = _clean_text(
            parent.get_text(
                " ",
                strip=True,
            )
        )

        match = re.search(
            r"bucket\s*:?\s*([A-Za-z0-9_-]+)",
            parent_text,
            flags=re.IGNORECASE,
        )

        if match:
            return match.group(1)

    return None


# =========================================================
# COURSE REGISTERED DETAILS
# =========================================================


def _find_course_table(
    soup: BeautifulSoup,
):
    table = soup.find(
        id="MainContent_GridView3"
    )

    if table is not None:
        return table

    for candidate in soup.find_all(
        "table"
    ):
        text = _clean_text(
            candidate.get_text(
                " ",
                strip=True,
            )
        ).lower()

        if (
            "course code" in text
            and "course name" in text
            and "faculty" in text
        ):
            return candidate

    return None


def _parse_registered_courses(
    soup: BeautifulSoup,
) -> list[dict[str, Any]]:
    table = _find_course_table(
        soup
    )

    if table is None:
        return []

    rows = table.find_all(
        "tr"
    )

    if not rows:
        return []

    header_index = None
    headers: list[str] = []

    for index, row in enumerate(rows):
        cells = row.find_all(
            ["th", "td"]
        )

        values = [
            _clean_text(
                cell.get_text(
                    " ",
                    strip=True,
                )
            )
            for cell in cells
        ]

        normalized = [
            _normalise_header(
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

    sno_index = _find_column(
        headers,
        {
            "sno",
            "serialno",
            "serialnumber",
        },
    )

    category_index = _find_column(
        headers,
        {
            "category",
        },
    )

    course_code_index = _find_column(
        headers,
        {
            "coursecode",
            "code",
        },
    )

    course_name_index = _find_column(
        headers,
        {
            "coursename",
            "subjectname",
            "subject",
        },
    )

    credit_index = _find_column(
        headers,
        {
            "credit",
            "credits",
        },
    )

    faculty_name_index = _find_column(
        headers,
        {
            "facultyname",
            "faculty",
            "teacher",
            "staff",
        },
    )

    faculty_id_index = _find_column(
        headers,
        {
            "facultyid",
            "staffid",
            "teacherid",
        },
    )

    slot_index = _find_column(
        headers,
        {
            "slot",
        },
    )

    room_index = _find_column(
        headers,
        {
            "room",
            "roomno",
            "roomnumber",
            "classroom",
        },
    )

    courses: list[
        dict[str, Any]
    ] = []

    for row in rows[
        header_index + 1:
    ]:
        cells = row.find_all(
            ["th", "td"]
        )

        if not cells:
            continue

        values = [
            _clean_text(
                cell.get_text(
                    " ",
                    strip=True,
                )
            )
            for cell in cells
        ]

        if not any(values):
            continue

        course = {
            "sno": _extract_cell(
                values,
                sno_index,
            ),
            "category": _extract_cell(
                values,
                category_index,
            ),
            "courseCode": _extract_cell(
                values,
                course_code_index,
            ),
            "courseName": _extract_cell(
                values,
                course_name_index,
            ),
            "credit": _parse_number(
                _extract_cell(
                    values,
                    credit_index,
                )
            ),
            "facultyName": _extract_cell(
                values,
                faculty_name_index,
            ),
            "facultyId": _extract_cell(
                values,
                faculty_id_index,
            ),
            "slot": _extract_cell(
                values,
                slot_index,
            ),
            "room": _extract_cell(
                values,
                room_index,
            ),
        }

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

    return courses


# =========================================================
# TIME SLOT HELPERS
# =========================================================


def _normalise_time_slot(
    value: str,
) -> str:
    value = _clean_text(
        value
    )

    value = re.sub(
        r"\s*-\s*",
        "-",
        value,
    )

    value = re.sub(
        r"\s+",
        " ",
        value,
    )

    return value


def _convert_dot_time(
    value: str,
) -> str:
    """
    Convert:

        8.45 -> 8:45
        9.35 -> 9:35

    while leaving normal decimal values untouched.
    """

    value = _clean_text(
        value
    )

    match = re.fullmatch(
        r"(\d{1,2})\.(\d{2})",
        value,
    )

    if not match:
        return value

    hour = match.group(1)
    minute = match.group(2)

    return f"{hour}:{minute}"


def _extract_time_parts(
    value: str,
) -> tuple[
    str | None,
    str | None,
]:
    """
    Extract the numeric hour/minute and AM/PM
    from one time component.
    """

    value = _clean_text(
        value
    )

    match = re.search(
        r"(\d{1,2})(?:[:.](\d{2}))?\s*(AM|PM)?",
        value,
        flags=re.IGNORECASE,
    )

    if not match:
        return None, None

    hour = match.group(1)
    minute = match.group(2) or "00"
    meridiem = match.group(3)

    return (
        f"{hour}:{minute}",
        meridiem.upper()
        if meridiem
        else None,
    )


def _time_to_minutes(
    value: str | None,
    meridiem: str | None = None,
) -> int | None:
    """
    Convert a time into minutes after midnight.

    This is the value used for chronological sorting.

    Examples:

        8:45 AM  -> 525
        9:35 AM  -> 575
        1:45 PM  -> 825
        6:00 PM  -> 1080
    """

    if not value:
        return None

    value = _clean_text(
        value
    )

    numeric_time, detected_meridiem = (
        _extract_time_parts(
            value
        )
    )

    if not numeric_time:
        return None

    meridiem = (
        meridiem
        or detected_meridiem
    )

    match = re.fullmatch(
        r"(\d{1,2}):(\d{2})",
        numeric_time,
    )

    if not match:
        return None

    hour = int(
        match.group(1)
    )

    minute = int(
        match.group(2)
    )

    if meridiem:
        if meridiem == "AM":
            if hour == 12:
                hour = 0

        elif meridiem == "PM":
            if hour != 12:
                hour += 12

    return (
        hour * 60
        + minute
    )


def _split_time_slot(
    value: str,
) -> tuple[
    str | None,
    str | None,
]:
    """
    Split an AMS time slot.

    Examples:

        8.45-9.35 AM
        9.45-10.35 AM
        1.45-2.35 PM
        2.45-3.35 PM
    """

    value = _normalise_time_slot(
        value
    )

    if not value:
        return None, None

    match = re.match(
        r"^(.*?)\s*-\s*(.*?)$",
        value,
    )

    if not match:
        return value, None

    start_raw = _clean_text(
        match.group(1)
    )

    end_raw = _clean_text(
        match.group(2)
    )

    # -----------------------------------------------------
    # AMS often puts AM/PM only at the END.
    #
    # Example:
    #
    # 1.45-2.35 PM
    #
    # Both times must therefore be PM.
    # -----------------------------------------------------

    end_meridiem_match = re.search(
        r"\b(AM|PM)\b",
        end_raw,
        flags=re.IGNORECASE,
    )

    start_meridiem_match = re.search(
        r"\b(AM|PM)\b",
        start_raw,
        flags=re.IGNORECASE,
    )

    meridiem = None

    if end_meridiem_match:
        meridiem = (
            end_meridiem_match.group(1)
            .upper()
        )

    elif start_meridiem_match:
        meridiem = (
            start_meridiem_match.group(1)
            .upper()
        )

    start_number, _ = _extract_time_parts(
        start_raw
    )

    end_number, _ = _extract_time_parts(
        end_raw
    )

    if not start_number:
        start_number = _convert_dot_time(
            start_raw
        )

    if not end_number:
        end_number = _convert_dot_time(
            end_raw
        )

    start_time = (
        f"{start_number} {meridiem}"
        if start_number and meridiem
        else start_number
    )

    end_time = (
        f"{end_number} {meridiem}"
        if end_number and meridiem
        else end_number
    )

    return (
        start_time,
        end_time,
    )


def _time_slot_sort_key(
    slot: str,
) -> int:
    """
    Return a chronological sort value for an AMS slot.
    """

    start_time, _ = _split_time_slot(
        slot
    )

    if not start_time:
        return 9999

    minutes = _time_to_minutes(
        start_time
    )

    if minutes is None:
        return 9999

    return minutes


# =========================================================
# FIND TIMETABLE GRID
# =========================================================


def _find_timetable_grid(
    soup: BeautifulSoup,
):
    table = soup.find(
        id="MainContent_GridTimetable"
    )

    if table is not None:
        return table

    for candidate in soup.find_all(
        "table"
    ):
        rows = candidate.find_all(
            "tr"
        )

        if not rows:
            continue

        table_text = _clean_text(
            candidate.get_text(
                " ",
                strip=True,
            )
        ).lower()

        day_count = sum(
            1
            for day in DAYS
            if day in table_text
        )

        if day_count >= 3:
            return candidate

    return None


# =========================================================
# MATCH COURSE DETAILS
# =========================================================


def _find_matching_course(
    subject_text: str,
    courses: list[
        dict[str, Any]
    ],
) -> dict[str, Any] | None:

    if not subject_text:
        return None

    subject_normalized = (
        _clean_text(
            subject_text
        )
        .lower()
    )

    for course in courses:

        course_name = _clean_text(
            str(
                course.get(
                    "courseName"
                )
                or ""
            )
        ).lower()

        course_code = _clean_text(
            str(
                course.get(
                    "courseCode"
                )
                or ""
            )
        ).lower()

        if (
            course_name
            and (
                course_name
                in subject_normalized
                or subject_normalized
                in course_name
            )
        ):
            return course

        if (
            course_code
            and course_code
            in subject_normalized
        ):
            return course

    return None


# =========================================================
# PARSE TIMETABLE GRID
# =========================================================


def _parse_timetable_grid(
    soup: BeautifulSoup,
    courses: list[
        dict[str, Any]
    ] | None = None,
) -> list[dict[str, Any]]:

    table = _find_timetable_grid(
        soup
    )

    if table is None:
        return []

    courses = courses or []

    rows = table.find_all(
        "tr"
    )

    if not rows:
        return []

    # =====================================================
    # FIND THE ACTUAL TIME HEADER ROW
    # =====================================================

    header_row_index = None
    time_slots: list[str] = []

    for index, row in enumerate(rows):

        cells = row.find_all(
            ["th", "td"]
        )

        values = [
            _clean_text(
                cell.get_text(
                    " ",
                    strip=True,
                )
            )
            for cell in cells
        ]

        if len(values) < 2:
            continue

        time_candidates = []

        for value in values[1:]:
            if re.search(
                r"\d{1,2}(?:[:.]\d{2})?.*-\s*\d{1,2}(?:[:.]\d{2})?",
                value,
                flags=re.IGNORECASE,
            ):
                time_candidates.append(
                    value
                )

        first_column = (
            values[0].lower()
            if values
            else ""
        )

        has_lecture_header = (
            "lecture" in first_column
            or "day" == first_column
            or "weekday" == first_column
        )

        if (
            has_lecture_header
            and time_candidates
        ) or len(
            time_candidates
        ) >= 2:

            header_row_index = index

            time_slots = [
                _normalise_time_slot(
                    value
                )
                for value in values[1:]
            ]

            break

    if (
        header_row_index is None
        or not time_slots
    ):
        return []

    # =====================================================
    # BUILD SLOT INFORMATION
    # =====================================================

    slot_information: list[
        dict[str, Any]
    ] = []

    for column_index, slot in enumerate(
        time_slots
    ):

        start_time, end_time = (
            _split_time_slot(
                slot
            )
        )

        start_minutes = (
            _time_to_minutes(
                start_time
            )
        )

        end_minutes = (
            _time_to_minutes(
                end_time
            )
        )

        slot_information.append(
            {
                "columnIndex": column_index,
                "slot": slot,
                "startTime": start_time,
                "endTime": end_time,
                "startMinutes": (
                    start_minutes
                    if start_minutes is not None
                    else 9999
                ),
                "endMinutes": (
                    end_minutes
                    if end_minutes is not None
                    else 9999
                ),
            }
        )

    # =====================================================
    # SORT SLOT INFORMATION CHRONOLOGICALLY
    # =====================================================

    slot_information.sort(
        key=lambda item: (
            item["startMinutes"],
            item["endMinutes"],
        )
    )

    records: list[
        dict[str, Any]
    ] = []

    # =====================================================
    # PARSE EVERY DAY
    # =====================================================

    for row in rows[
        header_row_index + 1 :
    ]:

        cells = row.find_all(
            ["td", "th"]
        )

        if not cells:
            continue

        values = [
            _clean_text(
                cell.get_text(
                    " ",
                    strip=True,
                )
            )
            for cell in cells
        ]

        if not values:
            continue

        day = _detect_day(
            values[0]
        )

        if not day:
            continue

        # -------------------------------------------------
        # IMPORTANT:
        #
        # We map using the ORIGINAL HTML COLUMN INDEX.
        #
        # We do NOT rearrange the cell itself.
        #
        # This prevents Monday 1:45 PM from being
        # accidentally displayed in the 8:45 AM column.
        # -------------------------------------------------

        for slot_info in slot_information:

            original_column = (
                slot_info[
                    "columnIndex"
                ]
            )

            cell_index = (
                original_column + 1
            )

            if cell_index >= len(cells):
                continue

            cell = cells[
                cell_index
            ]

            subject_text = _clean_text(
                cell.get_text(
                    " ",
                    strip=True,
                )
            )

            if not subject_text:
                continue

            if subject_text.lower() in {
                "-",
                "--",
                "—",
                "free",
                "free hour",
                "none",
                "nil",
            }:
                continue

            matched_course = (
                _find_matching_course(
                    subject_text,
                    courses,
                )
            )

            record = {
                "day": day,

                # Exact AMS slot.
                "slot": slot_info[
                    "slot"
                ],

                # Correct chronological time.
                "startTime": slot_info[
                    "startTime"
                ],

                "endTime": slot_info[
                    "endTime"
                ],

                # Numeric values make frontend
                # chronological sorting reliable.
                "startMinutes": slot_info[
                    "startMinutes"
                ],

                "endMinutes": slot_info[
                    "endMinutes"
                ],

                "subjectName": subject_text,

                "courseName": (
                    subject_text
                ),

                "subjectCode": (
                    matched_course.get(
                        "courseCode"
                    )
                    if matched_course
                    else None
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

                "room": (
                    matched_course.get(
                        "room"
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

    # =====================================================
    # FINAL CHRONOLOGICAL SORT
    # =====================================================

    day_order = {
        "Monday": 1,
        "Tuesday": 2,
        "Wednesday": 3,
        "Thursday": 4,
        "Friday": 5,
        "Saturday": 6,
        "Sunday": 7,
    }

    records.sort(
        key=lambda record: (
            day_order.get(
                record.get("day"),
                99,
            ),
            record.get(
                "startMinutes",
                9999,
            ),
            record.get(
                "endMinutes",
                9999,
            ),
        )
    )

    return records


# =========================================================
# COMPLETE AMS DETAILS
# =========================================================


def parse_ams_timetable_details(
    html: str,
) -> dict[str, Any]:
    """
    Parse the complete AMS TimeTable.aspx page.

    Returns:

        profile
        bucket
        courses
        timetable
    """

    if not html:
        return {
            "profile": {},
            "bucket": None,
            "courses": [],
            "timetable": [],
        }

    soup = BeautifulSoup(
        html,
        "html.parser",
    )

    # =====================================================
    # 1. STUDENT PROFILE
    # =====================================================

    profile = _parse_student_profile(
        soup
    )

    # =====================================================
    # 2. BUCKET
    # =====================================================

    bucket = _parse_bucket(
        soup
    )

    # =====================================================
    # 3. REGISTERED COURSES
    # =====================================================

    courses = _parse_registered_courses(
        soup
    )

    # =====================================================
    # 4. TIMETABLE
    # =====================================================

    timetable = _parse_timetable_grid(
        soup,
        courses=courses,
    )

    return {
        "profile": profile,
        "bucket": bucket,
        "courses": courses,
        "timetable": timetable,
    }


# =========================================================
# BACKWARD COMPATIBILITY
# =========================================================


def parse_ams_timetable(
    html: str,
) -> list[dict[str, Any]]:
    """
    Existing code can continue using:

        parse_ams_timetable(html)

    It returns only the timetable records.
    """

    details = (
        parse_ams_timetable_details(
            html
        )
    )

    return details[
        "timetable"
    ]