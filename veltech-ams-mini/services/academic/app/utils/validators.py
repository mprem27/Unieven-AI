from fastapi import HTTPException, status


VALID_ATTENDANCE_STATUSES = {"PRESENT", "ABSENT"}


def normalize_attendance_status(value: str) -> str:
    cleaned = value.strip().upper()
    mapping = {
        "P": "PRESENT",
        "A": "ABSENT",
        "PRESENT": "PRESENT",
        "ABSENT": "ABSENT",
        "ATTENDED": "PRESENT",
        "NOT PRESENT": "ABSENT",
    }
    if cleaned not in mapping:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Unsupported attendance status: {value}",
        )
    return mapping[cleaned]


def require_student_role(role: str) -> None:
    if role not in {"student", "admin"}:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Role must be student or admin",
        )
