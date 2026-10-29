from fastapi import APIRouter, Depends, HTTPException
from pymongo.database import Database

from app.config.database import get_db
from app.schemas.notification import (
    MarkReadResponse,
    NotificationPublic,
    PushNotificationStatus,
    PushPreferencesUpdate,
    PushSubscriptionCreate,
    PushSubscriptionResponse,
)
from app.security.permissions import get_current_user
from app.services.notification_service import NotificationService
from app.services.push_notification_service import (
    PushNotificationService,
)


router = APIRouter(
    prefix="/notifications",
    tags=["notifications"],
)


@router.get(
    "",
    response_model=list[NotificationPublic],
)
def list_notifications(
    current_user: dict = Depends(
        get_current_user
    ),
    db: Database = Depends(get_db),
):
    return NotificationService(
        db
    ).list_notifications(
        current_user["id"]
    )


@router.get(
    "/unread-count",
)
def unread_notification_count(
    current_user: dict = Depends(
        get_current_user
    ),
    db: Database = Depends(get_db),
):
    count = NotificationService(
        db
    ).get_unread_count(
        current_user["id"]
    )

    return {
        "success": True,
        "count": count,
    }


@router.patch(
    "/read-all",
)
def mark_all_read(
    current_user: dict = Depends(
        get_current_user
    ),
    db: Database = Depends(get_db),
):
    modified_count = NotificationService(
        db
    ).mark_all_read(
        current_user["id"]
    )

    return {
        "success": True,
        "message": (
            "All notifications marked as read."
        ),
        "modified": modified_count,
    }


@router.post(
    "/subscribe",
    response_model=PushSubscriptionResponse,
)
def subscribe_push(
    payload: PushSubscriptionCreate,
    current_user: dict = Depends(
        get_current_user
    ),
    db: Database = Depends(get_db),
):
    return PushNotificationService(
        db
    ).subscribe(
        current_user["id"],
        payload,
    )


@router.delete(
    "/unsubscribe",
    response_model=PushSubscriptionResponse,
)
def unsubscribe_push(
    payload: dict,
    current_user: dict = Depends(
        get_current_user
    ),
    db: Database = Depends(get_db),
):
    endpoint = str(
        payload.get("endpoint") or ""
    ).strip()

    if not endpoint:
        raise HTTPException(
            status_code=400,
            detail="Push endpoint is required.",
        )

    return PushNotificationService(
        db
    ).unsubscribe(
        current_user["id"],
        endpoint,
    )


@router.get(
    "/status",
    response_model=PushNotificationStatus,
)
def push_status(
    current_user: dict = Depends(
        get_current_user
    ),
    db: Database = Depends(get_db),
):
    return PushNotificationService(
        db
    ).get_status(
        current_user["id"]
    )


@router.patch('/push/preferences', response_model=PushSubscriptionResponse)
def update_push_preferences(
    payload: PushPreferencesUpdate,
    current_user: dict = Depends(get_current_user),
    db: Database = Depends(get_db),
):
    return PushNotificationService(db).update_preferences(current_user['id'], payload)


@router.post(
    "/test",
)
def test_push(
    current_user: dict = Depends(
        get_current_user
    ),
    db: Database = Depends(get_db),
):
    return PushNotificationService(
        db
    ).send_test(
        current_user["id"]
    )


@router.patch(
    "/{notification_id}/read",
    response_model=MarkReadResponse,
)
def mark_read(
    notification_id: str,
    current_user: dict = Depends(
        get_current_user
    ),
    db: Database = Depends(get_db),
):
    result = NotificationService(
        db
    ).mark_read(
        notification_id,
        current_user["id"],
    )

    if not result:
        raise HTTPException(
            status_code=404,
            detail="Notification not found.",
        )

    return result


@router.delete(
    "/{notification_id}",
)
def delete_notification(
    notification_id: str,
    current_user: dict = Depends(
        get_current_user
    ),
    db: Database = Depends(get_db),
):
    deleted = NotificationService(
        db
    ).delete_notification(
        notification_id,
        current_user["id"],
    )

    if not deleted:
        raise HTTPException(
            status_code=404,
            detail="Notification not found.",
        )

    return {
        "success": True,
        "message": (
            "Notification deleted successfully."
        ),
    }
