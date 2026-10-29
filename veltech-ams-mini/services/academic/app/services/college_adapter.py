from abc import ABC, abstractmethod
from typing import Any


class CollegeAdapter(ABC):

    @abstractmethod
    async def login(
        self,
        username: str,
        password: str,
    ) -> dict[str, Any]:
        pass

    @abstractmethod
    async def get_student_profile(
        self,
        session: dict[str, Any],
    ) -> dict[str, Any]:
        pass

    @abstractmethod
    async def get_student_photo(
        self,
        session: dict[str, Any],
    ) -> bytes | None:
        pass

    @abstractmethod
    async def get_subjects(
        self,
        session: dict[str, Any],
    ) -> list[dict[str, Any]]:
        pass

    @abstractmethod
    async def get_attendance(
        self,
        session: dict[str, Any],
    ) -> list[dict[str, Any]]:
        pass

    @abstractmethod
    async def get_timetable(
        self,
        session: dict[str, Any],
    ) -> list[dict[str, Any]]:
        pass

    @abstractmethod
    async def logout(
        self,
        session: dict[str, Any],
    ) -> None:
        pass