"""Bounded source-login admission, using only synthetic local transports."""
import asyncio
import unittest
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock, patch

import httpx
from fastapi import FastAPI

from app.services.ams.login_admission import SourceLoginAdmission, SourceLoginBusy
from app.services.ams.ams_adapter import AmsAdapter
from app.services.ams import manual_session


class SourceLoginAdmissionTests(unittest.IsolatedAsyncioTestCase):
    async def test_active_limit_fifo_queue_and_overflow(self):
        gate = SourceLoginAdmission(max_active=2, max_waiting=3)
        release = asyncio.Event()
        entered = []
        ready = [asyncio.Event() for _ in range(5)]
        active = 0
        peak = 0

        async def login(index):
            nonlocal active, peak
            ready[index].set()
            async with gate.slot():
                active += 1
                peak = max(peak, active)
                entered.append(index)
                try:
                    await release.wait()
                finally:
                    active -= 1

        tasks = []
        try:
            for index in range(5):
                tasks.append(asyncio.create_task(login(index)))
                await ready[index].wait()
            self.assertEqual(entered, [0, 1])
            with self.assertRaises(SourceLoginBusy) as error:
                async with gate.slot():
                    self.fail('A full login queue admitted another operation')
            self.assertEqual(error.exception.status_code, 503)
            self.assertEqual(error.exception.headers['Retry-After'], '3')
            release.set()
            await asyncio.gather(*tasks)
            self.assertEqual(entered, [0, 1, 2, 3, 4])
            self.assertEqual(peak, 2)
        finally:
            release.set()
            await asyncio.gather(*tasks, return_exceptions=True)

    async def test_waiter_timeout_releases_queue_capacity(self):
        gate = SourceLoginAdmission(max_active=1, max_waiting=1, queue_timeout=0.01)
        async with gate.slot():
            async def queued():
                async with gate.slot():
                    self.fail('The active login has not finished')
            with self.assertRaises(SourceLoginBusy):
                await asyncio.create_task(queued())
            with self.assertRaises(SourceLoginBusy):
                await asyncio.create_task(queued())
        async with gate.slot():
            pass

    async def test_cancelled_waiter_and_cancelled_handoff_do_not_leak_slots(self):
        gate = SourceLoginAdmission(max_active=1, max_waiting=1)
        ready = asyncio.Event()

        async def queued():
            ready.set()
            async with gate.slot():
                self.fail('Cancelled login was allowed to continue')

        async with gate.slot():
            waiter = asyncio.create_task(queued())
            await ready.wait()
            waiter.cancel()
            await asyncio.gather(waiter, return_exceptions=True)
            ready.clear()
            handoff = asyncio.create_task(queued())
            await ready.wait()
        # The slot has been handed off, but the waiter has not resumed yet.
        handoff.cancel()
        await asyncio.gather(handoff, return_exceptions=True)
        async with gate.slot():
            pass

    async def test_nested_same_task_is_allowed_but_child_tasks_are_bounded(self):
        gate = SourceLoginAdmission(max_active=1, max_waiting=0)
        async with gate.slot():
            async with gate.slot():
                pass
            async def child():
                async with gate.slot():
                    self.fail('Child task inherited admission without acquiring a slot')
            with self.assertRaises(SourceLoginBusy):
                await asyncio.create_task(child())


