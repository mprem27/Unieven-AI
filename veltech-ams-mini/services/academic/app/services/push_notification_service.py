import base64
import ipaddress
import socket
from urllib.parse import urlsplit
import requests
import logging
import os
from datetime import datetime, timezone
from zoneinfo import ZoneInfo

from bson import ObjectId
from fastapi import HTTPException
from pymongo.database import Database
from pywebpush import WebPushException, webpush

from app.models.push_subscription import PUSH_SUBSCRIPTIONS
from app.schemas.notification import PushPreferencesUpdate, PushSubscriptionCreate
from app.utils.dates import utc_now


logger = logging.getLogger(__name__)


def push_is_silent(preferences, now=None):
    preferences = preferences or {}
    if preferences.get('silent') or preferences.get('soundEnabled') is not True:
        return True
    if not preferences.get('quietHoursEnabled'):
        return False
    try:
        local = (now or datetime.now(timezone.utc)).astimezone(ZoneInfo(preferences.get('timeZone', 'Asia/Kolkata')))
        current = local.strftime('%H:%M')
        start, end = preferences.get('quietHoursStart', '22:00'), preferences.get('quietHoursEnd', '07:00')
        if start == end:
            return True
        return start <= current < end if start < end else current >= start or current < end
    except (ValueError, KeyError, TypeError):
        return True


def validate_subscription(endpoint,p256dh,auth):
    try:
        parts=urlsplit(endpoint)
        host=parts.hostname or ''
        allowed=(host in {'fcm.googleapis.com','updates.push.services.mozilla.com','web.push.apple.com'} or host.endswith('.notify.windows.com') or host.endswith('.push.apple.com'))
        if parts.scheme!='https' or not allowed or parts.port not in (None,443) or parts.username or parts.password or len(endpoint)>4096 or '\\' in endpoint:raise ValueError()
        key=base64.urlsafe_b64decode(p256dh+'='*(-len(p256dh)%4));secret=base64.urlsafe_b64decode(auth+'='*(-len(auth)%4))
        if len(p256dh)>100 or len(auth)>32 or len(key)!=65 or key[0]!=4 or len(secret)!=16:raise ValueError()
        addresses=socket.getaddrinfo(host,443,type=socket.SOCK_STREAM)
        if not addresses or any(not ipaddress.ip_address(item[4][0]).is_global for item in addresses):raise ValueError()
    except Exception:raise HTTPException(400,'Use a valid browser push subscription from a supported public push service.')

class NoRedirectSession(requests.Session):
    def request(self,*args,**kwargs):
        kwargs['allow_redirects']=False
        return super().request(*args,**kwargs)


