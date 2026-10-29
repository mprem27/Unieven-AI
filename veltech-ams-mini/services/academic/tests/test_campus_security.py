"""Private campus snapshot and sync behavior, without portal requests."""
import unittest
from uuid import uuid4
from unittest.mock import AsyncMock, patch

from fastapi import FastAPI, HTTPException
from httpx import ASGITransport, AsyncClient
from pymongo import MongoClient

from app.config.database import get_db
from app.routes.campus import router, snapshot, sync


class CampusSecurityTests(unittest.IsolatedAsyncioTestCase):
    def setUp(self):
        self.client = MongoClient("mongodb://127.0.0.1:27017", serverSelectionTimeoutMS=2000)
        self.db = self.client[f"campus_security_test_{uuid4().hex}"]

    def tearDown(self):
        self.client.drop_database(self.db.name)
        self.client.close()

    async def test_snapshot_requires_authentication(self):
        app = FastAPI()
        app.include_router(router)
        app.dependency_overrides[get_db] = lambda: self.db
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            self.assertEqual((await client.get("/campus/snapshot")).status_code, 401)

    def test_snapshot_uses_only_current_students_metadata(self):
        self.db.timetable_metadata.insert_many([
            {"studentId": "other", "profile": {"mentorName": "Other mentor"}, "courses": ["Other course"]},
            {"studentId": "me", "profile": {"mentorName": "My mentor"}, "courses": ["My course"]},
        ])
        result = snapshot({"id": "me", "name": "Student"}, self.db)
        self.assertEqual(result["profile"]["mentorName"], "My mentor")
        self.assertEqual(result["academic"]["courses"], ["My course"])

    def test_snapshot_identity_is_the_verified_principal_not_mutable_credentials(self):
        from datetime import datetime, timezone
        verified_at = datetime.now(timezone.utc)
        result = snapshot({"id": "me", "portalUsername": "vtu99999", "portalSynced": True,
                           "portalVerifiedPrincipal": "vtu00000", "portalPrincipalVerifiedAt": verified_at}, self.db)
        self.assertEqual(result["identity"]["verifiedPrincipal"], "vtu00000")
        unverified = snapshot({"id": "me", "portalUsername": "vtu99999", "portalSynced": True}, self.db)
        self.assertIsNone(unverified["identity"]["verifiedPrincipal"])

    async def test_admin_cannot_start_a_student_portal_sync(self):
        with self.assertRaises(HTTPException) as error:
            await sync({"id": "admin", "role": "admin"}, self.db)
        self.assertEqual(error.exception.status_code, 403)

    async def test_sync_requires_own_stored_portal_credentials(self):
        with self.assertRaises(HTTPException) as error:
            await sync({"id": "me", "role": "student"}, self.db)
        self.assertEqual(error.exception.status_code, 410)

    async def test_retired_sync_never_starts_the_authenticated_reader(self):
        # Only the external synchronization operation is substituted; endpoint
        # authorization and response handling are the production implementation.
        with patch("app.routes.campus.sync_authenticated_records", new_callable=AsyncMock) as portal:
            portal.return_value = {"success": True, "recordsProcessed": 3}
            with self.assertRaises(HTTPException) as error:
                await sync({"id": "me", "role": "student", "portalUsername": "my-account",
                            "portalPasswordEncrypted": "opaque-test-value"}, self.db)
            self.assertEqual(error.exception.status_code, 410)
            portal.assert_not_awaited()

    async def test_failed_sync_does_not_expose_private_portal_error(self):
        with patch("app.routes.campus.sync_authenticated_records", new_callable=AsyncMock) as portal:
            portal.return_value = {"success": False, "error": "sensitive upstream diagnostic"}
            with self.assertRaises(HTTPException) as error:
                await sync({"id": "me", "role": "student", "portalUsername": "my-account",
                            "portalPasswordEncrypted": "opaque-test-value"}, self.db)
            self.assertEqual(error.exception.status_code, 410)
            self.assertNotIn("sensitive", error.exception.detail)
            portal.assert_not_awaited()


if __name__ == "__main__":
    unittest.main()
