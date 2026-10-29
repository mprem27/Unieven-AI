"""Synthetic owners and report delays; never contacts an upstream university."""
import asyncio
import unittest
from types import SimpleNamespace
from app.services.ams.active_sessions import ActiveSessionStore


class ConcurrentStudentSyncTests(unittest.IsolatedAsyncioTestCase):
    async def test_legacy_sync_and_jobs_share_slots_and_queued_cancellation_releases_waiters(self):
        from unittest.mock import AsyncMock,MagicMock,patch
        from app.routes.campus import AmsSyncInput,ams_sync
        from fastapi import HTTPException
        store=ActiveSessionStore(sync_concurrency=1)
        release=asyncio.Event();entered=asyncio.Event();finished=asyncio.Event()
        adapter=SimpleNamespace(logout=AsyncMock())
        await store.retain('job-owner',{'client':object(),'username':'job-owner'},adapter)
        async def read_reports(_portal,_adapter):entered.set();await release.wait();finished.set()
        await store.start_job('job-owner',read_reports)
        await asyncio.wait_for(entered.wait(),1)
        self.assertTrue(hasattr(store,'record_sync_slot'),'Legacy sync needs the same bounded report admission as jobs')
        try:
            async with store.record_sync_slot(wait_timeout=0.01):self.fail('A background job already occupies the only shared slot')
        except HTTPException as error:
            self.assertEqual(error.status_code,503)
            self.assertEqual(error.headers,{'Retry-After':'3'})
        user={'id':'fixture-owner','portalUsername':'fixture','portalPasswordEncrypted':'synthetic-only'}
        body=AmsSyncInput(challengeId='synthetic-owner-challenge',answer='manual')
        with patch('app.routes.campus.active_ams_sessions',store),patch('app.routes.campus.take_challenge',new_callable=AsyncMock) as take:
            real_slot=store.record_sync_slot
            with patch.object(store,'record_sync_slot',side_effect=lambda **_kwargs:real_slot(wait_timeout=0.01)):
                with self.assertRaises(HTTPException) as busy:
                    await ams_sync(body,current_user=user,db=MagicMock())
                self.assertEqual(busy.exception.status_code,503)
                self.assertEqual(busy.exception.headers,{'Retry-After':'3'})
                take.assert_not_awaited()
            pending=asyncio.create_task(ams_sync(body,current_user=user,db=MagicMock()))
            await asyncio.sleep(0)
            pending.cancel()
            await asyncio.gather(pending,return_exceptions=True)
            take.assert_not_awaited()
        release.set();await asyncio.wait_for(finished.wait(),1)
        async with store.record_sync_slot(wait_timeout=0.1):
            # A legacy caller occupying the slot also blocks a queued job.
            started=asyncio.Event()
            async def second_job(_portal,_adapter):started.set()
            await store.start_job('job-owner',second_job)
            await asyncio.sleep(0)
            self.assertFalse(started.is_set())
        await asyncio.wait_for(started.wait(),1)
        await store.close_all()

    async def test_many_students_keep_owned_sessions_and_three_active_syncs(self):
        store=ActiveSessionStore(capacity=48,sync_concurrency=3)
        owners=[f'synthetic-student-{index}' for index in range(36)]
        release=asyncio.Event()
        three_started=asyncio.Event()
        all_finished=asyncio.Event()
        seen=[]
        active=0
        maximum=0
        closed=[]
        async def logout(portal):closed.append(portal['username'])
        adapter=SimpleNamespace(logout=logout)
        async def read_reports(portal,actual_adapter):
            nonlocal active,maximum
            self.assertIs(actual_adapter,adapter)
            owner=portal['username']
            self.assertEqual(portal['vtuNumber'],owner)
            active+=1;maximum=max(maximum,active)
            if active==3:three_started.set()
            try:
                await release.wait()
                # Model independently delayed source reports without requests.
                await asyncio.sleep(0.002)
                seen.append(owner)
                if len(seen)==len(owners):all_finished.set()
            finally:active-=1
        try:
            for owner in owners:
                self.assertTrue(await store.retain(owner,{'client':object(),'username':owner,'vtuNumber':owner},adapter))
            queued=await asyncio.gather(*(store.start_job(owner,read_reports) for owner in owners))
            self.assertTrue(all(queued))
            await asyncio.wait_for(three_started.wait(),1)
            self.assertEqual(active,3)
            self.assertFalse(await store.start_job(owners[-1],read_reports))
            with self.assertRaises(ValueError):await store.start_job('foreign-student',read_reports)
            release.set()
            await asyncio.wait_for(all_finished.wait(),2)
            self.assertEqual(maximum,3)
            self.assertCountEqual(seen,owners)
            self.assertEqual(len(set(seen)),36)
        finally:
            release.set();await store.close_all()
        self.assertCountEqual(closed,owners)

