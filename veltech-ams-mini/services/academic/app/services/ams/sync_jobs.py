"""Bounded owner-session jobs let verified sign-in finish before academic reports."""
from app.services.ams.active_sessions import active_ams_sessions
from app.services.ams.sync_service import sync_authenticated_records
from app.services.ams.sync_status import begin_sync,fail_sync
from app.services.ams.ams_adapter import AmsAuthenticationError

async def enqueue_sync(db,student_id,*,initial=False):
    async def run(portal,adapter):
        try:
            profile=await adapter.get_student_profile(portal) if initial else None
            await sync_authenticated_records(db,student_id,portal,adapter,profile)
        except (AmsAuthenticationError,ValueError):
            fail_sync(db,student_id,'AMS sign-in expired or the source changed. Sign in again to refresh.')
            client=portal.get('client')
            if client:await client.aclose()
        except Exception:
            fail_sync(db,student_id,'AMS data could not be refreshed. Previous records were retained; retry when the portal is available.')
    started=await active_ams_sessions.start_job(student_id,run,min_interval_seconds=120,on_cancel=lambda:fail_sync(db,student_id,'AMS sync stopped. Previous records were retained.'))
    if started:begin_sync(db,student_id)
    return started