class AdapterAdmissionTests(unittest.IsolatedAsyncioTestCase):
    async def test_hundred_owner_burst_keeps_four_active_eight_waiting_and_private_sessions(self):
        from urllib.parse import parse_qs
        gate = SourceLoginAdmission()
        release = asyncio.Event()
        four_entered = asyncio.Event()
        clients = []
        requests_active = 0
        peak = 0
        entered = 0
        real_client = httpx.AsyncClient

        def new_client(**kwargs):
            nonce = 'nonce-' + str(len(clients))
            principal = None
            async def handle(request):
                nonlocal requests_active, peak, entered, principal
                if request.url.path == '/Login.aspx':
                    requests_active += 1
                    peak = max(peak, requests_active)
                    entered += 1
                    if entered == 4:
                        four_entered.set()
                    try:
                        await release.wait()
                    finally:
                        requests_active -= 1
                    return httpx.Response(200, text=f'<input type="hidden" name="loginNonce" value="{nonce}">')
                if request.url.path == '/Validation.aspx':
                    data = parse_qs(request.content.decode())
                    principal = data['username'][0]
                    self.assertEqual(data['loginNonce'], [nonce])
                    self.assertEqual(data['password'], ['synthetic-' + principal])
                    return httpx.Response(200, text='accepted', headers={'set-cookie': f'owner={principal}; Path=/'})
                self.assertEqual(request.headers['cookie'], 'owner=' + principal)
                return httpx.Response(200, text=f'<span id="MainContent_lblStuname">{principal}</span><span id="MainContent_lblID">{principal}</span>')
            client = real_client(transport=httpx.MockTransport(handle), **kwargs)
            clients.append(client)
            return client

        tasks = []
        try:
            with patch('app.services.ams.ams_adapter.source_login_admission', gate), patch('app.services.ams.ams_adapter.httpx.AsyncClient', side_effect=new_client):
                for index in range(100):
                    owner = f'fixture-{index}'
                    tasks.append(asyncio.create_task(AmsAdapter().login(owner, 'synthetic-' + owner)))
                await asyncio.wait_for(four_entered.wait(), 1)
                self.assertEqual(len(clients), 4)
                self.assertEqual(sum(task.done() for task in tasks), 88)
                release.set()
                results = await asyncio.gather(*tasks, return_exceptions=True)
            self.assertEqual(peak, 4)
            self.assertEqual(sum(isinstance(result, SourceLoginBusy) for result in results), 88)
            for index, result in enumerate(results):
                if isinstance(result, SourceLoginBusy):
                    continue
                self.assertIsInstance(result, dict)
                self.assertEqual(result['portalUsername'], f'fixture-{index}')
                self.assertIn(f'>fixture-{index}</span>', result['dashboard_html'])
            self.assertEqual(len({id(result['client']) for result in results if isinstance(result, dict)}), 12)
        finally:
            release.set()
            await asyncio.gather(*tasks, return_exceptions=True)
            for client in clients:
                await client.aclose()

    async def test_prepare_and_login_share_admission_before_creating_clients(self):
        gate = SourceLoginAdmission(max_active=1, max_waiting=1)
        entered = asyncio.Event()
        release = asyncio.Event()
        clients = []
        dashboard = '<span id="MainContent_lblStuname">Fixture</span><span id="MainContent_lblID">FIXTURE</span>'

        async def handle(request):
            if request.url.path == '/Login.aspx':
                entered.set()
                await release.wait()
                return httpx.Response(200, text='<form></form>')
            return httpx.Response(200, text=dashboard)

        real_client = httpx.AsyncClient
        def new_client(**kwargs):
            client = real_client(transport=httpx.MockTransport(handle), **kwargs)
            clients.append(client)
            return client

        tasks = []
        try:
            with patch('app.services.ams.ams_adapter.source_login_admission', gate), patch('app.services.ams.ams_adapter.httpx.AsyncClient', side_effect=new_client):
                tasks.append(asyncio.create_task(AmsAdapter().prepare_login()))
                await entered.wait()
                tasks.append(asyncio.create_task(AmsAdapter().login('fixture-owner', 'synthetic-only')))
                await asyncio.sleep(0)
                with self.assertRaises(SourceLoginBusy):
                    await AmsAdapter().login('other-owner', 'synthetic-only')
                self.assertEqual(len(clients), 1)
                release.set()
                prepared, portal = await asyncio.gather(*tasks)
                self.assertEqual(portal['portalUsername'], 'fixture-owner')
                self.assertIsNot(prepared['client'], portal['client'])
        finally:
            release.set()
            await asyncio.gather(*tasks, return_exceptions=True)
            for client in clients:
                await client.aclose()

    async def test_cancelled_prepare_and_login_close_their_http_client(self):
        for method in ('prepare_login', 'login'):
            with self.subTest(method=method):
                entered = asyncio.Event()
                async def handle(request):
                    entered.set()
                    await asyncio.Event().wait()
                client = httpx.AsyncClient(transport=httpx.MockTransport(handle))
                with patch('app.services.ams.ams_adapter.httpx.AsyncClient', return_value=client):
                    operation = getattr(AmsAdapter(), method)
                    task = asyncio.create_task(operation() if method == 'prepare_login' else operation('fixture', 'synthetic-only'))
                    await entered.wait()
                    task.cancel()
                    await asyncio.gather(task, return_exceptions=True)
                self.assertTrue(client.is_closed)


