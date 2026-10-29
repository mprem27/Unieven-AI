from __future__ import annotations

from typing import Any

from bson import ObjectId
from fastapi import Depends, HTTPException, status
from fastapi.security import (
    HTTPAuthorizationCredentials,
    HTTPBearer,
)
from pymongo.database import Database

from app.config.database import get_db
from app.models.user import USERS
from app.security.jwt import decode_access_token
from app.services.base import serialize_document


# =========================================================
# HTTP BEARER
# =========================================================

bearer_scheme = HTTPBearer(
    auto_error=False
)


# =========================================================
# CURRENT USER
# =========================================================

def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(
        bearer_scheme
    ),
    db: Database = Depends(get_db),
) -> dict[str, Any]:

    # -----------------------------------------------------
    # Authorization header missing
    # -----------------------------------------------------

    if credentials is None:

        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required",
        )

    # -----------------------------------------------------
    # Decode JWT
    # -----------------------------------------------------

    token = credentials.credentials

    payload = decode_access_token(
        token
    )

    if not payload:

        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
        )

    # -----------------------------------------------------
    # Get user ID from token
    # -----------------------------------------------------

    user_id = payload.get(
        "sub"
    )

    if not user_id:

        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication token",
        )

    # -----------------------------------------------------
    # Convert ObjectId
    # -----------------------------------------------------

    try:

        object_id = ObjectId(
            user_id
        )

    except Exception as exc:

        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid user ID in token",
        ) from exc

    # -----------------------------------------------------
    # Find active user
    # -----------------------------------------------------

    user = db[
        USERS
    ].find_one(
        {
            "_id": object_id,
            "active": True,
        }
    )

    if not user:

        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found or inactive",
        )

    # -----------------------------------------------------
    # Serialize MongoDB document
    # -----------------------------------------------------

    serialized = serialize_document(
        user
    )

    if not serialized:

        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Unable to load user",
        )

    return serialized


# =========================================================
# ADMIN CHECK
# =========================================================

def require_admin(
    current_user: dict[str, Any] = Depends(
        get_current_user
    ),
) -> dict[str, Any]:

    if current_user.get(
        "role"
    ) != "admin":

        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required",
        )

    return current_user


# =========================================================
# STUDENT CHECK
# =========================================================

def require_student(
    current_user: dict[str, Any] = Depends(
        get_current_user
    ),
) -> dict[str, Any]:

    if current_user.get(
        "role"
    ) != "student":

        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Student access required",
        )

    return current_user