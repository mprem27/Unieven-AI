from cryptography.fernet import Fernet, InvalidToken

from app.config.settings import settings


# =========================================================
# GET ENCRYPTION CIPHER
# =========================================================

def _get_cipher() -> Fernet:
    """
    Create the Fernet cipher using the application-level
    encryption key from settings.

    The key must come from:

        PORTAL_CREDENTIAL_ENCRYPTION_KEY

    in the backend .env file.
    """

    key = settings.portal_credential_encryption_key

    if not key:
        raise RuntimeError(
            "PORTAL_CREDENTIAL_ENCRYPTION_KEY is not configured"
        )

    try:
        return Fernet(
            key.encode("utf-8")
        )

    except Exception as exc:
        raise RuntimeError(
            "Invalid PORTAL_CREDENTIAL_ENCRYPTION_KEY. "
            "Generate a valid Fernet key."
        ) from exc


# =========================================================
# ENCRYPT PORTAL PASSWORD
# =========================================================

def encrypt_portal_password(
    password: str,
) -> str:
    """
    Encrypt a college portal password before storing it
    in MongoDB.

    IMPORTANT:
        The plaintext password is never stored.
    """

    if not isinstance(
        password,
        str,
    ):
        raise ValueError(
            "Portal password must be a string"
        )

    if not password:
        raise ValueError(
            "Portal password cannot be empty"
        )

    cipher = _get_cipher()

    encrypted = cipher.encrypt(
        password.encode("utf-8")
    )

    return encrypted.decode("utf-8")


# =========================================================
# DECRYPT PORTAL PASSWORD
# =========================================================

def decrypt_portal_password(
    encrypted_password: str,
) -> str:
    """
    Decrypt a portal password stored in MongoDB.

    The plaintext password should exist only temporarily
    while authenticating with AMS or the Parent Portal.
    """

    if not isinstance(
        encrypted_password,
        str,
    ):
        raise ValueError(
            "Encrypted portal password must be a string"
        )

    if not encrypted_password:
        raise ValueError(
            "Encrypted portal password is empty"
        )

    cipher = _get_cipher()

    try:

        decrypted = cipher.decrypt(
            encrypted_password.encode("utf-8")
        )

    except InvalidToken as exc:

        raise RuntimeError(
            "Unable to decrypt portal password. "
            "The encryption key may be incorrect "
            "or the stored credential may be invalid."
        ) from exc

    except Exception as exc:

        raise RuntimeError(
            "Unable to decrypt portal password"
        ) from exc

    return decrypted.decode(
        "utf-8"
    )


# =========================================================
# GENERATE ENCRYPTION KEY
# =========================================================

def generate_portal_encryption_key() -> str:
    """
    Generate a new Fernet encryption key.

    Run this once and put the result in .env:

        PORTAL_CREDENTIAL_ENCRYPTION_KEY=<generated-key>

    IMPORTANT:
        Do NOT generate a new key every time the server
        starts.

        If the key changes, previously encrypted portal
        passwords cannot be decrypted.
    """

    return Fernet.generate_key().decode(
        "utf-8"
    )