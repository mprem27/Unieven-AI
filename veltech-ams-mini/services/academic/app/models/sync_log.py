from datetime import datetime
from typing import Literal, Optional

from pydantic import BaseModel, ConfigDict


SYNC_LOGS = "sync_logs"


SyncStatus = Literal[
    "RUNNING",
    "SUCCESS",
    "PARTIAL",
    "FAILED",
]


SyncType = Literal[
    "AUTOMATIC",
    "MANUAL",
]


class SyncLogDocument(BaseModel):
    model_config = ConfigDict(
        populate_by_name=True
    )

    # =========================================================
    # ID
    # =========================================================

    id: Optional[str] = None

    # =========================================================
    # SYNC TIME
    # =========================================================

    startedAt: datetime

    completedAt: Optional[datetime] = None

    updatedAt: Optional[datetime] = None

    # =========================================================
    # STATUS
    # =========================================================

    status: SyncStatus = "RUNNING"

    # =========================================================
    # SYNC TYPE
    # =========================================================

    syncType: SyncType = "AUTOMATIC"

    # =========================================================
    # SOURCE
    # =========================================================

    source: str = "college_portal"

    # =========================================================
    # SYNC STATISTICS
    # =========================================================

    studentsProcessed: int = 0

    recordsProcessed: int = 0

    changesDetected: int = 0

    errorsCount: int = 0

    # =========================================================
    # ERROR
    # =========================================================

    error: Optional[str] = None