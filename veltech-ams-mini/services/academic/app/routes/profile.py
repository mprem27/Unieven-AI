from __future__ import annotations

import logging

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, status
from pymongo.database import Database

from app.config.database import get_db
from app.schemas.user import (
    PortalCredentialsPublic,
    PortalCredentialsUpdate,
    ProfileUpdate,
    UserPublic,
)
from app.security.permissions import get_current_user
from app.services.base import serialize_document
from app.services.user_service import UserService
from app.scheduler.attendance_sync import AttendanceSyncRunner

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/profile",
    tags=["profile"],
)


# =========================================================
# GET CURRENT USER PROFILE
# =========================================================

@router.get(
    "",
    response_model=UserPublic,
)
def get_profile(
    current_user: dict = Depends(get_current_user),
):
    return current_user


# =========================================================
# UPDATE APPLICATION PROFILE SETTINGS
# =========================================================

@router.put(
    "",
    response_model=UserPublic,
)
def update_profile(
    payload: ProfileUpdate,
    current_user: dict = Depends(get_current_user),
    db: Database = Depends(get_db),
):
    updated_user = UserService(
        db
    ).update_profile(
        current_user["id"],
        payload,
    )

    if not updated_user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User profile not found.",
        )

    return serialize_document(
        updated_user
    )


# =========================================================
# UPDATE AMS CREDENTIALS
# =========================================================

@router.put(
    "/portal-credentials",
    response_model=PortalCredentialsPublic,
)
async def update_portal_credentials(
    payload: PortalCredentialsUpdate,
    background_tasks: BackgroundTasks,
    current_user: dict = Depends(get_current_user),
    db: Database = Depends(get_db),
):
    if current_user.get('role') != 'student':
        raise HTTPException(403, 'Student account required for AMS credentials.')
    # Saving is local only. Official authentication needs a fresh manual challenge.
    return await UserService(db).update_portal_credentials(current_user['id'], payload)


# =========================================================
# GET AMS CREDENTIAL STATUS
# =========================================================

@router.get(
    "/portal-credentials",
    response_model=PortalCredentialsPublic,
)
def get_portal_credentials(
    current_user: dict = Depends(get_current_user),
    db: Database = Depends(get_db),
):
    result = UserService(
        db
    ).get_portal_credentials_status(
        current_user["id"]
    )

    if not result:
        return {
            "configured": False,
            "portalUsername": None,
        }

    return result