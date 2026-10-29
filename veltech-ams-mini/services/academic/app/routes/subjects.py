from fastapi import APIRouter, Depends
from pymongo.database import Database

from app.config.database import get_db
from app.models.subject import SUBJECTS
from app.security.permissions import require_student
from app.services.base import serialize_document


router = APIRouter(
    prefix="/subjects",
    tags=["subjects"],
)


# =========================================================
# STUDENT SUBJECTS
# =========================================================


@router.get("")
def list_subjects(
    _current_user: dict = Depends(
        require_student
    ),
    db: Database = Depends(get_db),
):
    subjects = (
        db[SUBJECTS]
        .find(
            {
                "active": True,
                "$or": [
                    {"studentId": str(_current_user["id"])},
                    {"studentId": {"$exists": False}},
                    {"studentId": None},
                ],
            }
        )
        .sort(
            "name",
            1,
        )
    )

    # A student's own course overrides a legacy catalog row with that code.
    # Different students' courses are excluded by the database query above.
    selected = {}
    for subject in subjects:
        key = ("code", str(subject["code"]).strip().upper()) if subject.get("code") else ("name", subject["name"].strip().casefold())
        if key not in selected or subject.get("studentId") == str(_current_user["id"]):
            selected[key] = subject
    return [serialize_document(subject) for subject in sorted(selected.values(), key=lambda s: s["name"].casefold())]