class ManualChallengeAdmissionTests(unittest.IsolatedAsyncioTestCase):
    async def asyncTearDown(self):
        for item in list(manual_session._sessions.values()):
            await item['prepared']['client'].aclose()
        manual_session._sessions.clear()

    def store_challenge(self, owner, key):
        import time
        client = SimpleNamespace(aclose=AsyncMock())
        prepared = {'client': client, 'fields': {}, 'requiresCaptcha': True, 'challenge': 'SYNTHETIC'}
        manual_session._sessions[key] = {'owner': owner, 'expires': time.monotonic() + 300, 'prepared': prepared}
        return prepared

    async def test_busy_challenge_replacement_preserves_previous_challenge(self):
        gate = SourceLoginAdmission(max_active=1, max_waiting=0)
        prepared = self.store_challenge('owner-a', 'retained-fixture-challenge')
        async with gate.slot():
            with patch('app.services.ams.manual_session.source_login_admission', gate):
                with self.assertRaises(SourceLoginBusy):
                    await asyncio.create_task(manual_session.prepare_challenge('owner-a'))
        self.assertIs(await manual_session.take_challenge('owner-a', 'retained-fixture-challenge'), prepared)
        prepared['client'].aclose.assert_not_awaited()

    async def test_replacement_cleanup_failure_closes_unreturned_new_challenge(self):
        previous = self.store_challenge('owner-a', 'retired-fixture-challenge')
        previous['client'].aclose.side_effect = RuntimeError('synthetic close failure')
        replacement = {'client': SimpleNamespace(aclose=AsyncMock()), 'fields': {}, 'requiresCaptcha': True, 'challenge': 'SYNTHETIC'}
        with patch('app.services.ams.manual_session.AmsAdapter.prepare_login', new_callable=AsyncMock, return_value=replacement):
            with self.assertRaisesRegex(RuntimeError, 'synthetic close failure'):
                await manual_session.prepare_challenge('owner-a')
        self.assertFalse(any(item['owner'] == 'owner-a' for item in manual_session._sessions.values()))
        replacement['client'].aclose.assert_awaited_once()

    async def test_busy_manual_login_keeps_both_owners_challenges(self):
        from app.routes.portal_login import LoginInput, session
        gate = SourceLoginAdmission(max_active=1, max_waiting=0)
        owner_a, owner_b = 'a' * 64, 'b' * 64
        challenge_a, challenge_b = 'fixture-owner-a-challenge', 'fixture-owner-b-challenge'
        prepared_a = self.store_challenge('browser:' + owner_a, challenge_a)
        prepared_b = self.store_challenge('browser:' + owner_b, challenge_b)
        async with gate.slot():
            with patch('app.routes.portal_login.source_login_admission', gate), patch('app.routes.portal_login.AmsAdapter') as adapter:
                with self.assertRaises(SourceLoginBusy):
                    await asyncio.create_task(session(LoginInput(owner=owner_a, challengeId=challenge_a, username='fixture', password='synthetic-only', answer='TEST'), db=MagicMock()))
                adapter.assert_not_called()
        with self.assertRaises(ValueError):
            await manual_session.take_challenge('browser:' + owner_b, challenge_a)
        self.assertIs(await manual_session.take_challenge('browser:' + owner_a, challenge_a), prepared_a)
        self.assertIs(await manual_session.take_challenge('browser:' + owner_b, challenge_b), prepared_b)
        prepared_a['client'].aclose.assert_not_awaited()
        prepared_b['client'].aclose.assert_not_awaited()

    async def test_busy_campus_login_preserves_challenge_and_sync_state(self):
        from app.routes.campus import AmsSyncInput, ams_sync
        gate = SourceLoginAdmission(max_active=1, max_waiting=0)
        prepared = self.store_challenge('owner-a', 'fixture-campus-challenge')
        async with gate.slot():
            with patch('app.routes.campus.source_login_admission', gate), patch('app.routes.campus.begin_sync') as begin:
                with self.assertRaises(SourceLoginBusy):
                    await asyncio.create_task(ams_sync(AmsSyncInput(challengeId='fixture-campus-challenge', answer='TEST'), current_user={'id': 'owner-a', 'portalUsername': 'fixture', 'portalPasswordEncrypted': 'synthetic-only'}, db=MagicMock()))
                begin.assert_not_called()
        self.assertIs(await manual_session.take_challenge('owner-a', 'fixture-campus-challenge'), prepared)
        prepared['client'].aclose.assert_not_awaited()

    async def test_challenge_http_endpoints_return_retry_after_when_busy(self):
        from app.routes import campus, portal_login
        from app.routes.campus_bridge import require_service
        from app.config.database import get_db
        from app.security.permissions import require_student
        gate = SourceLoginAdmission(max_active=1, max_waiting=0)
        app = FastAPI()
        app.include_router(campus.router)
        app.include_router(portal_login.router)
        app.dependency_overrides[require_service] = lambda: None
        app.dependency_overrides[require_student] = lambda: {'id': 'owner-a'}
        app.dependency_overrides[get_db] = lambda: MagicMock()
        async with gate.slot():
            with patch('app.services.ams.manual_session.source_login_admission', gate):
                async def request(path, body):
                    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url='http://test') as client:
                        return await client.post(path, json=body)
                for path, body in [('/campus/ams/challenge', {}), ('/campus/portal-login/challenge', {'owner': 'a' * 64}), ('/campus/portal-login/session', {'owner': 'a' * 64, 'username': 'fixture', 'password': 'synthetic-only'})]:
                    response = await asyncio.create_task(request(path, body))
                    self.assertEqual(response.status_code, 503, response.text)
                    self.assertEqual(response.headers['Retry-After'], '3')


if __name__ == '__main__':
    unittest.main()
