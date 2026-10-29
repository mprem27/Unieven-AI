from app.utils.validators import normalize_attendance_status


def normalize_subject_name(value: str) -> str:
    return " ".join(value.strip().split())


def normalize_subject_code(value: str | None) -> str | None:
    if not value:
        return None
    return value.strip().upper()


def normalize_status(value: str) -> str:
    return normalize_attendance_status(value)
