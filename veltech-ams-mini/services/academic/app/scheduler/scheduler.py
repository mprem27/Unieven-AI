from __future__ import annotations

import asyncio
import logging

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from pymongo.database import Database

from app.config.settings import settings
from app.scheduler.attendance_sync import (
    AttendanceSyncRunner,
)


logger = logging.getLogger(__name__)


# =========================================================
# SCHEDULER
# =========================================================

scheduler = AsyncIOScheduler()

_sync_lock = asyncio.Lock()


# =========================================================
# ATTENDANCE SYNC
# =========================================================

async def _run_sync(
    db: Database,
) -> None:
    """
    Run the existing live attendance synchronization.

    Notification and SMS processing are triggered by the
    existing AttendanceService when an attendance change
    is detected.

    No separate notification scheduler is required.
    """

    # -----------------------------------------------------
    # PREVENT OVERLAPPING SYNC
    # -----------------------------------------------------

    if _sync_lock.locked():
        logger.warning(
            "Attendance sync already running; "
            "skipping this run."
        )
        return

    async with _sync_lock:
        try:
            logger.info(
                "Starting live Parent Portal "
                "attendance sync."
            )

            result = await (
                AttendanceSyncRunner(
                    db
                ).sync_all_students()
            )

            logger.info(
                "Live attendance sync completed: "
                "students=%s records=%s "
                "changes=%s errors=%s",
                result.get(
                    "studentsProcessed",
                    0,
                ),
                result.get(
                    "recordsProcessed",
                    0,
                ),
                result.get(
                    "changesDetected",
                    0,
                ),
                result.get(
                    "errorsCount",
                    0,
                ),
            )

        except Exception:
            logger.exception(
                "Live Parent Portal "
                "attendance sync failed."
            )


# =========================================================
# START SCHEDULER
# =========================================================

def start_scheduler(
    db: Database,
) -> None:
    """
    Start the existing attendance synchronization
    scheduler.

    Notification/SMS processing must NOT be registered
    as a second scheduler job because attendance changes
    already trigger NotificationService.
    """

    # -----------------------------------------------------
    # ALREADY RUNNING
    # -----------------------------------------------------

    if scheduler.running:
        return

    # -----------------------------------------------------
    # SYNC INTERVAL
    # -----------------------------------------------------

    interval = int(
        getattr(
            settings,
            "sync_interval_minutes",
            5,
        )
        or 5
    )

    if interval <= 0:
        interval = 5

    # -----------------------------------------------------
    # SYNC ENABLED
    # -----------------------------------------------------

    if not bool(
        getattr(
            settings,
            "sync_enabled",
            False,
        )
    ):
        logger.warning(
            "Automatic synchronization is disabled. "
            "Set SYNC_ENABLED=true in backend/.env "
            "to enable live updates."
        )

        return

    # -----------------------------------------------------
    # ATTENDANCE SYNC JOB
    # -----------------------------------------------------

    scheduler.add_job(
        _run_sync,
        trigger="interval",
        minutes=interval,
        args=[db],
        id="attendance_sync",
        replace_existing=True,
        max_instances=1,
        coalesce=True,
        misfire_grace_time=60,
    )

    # -----------------------------------------------------
    # START
    # -----------------------------------------------------

    scheduler.start()

    # -----------------------------------------------------
    # RUN IMMEDIATELY
    # -----------------------------------------------------

    asyncio.create_task(
        _run_sync(db)
    )

    logger.info(
        "Live Parent Portal attendance "
        "scheduler started "
        "(every %s minutes).",
        interval,
    )


# =========================================================
# STOP SCHEDULER
# =========================================================

def stop_scheduler() -> None:
    """
    Stop the existing attendance scheduler.
    """

    if scheduler.running:
        scheduler.shutdown(
            wait=False
        )

        logger.info(
            "Live attendance scheduler stopped."
        )