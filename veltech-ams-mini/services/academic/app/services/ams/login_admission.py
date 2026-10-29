"""Per-process admission for AMS authentication, independent of record sync slots."""
from __future__ import annotations

import asyncio
from collections import deque
from contextlib import asynccontextmanager
from contextvars import ContextVar

from fastapi import HTTPException


class SourceLoginBusy(HTTPException):
    def __init__(self) -> None:
        super().__init__(
            status_code=503,
            detail='AMS sign-in is busy. Please retry shortly.',
            headers={'Retry-After': '3'},
        )


class SourceLoginAdmission:
    """Bound active attempts and their FIFO queue without retaining credentials.

    A task can nest admission when a manual challenge is taken before calling
    the adapter. Child tasks must acquire their own slot, even when they inherit
    the parent's context. Queue cancellation and timeout return reserved slots.
    """

    def __init__(self, max_active: int = 4, max_waiting: int = 8, queue_timeout: float = 5.0):
        if max_active < 1 or max_waiting < 0 or queue_timeout <= 0:
            raise ValueError('Login admission requires positive capacity and timeout.')
        self.max_active = max_active
        self.max_waiting = max_waiting
        self.queue_timeout = queue_timeout
        self._active = 0
        self._waiters: deque[asyncio.Future] = deque()
        self._admitted_task = ContextVar(f'source_login_task_{id(self)}', default=None)

    def _release(self) -> None:
        while self._waiters:
            waiter = self._waiters.popleft()
            if not waiter.done():
                waiter.set_result(None)
                return
        self._active -= 1

    @asynccontextmanager
    async def slot(self):
        task = asyncio.current_task()
        if self._admitted_task.get() is task:
            yield
            return

        if self._active < self.max_active:
            self._active += 1
        else:
            if len(self._waiters) >= self.max_waiting:
                raise SourceLoginBusy()
            waiter = asyncio.get_running_loop().create_future()
            self._waiters.append(waiter)
            try:
                await asyncio.wait_for(asyncio.shield(waiter), self.queue_timeout)
            except BaseException as error:
                if waiter.done() and not waiter.cancelled():
                    self._release()
                else:
                    self._waiters.remove(waiter)
                    waiter.cancel()
                if isinstance(error, TimeoutError):
                    raise SourceLoginBusy() from None
                raise

        token = self._admitted_task.set(task)
        try:
            yield
        finally:
            self._admitted_task.reset(token)
            self._release()


source_login_admission = SourceLoginAdmission()
