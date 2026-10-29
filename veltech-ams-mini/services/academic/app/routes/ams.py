from fastapi import APIRouter, Depends, HTTPException
from pymongo.database import Database

from app.config.database import get_db
from app.security.permissions import get_current_user
from app.services.user_service import UserService
from app.college.ams_adapter import AmsAdapter


router = APIRouter(
    prefix="/ams",
    tags=["ams"],
)


@router.get("/status")
async def get_ams_status(
    current_user: dict = Depends(get_current_user),
    db: Database = Depends(get_db),
):
    user = UserService(db).get_portal_credentials_status(
        current_user["id"]
    )

    return {
        "configured": bool(
            user.get("configured")
        ),
        "portalUsername": user.get(
            "portalUsername"
        ),
        "portalUrl": AmsAdapter.BASE_URL,
    }


@router.post("/test-login")
async def test_ams_login(
    current_user: dict = Depends(get_current_user),
    db: Database = Depends(get_db),
):
    credentials = UserService(
        db
    ).get_portal_credentials_for_login(
        current_user["id"]
    )

    if not credentials:
        raise HTTPException(
            status_code=400,
            detail="AMS credentials are not configured.",
        )

    username = credentials.get(
        "portalUsername"
    )

    password = credentials.get(
        "portalPassword"
    )

    if not username or not password:
        raise HTTPException(
            status_code=400,
            detail="AMS credentials are incomplete.",
        )

    adapter = AmsAdapter()

    session = None

    try:
        session = await adapter.login(
            username=username,
            password=password,
        )

        return {
            "success": True,
            "message": "AMS login successful.",
            "username": username,
            "url": session.get("url"),
        }

    except Exception as exc:
        raise HTTPException(
            status_code=502,
            detail=f"Unable to login to AMS: {str(exc)}",
        )

    finally:
        if session:
            try:
                await adapter.logout(session)
            except Exception:
                pass