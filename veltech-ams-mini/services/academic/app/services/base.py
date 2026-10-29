from datetime import datetime
from typing import Any

from bson import ObjectId


# =========================================================
# SERIALIZE SINGLE VALUE
# =========================================================

def serialize_value(value: Any) -> Any:
    """
    Convert MongoDB/Python values into JSON-safe values.

    ObjectId     -> string
    datetime     -> ISO 8601 string
    list         -> recursively serialized list
    dict         -> recursively serialized dictionary
    everything else -> unchanged
    """

    # -----------------------------------------------------
    # MongoDB ObjectId
    # -----------------------------------------------------

    if isinstance(value, ObjectId):
        return str(value)

    # -----------------------------------------------------
    # Python datetime
    # -----------------------------------------------------

    if isinstance(value, datetime):
        return value.isoformat()

    # -----------------------------------------------------
    # Lists
    # -----------------------------------------------------

    if isinstance(value, list):
        return [
            serialize_value(item)
            for item in value
        ]

    # -----------------------------------------------------
    # Dictionaries
    # -----------------------------------------------------

    if isinstance(value, dict):
        return serialize_document(value)

    # -----------------------------------------------------
    # Normal values
    # -----------------------------------------------------

    return value


# =========================================================
# SERIALIZE MONGODB DOCUMENT
# =========================================================

def serialize_document(
    document: dict | None,
) -> dict | None:
    """
    Convert a MongoDB document into a frontend/API-safe
    dictionary.

    MongoDB:
        _id

    becomes:

        id
    """

    if document is None:
        return None

    output = {}

    for key, value in document.items():

        output[
            "id" if key == "_id" else key
        ] = serialize_value(value)

    return output


# =========================================================
# PUBLIC USER
# =========================================================

def public_user(
    user: dict,
) -> dict:
    """
    Return a safe public representation of a user.

    Student information is preserved so the profile page
    can display the manually entered MongoDB data.

    Sensitive authentication and portal password fields
    are removed.
    """

    clean = dict(user)

    # =====================================================
    # REMOVE MONGODB INTERNAL ID
    # =====================================================

    clean.pop(
        "_id",
        None,
    )

    # =====================================================
    # REMOVE APPLICATION LOGIN PASSWORD
    # =====================================================

    clean.pop(
        "passwordHash",
        None,
    )

    clean.pop(
        "password",
        None,
    )

    # =====================================================
    # REMOVE PORTAL / AMS PASSWORD
    # =====================================================

    clean.pop(
        "portalPassword",
        None,
    )

    clean.pop(
        "portalPasswordEncrypted",
        None,
    )

    clean.pop(
        "portal_password",
        None,
    )

    clean.pop(
        "portal_password_encrypted",
        None,
    )

    # =====================================================
    # RETURN SAFE USER DATA
    # =====================================================

    return clean