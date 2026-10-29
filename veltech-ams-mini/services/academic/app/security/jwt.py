from datetime import timedelta

from jose import JWTError, jwt

from app.config.settings import settings
from app.utils.dates import utc_now


# =========================================================
# CREATE ACCESS TOKEN
# =========================================================

def create_access_token(
    subject: str,
    role: str,
) -> str:
    """
    Create the application access token.

    The token lifetime is controlled centrally by:

        settings.access_token_expire_minutes

    Keeping the expiration in settings means the JWT
    implementation does not need to be changed when the
    desired session duration changes.
    """

    expire = utc_now() + timedelta(
        minutes=settings.access_token_expire_minutes
    )

    payload = {
        "sub": subject,
        "role": role,
        "exp": expire,
    }

    return jwt.encode(
        payload,
        settings.jwt_secret,
        algorithm=settings.jwt_algorithm,
    )


# =========================================================
# DECODE ACCESS TOKEN
# =========================================================

def decode_access_token(
    token: str,
) -> dict | None:
    """
    Decode and validate an application access token.

    Returns:
        Decoded JWT payload when valid.
        None when the token is invalid or expired.
    """

    if not token:
        return None

    try:
        return jwt.decode(
            token,
            settings.jwt_secret,
            algorithms=[
                settings.jwt_algorithm
            ],
        )

    except JWTError:
        return None