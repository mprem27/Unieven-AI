from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict


# =========================================================
# COLLECTION
# =========================================================

PUSH_SUBSCRIPTIONS = "push_subscriptions"


# =========================================================
# PUSH SUBSCRIPTION DOCUMENT
# =========================================================

class PushSubscriptionDocument(BaseModel):

    model_config = ConfigDict(
        populate_by_name=True,
        extra="ignore",
    )

    id: Optional[str] = None

    userId: str

    endpoint: str

    p256dh: str

    auth: str

    enabled: bool = True

    createdAt: Optional[datetime] = None

    updatedAt: Optional[datetime] = None