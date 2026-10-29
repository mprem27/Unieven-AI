from contextlib import asynccontextmanager
import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config.database import mongo
from app.config.settings import settings

from app.routes import (
    admin,
    attendance,
    auth,
    notifications,
    profile,
    subjects,
    timetable,
)

from app.scheduler.scheduler import (
    start_scheduler,
    stop_scheduler,
)

from app.services.auth_service import AuthService
from app.routes import campus, campus_bridge, portal_login, exam_seating, exam_schedule
from app.utils.logger import setup_logging


# =========================================================
# LOGGER
# =========================================================

logger = logging.getLogger(__name__)


# =========================================================
# APPLICATION LIFESPAN
# =========================================================

@asynccontextmanager
async def lifespan(
    app: FastAPI,
):
    """
    Application startup and shutdown lifecycle.

    Existing application behavior is preserved:
    - MongoDB connection
    - Default admin initialization
    - Background scheduler
    - MongoDB disconnection
    """

    setup_logging()

    # =====================================================
    # DATABASE
    # =====================================================

    mongo.connect()

    db = mongo.get_db()

    # =====================================================
    # DEFAULT ADMIN
    # =====================================================

    AuthService(
        db
    ).ensure_default_admin(
        settings.default_admin_email,
        settings.default_admin_password,
        settings.default_admin_name,
    )

    # =====================================================
    # BACKGROUND SCHEDULER
    # =====================================================

    try:
        start_scheduler(db)

    except Exception as exc:
        # Scheduler failure must not stop
        # the API server.
        logger.exception(
            "Failed to start scheduler: %s",
            exc,
        )

    # =====================================================
    # APPLICATION RUNNING
    # =====================================================

    yield

    # =====================================================
    # SHUTDOWN
    # =====================================================

    try:
        stop_scheduler()

    except Exception:
        logger.exception(
            "Failed to stop scheduler."
        )

    # =====================================================
    # DATABASE DISCONNECT
    # =====================================================

    from app.services.ams.active_sessions import active_ams_sessions
    await active_ams_sessions.close_all()
    mongo.disconnect()


# =========================================================
# FASTAPI APPLICATION
# =========================================================

app = FastAPI(
    title=settings.app_name,
    version="1.0.0",
    lifespan=lifespan,
)


# =========================================================
# CORS
# =========================================================

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# =========================================================
# API PREFIX
# =========================================================

API_PREFIX = settings.api_v1_prefix
app.include_router(campus.router, prefix=API_PREFIX)
app.include_router(campus_bridge.router, prefix=API_PREFIX)
app.include_router(exam_seating.router, prefix=API_PREFIX)
app.include_router(exam_schedule.router, prefix=API_PREFIX)
app.include_router(portal_login.router, prefix=API_PREFIX)


# =========================================================
# AUTH ROUTES
# =========================================================

app.include_router(
    auth.router,
    prefix=API_PREFIX,
)


# =========================================================
# PROFILE ROUTES
# =========================================================

app.include_router(
    profile.router,
    prefix=API_PREFIX,
)


# =========================================================
# ATTENDANCE ROUTES
# =========================================================
#
# EXISTING WORKING ATTENDANCE CODE.
#
# No attendance logic is modified here.
#
# =========================================================

app.include_router(
    attendance.router,
    prefix=API_PREFIX,
)


# =========================================================
# SUBJECT ROUTES
# =========================================================

app.include_router(
    subjects.router,
    prefix=API_PREFIX,
)


# =========================================================
# TIMETABLE ROUTES
# =========================================================
#
# Timetable remains independent from attendance.
#
# =========================================================

app.include_router(
    timetable.router,
    prefix=API_PREFIX,
)


# =========================================================
# NOTIFICATION ROUTES
# =========================================================
#
# In-app notification endpoints.
#
# Final URLs:
#
# GET   /api/v1/notifications
# GET   /api/v1/notifications/unread-count
# PATCH /api/v1/notifications/{id}/read
# PATCH /api/v1/notifications/read-all
# DELETE /api/v1/notifications/{id}
#
# =========================================================

app.include_router(
    notifications.router,
    prefix=API_PREFIX,
)


# =========================================================
# ADMIN ROUTES
# =========================================================
#
# The admin router already contains its own /admin
# prefix.
#
# Final URLs:
#
# /api/v1/admin/...
#
# =========================================================

app.include_router(
    admin.router,
    prefix=API_PREFIX,
)


# =========================================================
# HEALTH CHECK
# =========================================================

@app.get("/health")
def health():
    return {
        "status": "ok",
    }


# =========================================================
# API HEALTH CHECK
# =========================================================

@app.get(
    f"{API_PREFIX}/health"
)
def api_health():
    return {
        "status": "ok",
    }
