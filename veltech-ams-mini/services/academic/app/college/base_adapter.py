from abc import ABC, abstractmethod
from typing import Any

from app.schemas.attendance import IncomingAttendanceRecord


class CollegeDataAdapter(ABC):

    @abstractmethod
    async def login(
        self,
        username: str,
        password: str,
    ) -> dict[str, Any]:
        """Create an authorized college portal session."""

    @abstractmethod
    async def get_student_profile(
        self,
        session: dict[str, Any],
    ) -> dict[str, Any]:
        """Fetch student profile."""

    @abstractmethod
    async def get_student_photo(
        self,
        session: dict[str, Any],
    ) -> bytes | None:
        """Fetch student photo."""

    @abstractmethod
    async def get_subjects(
        self,
        session: dict[str, Any],
    ) -> list[dict[str, Any]]:
        """Fetch student subjects."""

    @abstractmethod
    async def get_attendance(
        self,
        session: dict[str, Any],
    ) -> list[IncomingAttendanceRecord | dict[str, Any]]:
        """Fetch student attendance."""

    @abstractmethod
    async def get_timetable(
        self,
        session: dict[str, Any],
    ) -> list[dict[str, Any]]:
        """Fetch student timetable."""

    @abstractmethod
    async def logout(
        self,
        session: dict[str, Any],
    ) -> None:
        """Close the college portal session."""