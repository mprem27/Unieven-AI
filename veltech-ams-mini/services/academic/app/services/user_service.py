from __future__ import annotations
import re

from bson import ObjectId
from fastapi import HTTPException
from pymongo.database import Database

from app.models.user import USERS
from app.schemas.user import (
    PortalCredentialsUpdate,
    ProfileUpdate,
    UserCreate,
    UserUpdate,
)
from app.security.portal_credentials import encrypt_portal_password
from app.services.ams.ams_adapter import (
    AmsAdapter,
    AmsAuthenticationError,
)
from app.services.base import public_user, serialize_document


class UserService:
    def __init__(self, db: Database):
        self.db = db
        self.ams_adapter = AmsAdapter()

    @staticmethod
    def _clean_text(value):
        if value is None:
            return None

        if isinstance(value, str):
            value = value.strip()
            return value or None

        return value

    @staticmethod
    def _normalize_portal_username(value: str | None) -> str | None:
        value = str(value or "").strip()
        return value or None

    @staticmethod
    def _normalize_vtu_number(value: str | None) -> str | None:
        value = str(value or "").strip()
        return value or None

    @staticmethod
    def _is_vtu_number(value: str | None) -> bool:
        if not value:
            return False

        value = str(value).strip()
        return value[:3].lower()=="vtu" and value[3:].isdigit()

    def _object_id(self, user_id: str) -> ObjectId:
        try:
            return ObjectId(str(user_id))
        except Exception as exc:
            raise HTTPException(
                status_code=400,
                detail="Invalid user ID",
            ) from exc

    async def validate_ams_credentials(
        self,
        username: str | None,
        password: str | None,
    ) -> None:
        username = self._normalize_portal_username(username)
        password = str(password or "").strip()

        if not username:
            raise HTTPException(
                status_code=400,
                detail="AMS VTU number is required.",
            )

        if not self._is_vtu_number(username):
            raise HTTPException(
                status_code=400,
                detail=(
                    "Invalid AMS username. "
                    "Use the VTU number, for example VTU00000."
                ),
            )

        if not password:
            raise HTTPException(
                status_code=400,
                detail="AMS password is required.",
            )

        session = None

        try:
            session = await self.ams_adapter.login(
                username=username,
                password=password,
                vtu_number=username,
            )

            if not session:
                raise RuntimeError(
                    "AMS adapter returned an empty session."
                )

        except AmsAuthenticationError as exc:
            raise HTTPException(
                status_code=400,
                detail=(
                    "Invalid AMS credentials. "
                    "Check the VTU number and AMS password."
                ),
            ) from exc

        except HTTPException:
            raise

        except Exception as exc:
            raise HTTPException(
                status_code=502,
                detail=(
                    "Unable to verify AMS credentials "
                    "right now. Please try again."
                ),
            ) from exc

        finally:
            if session:
                try:
                    await self.ams_adapter.logout(session)
                except Exception:
                    pass

    async def create_user(
        self,
        payload: UserCreate,
    ) -> dict:
        email = payload.email.strip().lower()

        if self.db[USERS].find_one({"email": email}):
            raise HTTPException(
                status_code=409,
                detail="Email already exists",
            )

        vtu_number = self._normalize_vtu_number(
            payload.vtuNumber
        )

        if vtu_number:
            existing_vtu = self.db[USERS].find_one(
                {"vtuNumber": vtu_number}
            )

            if existing_vtu:
                raise HTTPException(
                    status_code=409,
                    detail="VTU number already exists",
                )

        portal_username = self._normalize_portal_username(
            payload.portalUsername
        )

        portal_password = str(
            payload.portalPassword or ""
        ).strip()

        if payload.role == "student" and vtu_number:
            if (
                portal_username
                and portal_username != vtu_number
            ):
                raise HTTPException(
                    status_code=400,
                    detail=(
                        "AMS/Parent Portal username "
                        "must be the VTU number."
                    ),
                )

            portal_username = vtu_number

        if portal_password:
            if not vtu_number:
                raise HTTPException(
                    status_code=400,
                    detail=(
                        "VTU number is required when "
                        "AMS credentials are provided."
                    ),
                )

            portal_username = vtu_number

            await self.validate_ams_credentials(
                username=portal_username,
                password=portal_password,
            )

        data = payload.model_dump(exclude_none=True)

        data["name"] = payload.name.strip()
        data["email"] = email
        data["role"] = payload.role

        if vtu_number:
            data["vtuNumber"] = vtu_number

        if portal_username:
            data["portalUsername"] = portal_username

        text_fields = [
            "name",
            "vtuNumber",
            "gender",
            "fatherName",
            "motherName",
            "dateOfBirth",
            "degree",
            "community",
            "religion",
            "nationality",
            "aadhaarNumber",
            "academicBankCreditsId",
            "phoneNumber",
            "parentName",
            "parentPhone",
            "branch",
            "year",
            "semester",
            "section",
            "batch",
            "photoUrl",
            "portalUsername",
        ]

        for field in text_fields:
            if field not in data:
                continue

            value = self._clean_text(data[field])

            if field == "email" and value:
                value = value.lower()

            if value is None:
                data.pop(field, None)
            else:
                data[field] = value

        temporary_password = data.pop(
            "temporaryPassword",
            None,
        )

        if temporary_password:
            from app.security.password import hash_password

            data["passwordHash"] = hash_password(
                temporary_password
            )
        else:
            data["passwordHash"] = None

        data.pop("portalPassword", None)

        if portal_password:
            data["portalPasswordEncrypted"] = (
                encrypt_portal_password(
                    portal_password
                )
            )
            data["portalCredentialsConfigured"] = True
        else:
            data["portalPasswordEncrypted"] = None
            data["portalCredentialsConfigured"] = False

        data.setdefault("portalSynced", False)
        data.setdefault("lastSyncedAt", None)
        data.setdefault("portalSyncInProgress", False)
        data.setdefault("portalSyncLastError", None)
        data.setdefault("active", True)
        data.setdefault("smsEnabled", True)
        data.setdefault("notificationsEnabled", True)
        data.setdefault("forcePasswordChange", True)

        result = self.db[USERS].insert_one(data)

        return self.get_user(
            str(result.inserted_id)
        )

    def list_users(
        self,
        active_only: bool = False,
    ) -> list[dict]:
        query = {"active": True} if active_only else {}

        users = (
            self.db[USERS]
            .find(query)
            .sort("name", 1)
        )

        return [
            public_user(
                serialize_document(user)
            )
            for user in users
        ]

    def get_user(self, user_id: str) -> dict:
        object_id = self._object_id(user_id)

        user = self.db[USERS].find_one(
            {"_id": object_id}
        )

        if not user:
            raise HTTPException(
                status_code=404,
                detail="User not found",
            )

        return public_user(
            serialize_document(user)
        )

    async def update_user(
        self,
        user_id: str,
        payload: UserUpdate,
    ) -> dict:
        object_id = self._object_id(user_id)

        existing = self.db[USERS].find_one(
            {"_id": object_id}
        )

        if not existing:
            raise HTTPException(
                status_code=404,
                detail="User not found",
            )

        update = {
            key: value
            for key, value in payload.model_dump().items()
            if value is not None
        }

        if not update:
            return self.get_user(user_id)

        text_fields = [
            "name",
            "email",
            "vtuNumber",
            "gender",
            "fatherName",
            "motherName",
            "dateOfBirth",
            "degree",
            "community",
            "religion",
            "nationality",
            "aadhaarNumber",
            "academicBankCreditsId",
            "phoneNumber",
            "parentName",
            "parentPhone",
            "branch",
            "year",
            "semester",
            "section",
            "batch",
            "photoUrl",
            "portalUsername",
        ]

        for field in text_fields:
            if field not in update:
                continue

            value = self._clean_text(update[field])

            if field == "email" and value:
                value = value.lower()

            if field == "vtuNumber" and value:
                value = self._normalize_vtu_number(value)

            if field == "portalUsername" and value:
                value = self._normalize_portal_username(value)

            update[field] = value

        if update.get("email"):
            duplicate = self.db[USERS].find_one(
                {
                    "email": update["email"],
                    "_id": {"$ne": object_id},
                }
            )

            if duplicate:
                raise HTTPException(
                    status_code=409,
                    detail="Email already exists",
                )

        if update.get("vtuNumber"):
            duplicate = self.db[USERS].find_one(
                {
                    "vtuNumber": update["vtuNumber"],
                    "_id": {"$ne": object_id},
                }
            )

            if duplicate:
                raise HTTPException(
                    status_code=409,
                    detail="VTU number already exists",
                )

        effective_vtu = (
            update.get("vtuNumber")
            or existing.get("vtuNumber")
        )

        if (
            existing.get("role") == "student"
            and effective_vtu
        ):
            effective_vtu = self._normalize_vtu_number(
                effective_vtu
            )

            update["vtuNumber"] = effective_vtu

            if (
                update.get("portalUsername")
                and update["portalUsername"] != effective_vtu
            ):
                raise HTTPException(
                    status_code=400,
                    detail=(
                        "AMS/Parent Portal username "
                        "must be the VTU number."
                    ),
                )

            update["portalUsername"] = effective_vtu

        portal_password = update.pop(
            "portalPassword",
            None,
        )

        if portal_password:
            if not effective_vtu:
                raise HTTPException(
                    status_code=400,
                    detail=(
                        "VTU number is required when "
                        "AMS credentials are provided."
                    ),
                )

            portal_username = self._normalize_vtu_number(
                effective_vtu
            )

            await self.validate_ams_credentials(
                username=portal_username,
                password=portal_password,
            )

            update["portalUsername"] = portal_username
            update["portalPasswordEncrypted"] = (
                encrypt_portal_password(
                    portal_password
                )
            )
            update["portalCredentialsConfigured"] = True
            update["portalSynced"] = False
            update["lastSyncedAt"] = None
            update["portalSyncLastError"] = None

        elif (
            "vtuNumber" in update
            and update["vtuNumber"]
            != existing.get("vtuNumber")
        ):
            update["portalSynced"] = False
            update["lastSyncedAt"] = None
            update["portalSyncLastError"] = None

        if update.get("portalUsername"):
            duplicate = self.db[USERS].find_one(
                {
                    "portalUsername": update["portalUsername"],
                    "_id": {"$ne": object_id},
                }
            )

            if duplicate:
                raise HTTPException(
                    status_code=409,
                    detail="Portal username already exists",
                )

        if (
            "portalUsername" in update
            or "portalPasswordEncrypted" in update
        ):
            username = update.get(
                "portalUsername",
                existing.get("portalUsername"),
            )

            encrypted_password = update.get(
                "portalPasswordEncrypted",
                existing.get("portalPasswordEncrypted"),
            )

            configured = bool(
                username
                and encrypted_password
            )

            update["portalCredentialsConfigured"] = configured

            if configured:
                update["portalSynced"] = False
                update["lastSyncedAt"] = None
                update["portalSyncLastError"] = None

        self.db[USERS].update_one(
            {"_id": object_id},
            {"$set": update},
        )

        return self.get_user(user_id)

    def update_profile(
        self,
        user_id: str,
        payload: ProfileUpdate,
    ) -> dict:
        object_id = self._object_id(user_id)

        user = self.db[USERS].find_one(
            {
                "_id": object_id,
                "active": True,
            }
        )

        if not user:
            raise HTTPException(
                status_code=404,
                detail="User not found or inactive",
            )

        update = {
            key: value
            for key, value in payload.model_dump().items()
            if value is not None
        }

        if update:
            self.db[USERS].update_one(
                {"_id": object_id},
                {"$set": update},
            )

        return self.get_user(user_id)

    async def update_portal_credentials(
        self,
        user_id: str,
        payload: PortalCredentialsUpdate,
    ) -> dict:
        object_id = self._object_id(user_id)

        user = self.db[USERS].find_one(
            {
                "_id": object_id,
                "active": True,
            }
        )

        if not user:
            raise HTTPException(
                status_code=404,
                detail="User not found or inactive",
            )

        if user.get('role') != 'student':
            raise HTTPException(403, 'Student account required for AMS credentials.')
        username = self._normalize_portal_username(payload.portalUsername)
        if not username or not re.fullmatch(r'VTU[0-9]{3,12}', username,re.I):
            raise HTTPException(400, 'Enter your AMS VTU login username.')
        password = payload.portalPassword
        if not password or len(password)>200:
            raise HTTPException(400, 'AMS password must contain 1 to 200 characters.')
        encrypted_password = encrypt_portal_password(password)
        self.db[USERS].update_one({'_id':object_id}, {'$set': {
            'portalUsername':username, 'portalPasswordEncrypted':encrypted_password,
            'portalCredentialsConfigured':True,
        }})
        return {'configured':True, 'portalUsername':username}

    def get_portal_credentials_status(
        self,
        user_id: str,
    ) -> dict:
        object_id = self._object_id(user_id)

        user = self.db[USERS].find_one(
            {
                "_id": object_id,
                "active": True,
            }
        )

        if not user:
            raise HTTPException(
                status_code=404,
                detail="User not found or inactive",
            )

        username = user.get("portalUsername")
        encrypted_password = user.get(
            "portalPasswordEncrypted"
        )

        configured = bool(
            username
            and encrypted_password
        )

        return {
            "configured": configured,
            "portalUsername": (
                username
                if configured
                else None
            ),
        }

    def remove_portal_credentials(
        self,
        user_id: str,
    ) -> dict:
        object_id = self._object_id(user_id)

        user = self.db[USERS].find_one(
            {
                "_id": object_id,
                "active": True,
            }
        )

        if not user:
            raise HTTPException(
                status_code=404,
                detail="User not found or inactive",
            )

        self.db[USERS].update_one(
            {"_id": object_id},
            {
                "$set": {
                    "portalUsername": None,
                    "portalPasswordEncrypted": None,
                    "portalCredentialsConfigured": False,
                    "portalSynced": False,
                    "lastSyncedAt": None,
                    "portalSyncInProgress": False,
                    "portalSyncLastError": None,
                }
            },
        )

        return {
            "configured": False,
            "portalUsername": None,
        }

    def delete_user(
        self,
        user_id: str,
    ) -> None:
        result = self.db[USERS].update_one(
            {
                "_id": self._object_id(user_id)
            },
            {
                "$set": {
                    "active": False
                }
            },
        )

        if result.matched_count == 0:
            raise HTTPException(
                status_code=404,
                detail="User not found",
            )

    def activate_user(
        self,
        user_id: str,
    ) -> dict:
        result = self.db[USERS].update_one(
            {
                "_id": self._object_id(user_id)
            },
            {
                "$set": {
                    "active": True
                }
            },
        )

        if result.matched_count == 0:
            raise HTTPException(
                status_code=404,
                detail="User not found",
            )

        return self.get_user(user_id)