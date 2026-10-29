import asyncio
import unittest
from types import SimpleNamespace
from unittest.mock import AsyncMock, patch
from uuid import uuid4

from pymongo import MongoClient

from app.services.ams.active_sessions import ActiveSessionStore
from app.services.ams.sync_jobs import enqueue_sync
from app.services.ams.sync_status import read_sync_status


class SyncCancellationTests(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        self.client = MongoClient('mongodb://127.0.0.1:27017', serverSelectionTimeoutMS=1000)
        self.db = self.client['campus_test_sync_cancellation_' + uuid4().hex]
        self.store = ActiveSessionStore(sync_concurrency=1)
        self.adapter = SimpleNamespace(logout=AsyncMock())
        self.store_patch = patch('app.services.ams.sync_jobs.active_ams_sessions', self.store)
        self.store_patch.start()

    async def asyncTearDown(self):
        await self.store.close_all()
        self.store_patch.stop()
        self.client.drop_database(self.db.name)
        self.client.close()

    async def retain(self, owner, label='fixture'):
        client = SimpleNamespace(is_closed=False, aclose=AsyncMock())
        await self.store.retain(owner, {'client': client, 'username': label}, self.adapter)

    async def test_logout_marks_a_queued_sync_stopped_without_reading_reports(self):
        await self.retain('running')
        await self.retain('queued')
        entered = asyncio.Event()
        reads = []

        async def reports(db, owner, *args):
            reads.append(owner)
            entered.set()
            await asyncio.Event().wait()

        with patch('app.services.ams.sync_jobs.sync_authenticated_records', reports):
            await enqueue_sync(self.db, 'running')
            await asyncio.wait_for(entered.wait(), 1)
            await enqueue_sync(self.db, 'queued')
            await asyncio.sleep(0)
            await self.store.revoke('queued')
            self.assertEqual(read_sync_status(self.db, 'queued')['state'], 'failed')
            self.assertEqual(reads, ['running'])

    async def test_logout_before_the_job_first_runs_marks_the_sync_stopped(self):
        await self.retain('owner')
        with patch('app.services.ams.sync_jobs.sync_authenticated_records', AsyncMock()):
            await enqueue_sync(self.db, 'owner')
            await self.store.revoke('owner')
        self.assertEqual(read_sync_status(self.db, 'owner')['state'], 'failed')

    async def test_old_cancellation_cannot_fail_a_replacement_sessions_sync(self):
        await self.retain('owner', 'old')
        entered = asyncio.Event()
        cancelling = asyncio.Event()
        release_old = asyncio.Event()
        replacement_entered = asyncio.Event()
        release_new = asyncio.Event()

        async def reports(db, owner, portal, *args):
            if portal['username'] == 'old':
                entered.set()
                try:
                    await asyncio.Event().wait()
                except asyncio.CancelledError:
                    cancelling.set()
                    await release_old.wait()
                    raise
            replacement_entered.set()
            await release_new.wait()

        with patch('app.services.ams.sync_jobs.sync_authenticated_records', reports):
            await enqueue_sync(self.db, 'owner')
            await asyncio.wait_for(entered.wait(), 1)
            replacement = asyncio.create_task(self.retain('owner', 'new'))
            try:
                await asyncio.wait_for(cancelling.wait(), 1)
                await enqueue_sync(self.db, 'owner')
                release_old.set()
                await asyncio.wait_for(replacement, 1)
                await asyncio.wait_for(replacement_entered.wait(), 1)
                self.assertEqual(read_sync_status(self.db, 'owner')['state'], 'syncing')
            finally:
                release_old.set()
                release_new.set()
                await replacement
