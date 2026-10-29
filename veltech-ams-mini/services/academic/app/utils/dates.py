from datetime import date, datetime, timezone


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


def today_iso() -> str:
    return date.today().isoformat()


def ensure_iso_date(value: str) -> str:
    parsed = date.fromisoformat(value)
    return parsed.isoformat()