class PushNotificationService:

    def __init__(self, db: Database):
        self.db = db

        self.vapid_public_key = (
            os.getenv("VAPID_PUBLIC_KEY")
            or ""
        ).strip()

        self.vapid_private_key = (
            os.getenv("VAPID_PRIVATE_KEY")
            or ""
        ).strip()

        self.vapid_subject = (
            os.getenv("VAPID_SUBJECT")
            or ""
        ).strip()

    # =====================================================
    # CHECK CONFIGURATION
    # =====================================================

    def is_configured(self) -> bool:
        return bool(
            self.vapid_public_key
            and self.vapid_private_key
            and self.vapid_subject
        )

    # =====================================================
    # SAVE SUBSCRIPTION
    # =====================================================

    def subscribe(
        self,
        user_id: str,
        payload: PushSubscriptionCreate,
    ) -> dict:

        endpoint = (
            payload.endpoint.strip()
        )

        p256dh = (
            payload.keys.p256dh.strip()
        )

        auth = (
            payload.keys.auth.strip()
        )

        if not endpoint:
            raise HTTPException(
                status_code=400,
                detail="Push endpoint is required.",
            )

        if not p256dh or not auth:
            raise HTTPException(
                status_code=400,
                detail="Push subscription keys are required.",
            )

        if not self.is_configured():
            raise HTTPException(status_code=503, detail='Web Push provider keys are not configured. In-app notifications remain available.')

        validate_subscription(endpoint,p256dh,auth)
        now = utc_now()
        preferences = payload.preferences.model_dump() if payload.preferences else None

        # One browser endpoint must not keep receiving a previous account's private updates.
        self.db[PUSH_SUBSCRIPTIONS].update_many({'endpoint':endpoint,'userId':{'$ne':user_id}},{'$set':{'enabled':False,'updatedAt':now}})

        existing = self.db[
            PUSH_SUBSCRIPTIONS
        ].find_one(
            {
                "userId": user_id,
                "endpoint": endpoint,
            }
        )

        if existing:

            self.db[
                PUSH_SUBSCRIPTIONS
            ].update_one(
                {
                    "_id": existing["_id"],
                },
                {
                    "$set": {
                        "p256dh": p256dh,
                        "auth": auth,
                        "enabled": True,
                        "updatedAt": now,
                        **({'preferences': preferences} if preferences is not None else {}),
                    }
                },
            )

            return {
                "success": True,
                "message": (
                    "Push notifications enabled."
                ),
            }

        self.db[
            PUSH_SUBSCRIPTIONS
        ].insert_one(
            {
                "userId": user_id,
                "endpoint": endpoint,
                "p256dh": p256dh,
                "auth": auth,
                "enabled": True,
                "createdAt": now,
                "updatedAt": now,
                'preferences': preferences or {},
            }
        )

        return {
            "success": True,
            "message": (
                "Push notifications enabled."
            ),
        }

    # =====================================================
    # UNSUBSCRIBE
    # =====================================================

    def unsubscribe(
        self,
        user_id: str,
        endpoint: str,
    ) -> dict:

        endpoint = (
            str(endpoint or "")
            .strip()
        )

        if not endpoint:
            raise HTTPException(
                status_code=400,
                detail="Push endpoint is required.",
            )

        result = self.db[
            PUSH_SUBSCRIPTIONS
        ].update_one(
            {
                "userId": user_id,
                "endpoint": endpoint,
            },
            {
                "$set": {
                    "enabled": False,
                    "updatedAt": utc_now(),
                }
            },
        )

        return {
            "success": True,
            "message": (
                "Push notifications disabled."
            ),
        }

    # =====================================================
    # STATUS
    # =====================================================

    def update_preferences(self, user_id: str, payload: PushPreferencesUpdate) -> dict:
        """Change an existing device subscription without enabling or creating it."""
        endpoint = payload.endpoint.strip()
        result = self.db[PUSH_SUBSCRIPTIONS].update_one(
            {'userId': user_id, 'endpoint': endpoint, 'enabled': True},
            {'$set': {'preferences': payload.preferences.model_dump(), 'updatedAt': utc_now()}},
        )
        if not result.matched_count:
            raise HTTPException(status_code=404, detail='Active push subscription not found.')
        return {'success': True, 'message': 'Push notification preferences saved.'}

    def get_status(
        self,
        user_id: str,
    ) -> dict:

        count = self.db[
            PUSH_SUBSCRIPTIONS
        ].count_documents(
            {
                "userId": user_id,
                "enabled": True,
            }
        )

        configured = self.is_configured()
        return {
            "success": True,
            "enabled": configured and count > 0,
            "subscriptions": count,
            "configured": configured,
            "publicKey": self.vapid_public_key if configured else None,
            'provider': 'web_push',
            'deliveryStatus': 'ready' if configured and count else 'no_subscription' if configured else 'not_configured',
            'reason': ('Web Push is available for an enabled browser. Device delivery is not confirmed.'
                       if configured and count else 'Enable browser notifications to subscribe this device.'
                       if configured else 'Web Push provider keys are not configured. In-app notifications remain available.'),
        }

    # =====================================================
    # SEND TO ONE USER
    # =====================================================

    def send_to_user(
        self,
        user_id: str,
        title: str,
        message: str,
        notification_type: str = "SYSTEM_ALERT",
        notification_id: str | None = None,
        link: str = '/notifications',
    ) -> dict:

        if not self.is_configured():

            logger.warning(
                "Web Push is not configured."
            )

            return {
                "success": False,
                "sent": 0,
                "failed": 0,
                "configured": False,
                "accepted": 0,
                "delivered": None,
                "reason": (
                    "Web Push is not configured."
                ),
            }

        subscriptions = list(
            self.db[
                PUSH_SUBSCRIPTIONS
            ].find(
                {
                    "userId": user_id,
                    "enabled": True,
                }
            )
        )

        sent = 0
        failed = 0

        for subscription in subscriptions:

            endpoint = subscription.get(
                "endpoint"
            )

            p256dh = subscription.get(
                "p256dh"
            )

            auth = subscription.get(
                "auth"
            )

            if not endpoint or not p256dh or not auth:
                continue

            data = {
                "title": 'Campus update',
                "message": 'Open your campus inbox to read your update.',
                "type": notification_type,
                'link': link if link.startswith('/') and not link.startswith('//') else '/notifications',
                'silent': push_is_silent(subscription.get('preferences')),
            }

            if notification_id:
                data["notificationId"] = (
                    notification_id
                )

            try:
                validate_subscription(endpoint,p256dh,auth)
                webpush(
                    requests_session=NoRedirectSession(),
                    subscription_info={
                        "endpoint": endpoint,
                        "keys": {
                            "p256dh": p256dh,
                            "auth": auth,
                        },
                    },
                    data=__import__(
                        "json"
                    ).dumps(data),
                    vapid_private_key=(
                        self.vapid_private_key
                    ),
                    vapid_claims={
                        "sub": (
                            self.vapid_subject
                        ),
                    },
                    timeout=10,
                )

                sent += 1

            except HTTPException:
                failed += 1
                self.db[PUSH_SUBSCRIPTIONS].update_one({'_id':subscription['_id']},{'$set':{'enabled':False,'updatedAt':utc_now()}})
            except WebPushException as exc:

                failed += 1

                status_code = getattr(
                    getattr(
                        exc,
                        "response",
                        None,
                    ),
                    "status_code",
                    None,
                )

                if status_code in (
                    404,
                    410,
                ):
                    self.db[
                        PUSH_SUBSCRIPTIONS
                    ].update_one(
                        {
                            "_id": subscription[
                                "_id"
                            ],
                        },
                        {
                            "$set": {
                                "enabled": False,
                                "updatedAt": utc_now(),
                            }
                        },
                    )

                logger.warning(
                    "Web Push delivery failed."
                )

            except Exception:

                failed += 1

                logger.exception(
                    "Unexpected Web Push error."
                )

        return {
            "success": sent > 0,
            "sent": sent,
            "failed": failed,
            'configured': True,
            'accepted': sent,
            'delivered': None,
            'reason': 'Accepted by the push provider; device delivery is not confirmed.' if sent else 'No active push subscription.' if not subscriptions else 'The push provider did not accept the notification.',
        }

    # =====================================================
    # SEND TEST
    # =====================================================

    def send_test(
        self,
        user_id: str,
    ) -> dict:

        return self.send_to_user(
            user_id=user_id,
            title="UniEve AI",
            message=(
                "Open your campus inbox to read your test update."
            ),
            notification_type="SYSTEM_ALERT",
        )
